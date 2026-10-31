import {randomUUID} from "node:crypto"
import {EventEmitter} from "node:events"
import {buildActivityDraft} from "../../shared/activity-draft"
import {addDays, dayKeyOf, startOfDay, type DayKey} from "../../shared/day"
import type {Locale} from "../../shared/i18n"
import type {StravaSettings} from "../../shared/settings"
import {
  dayTarget,
  publicationKeyOf,
  type ActivityDraft,
  type Publication,
  type PublicationKey,
  type PublicationState,
  type PublicationTarget,
  type SpeedInterval,
  type StravaResult,
  type StravaWalk,
  type StravaWalksByDay,
} from "../../shared/strava"
import type {PublicationRepository} from "../storage/publication-repository"
import type {SessionRepository} from "../storage/session-repository"
import {toStravaResult} from "./strava-account"
import {
  encodeActivityFit,
  stravaSpeedProfile,
  type FitSessionInput,
} from "./fit-activity"
import {
  ACTIVITIES_PER_PAGE,
  StravaError,
  toPlainText,
  type StravaHttp,
  type StravaSummaryActivity,
} from "./strava-http"
import {
  findWalkCoveringDay,
  findWalkPublishedForDraft,
  groupWalksByDay,
  toStravaWalks,
} from "./strava-walks"

const SEARCH_MARGIN_SECONDS = 86_400
const MAX_ACTIVITY_PAGES = 3
const UPLOAD_POLL_INTERVAL_MS = 2000
const UPLOAD_TIMEOUT_MS = 120_000
const DUPLICATE_ACTIVITY_LINK = /\/activities\/(\d+)/

export interface DraftOverrides {
  name?: string
  description?: string
}

export interface ActivityPublisherDependencies {
  sessions: SessionRepository
  publications: PublicationRepository
  http: StravaHttp
  getAccessToken: () => Promise<string>
  settings: () => StravaSettings
  locale: () => Locale
  now?: () => number
  wait?: (ms: number) => Promise<void>
}

export class ActivityPublisher extends EventEmitter<{
  change: [PublicationKey]
}> {
  private readonly inFlight = new Map<
    PublicationKey,
    Promise<StravaResult<Publication>>
  >()
  private readonly now: () => number
  private readonly wait: (ms: number) => Promise<void>

  constructor(private readonly dependencies: ActivityPublisherDependencies) {
    super()
    this.now = dependencies.now ?? Date.now
    this.wait =
      dependencies.wait ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  getState(target: PublicationTarget): PublicationState {
    const sessions = this.sessionsOf(target)
    const settings = this.dependencies.settings()
    return {
      target,
      draft: buildActivityDraft(sessions, settings, this.dependencies.locale()),
      hasActiveSession: sessions.some((session) => session.isActive),
      publication: this.findPublication(target),
    }
  }

  speedProfile(target: PublicationTarget): SpeedInterval[] {
    return stravaSpeedProfile(this.fitInputsOf(target))
  }

  // Concurrent calls for the same target share one attempt, so an activity is never sent twice.
  publish(
    target: PublicationTarget,
    overrides: DraftOverrides = {}
  ): Promise<StravaResult<Publication>> {
    const key = publicationKeyOf(target)
    const pending = this.inFlight.get(key)
    if (pending) return pending
    const attempt = this.attemptPublish(target, overrides).finally(() =>
      this.inFlight.delete(key)
    )
    this.inFlight.set(key, attempt)
    return attempt
  }

  // Walks already on Strava are recorded as published, so the app never publishes them again.
  async syncWithStrava(
    dayCount: number
  ): Promise<StravaResult<StravaWalksByDay>> {
    try {
      const {http} = this.dependencies
      const accessToken = await this.dependencies.getAccessToken()
      const firstDay = addDays(dayKeyOf(this.now()), 1 - dayCount)
      const {activities, isComplete} = await this.listActivitiesSince(
        http,
        accessToken,
        firstDay
      )
      if (isComplete) this.forgetDeletedActivities(firstDay, activities)
      const walksByDay = groupWalksByDay(toStravaWalks(activities))
      for (const [day, walks] of Object.entries(walksByDay))
        this.recordWalksOfDay(day, walks)
      return {ok: true, value: walksByDay}
    } catch (error) {
      return toStravaResult(error)
    }
  }

  dismiss(target: PublicationTarget): Publication {
    const key = publicationKeyOf(target)
    const publication = this.dependencies.publications.find(key)
    if (publication?.status === "published") return publication
    const dismissed = this.dependencies.publications.markDismissed(
      key,
      this.now()
    )
    this.emit("change", key)
    return dismissed
  }

  reset(target: PublicationTarget): void {
    const key = publicationKeyOf(target)
    this.dependencies.publications.reset(key)
    this.emit("change", key)
  }

  // A file rather than a manual activity carries the steps, the cadence and the speed graph.
  private async uploadActivity(
    http: StravaHttp,
    accessToken: string,
    target: PublicationTarget,
    draft: ActivityDraft
  ): Promise<string> {
    const fitFile = encodeActivityFit(this.fitInputsOf(target))
    // Strava refuses an external id forever once used, even after the activity is deleted.
    const externalId = `walkingbar-${publicationKeyOf(target).replace("/", "-")}-${randomUUID().slice(0, 8)}`
    let upload = await http.uploadActivityFile(accessToken, {
      fitFile,
      name: draft.name,
      description: draft.description,
      externalId,
    })
    const deadline = this.now() + UPLOAD_TIMEOUT_MS
    for (;;) {
      if (upload.error) {
        const duplicateActivityId = upload.error.match(
          DUPLICATE_ACTIVITY_LINK
        )?.[1]
        if (duplicateActivityId) return duplicateActivityId
        throw new StravaError("api", toPlainText(upload.error))
      }
      if (upload.activity_id) return String(upload.activity_id)
      if (this.now() > deadline)
        throw new StravaError(
          "api",
          "Strava did not finish processing the activity in time"
        )
      await this.wait(UPLOAD_POLL_INTERVAL_MS)
      upload = await http.getUpload(accessToken, upload.id)
    }
  }

  private async listActivitiesSince(
    http: StravaHttp,
    accessToken: string,
    firstDay: DayKey
  ) {
    const afterSeconds = startOfDay(firstDay) / 1000 - SEARCH_MARGIN_SECONDS
    const beforeSeconds = this.now() / 1000 + SEARCH_MARGIN_SECONDS
    const activities: StravaSummaryActivity[] = []
    for (let page = 1; page <= MAX_ACTIVITY_PAGES; page++) {
      const pageActivities = await http.listActivities(
        accessToken,
        afterSeconds,
        beforeSeconds,
        page
      )
      activities.push(...pageActivities)
      if (pageActivities.length < ACTIVITIES_PER_PAGE)
        return {activities, isComplete: true}
    }
    return {activities, isComplete: false}
  }

  // Strava has no webhook here: an activity deleted on Strava is noticed when it is missing from
  // a complete listing, and its walk can then be published again.
  private forgetDeletedActivities(
    firstDay: DayKey,
    activities: StravaSummaryActivity[]
  ): void {
    const existingActivityIds = new Set(
      activities.map((activity) => String(activity.id))
    )
    for (const publication of this.dependencies.publications.listFrom(
      firstDay
    )) {
      if (publication.status !== "published" || !publication.activityId)
        continue
      if (existingActivityIds.has(publication.activityId)) continue
      this.dependencies.publications.forgetDeletedActivity(
        publication.key,
        publication.activityId
      )
      this.emit("change", publication.key)
    }
  }

  // Each session is matched on its own start and distance, then the whole day, which may have been
  // published before the grouping changed. Grouped by day, any treadmill walk of the day covers it.
  private recordWalksOfDay(day: DayKey, walks: StravaWalk[]): void {
    const isGroupedByDay = this.dependencies.settings().grouping === "day"
    if (!isGroupedByDay) {
      for (const session of this.sessionsOf(dayTarget(day))) {
        this.recordWalkMatching({day, sessionId: session.id}, walks, false)
      }
    }
    this.recordWalkMatching(dayTarget(day), walks, isGroupedByDay)
  }

  private recordWalkMatching(
    target: PublicationTarget,
    walks: StravaWalk[],
    acceptsAnyTreadmillWalk: boolean
  ): void {
    const state = this.getState(target)
    if (
      state.publication?.status === "published" ||
      state.publication?.status === "dismissed" ||
      !state.draft
    )
      return
    const walk = acceptsAnyTreadmillWalk
      ? findWalkCoveringDay(walks, state.draft)
      : findWalkPublishedForDraft(walks, state.draft)
    if (!walk) return
    const key = publicationKeyOf(target)
    this.dependencies.publications.markPublished(key, walk.id, this.now())
    this.emit("change", key)
  }

  // A day published as one activity covers its sessions, and a session published on its own
  // covers its day, so changing the grouping never sends a walk twice.
  private findPublication(target: PublicationTarget): Publication | null {
    const key = publicationKeyOf(target)
    const ownPublication = this.dependencies.publications.find(key) ?? null
    if (
      ownPublication?.status === "published" ||
      ownPublication?.status === "dismissed"
    )
      return ownPublication
    const coveringPublication = this.dependencies.publications
      .listOfDay(target.day)
      .find(
        (publication) =>
          publication.status === "published" &&
          publication.key !== key &&
          (target.sessionId === null || publication.key === target.day)
      )
    return coveringPublication ?? ownPublication
  }

  private fitInputsOf(target: PublicationTarget): FitSessionInput[] {
    return this.sessionsOf(target).map((session) => ({
      session,
      samples: this.dependencies.sessions.listSamples(session.id),
    }))
  }

  private sessionsOf(target: PublicationTarget) {
    const sessionsOfDay = this.dependencies.sessions.listSessionsStartedBetween(
      startOfDay(target.day),
      startOfDay(addDays(target.day, 1))
    )
    return target.sessionId === null
      ? sessionsOfDay
      : sessionsOfDay.filter((session) => session.id === target.sessionId)
  }

  private async attemptPublish(
    target: PublicationTarget,
    overrides: DraftOverrides
  ): Promise<StravaResult<Publication>> {
    const {publications, http} = this.dependencies
    const key = publicationKeyOf(target)
    const state = this.getState(target)
    const existing = state.publication
    if (existing?.status === "published" || existing?.status === "dismissed")
      return {ok: true, value: existing}

    try {
      if (!state.draft) throw new StravaError("api", "No session to publish")
      const draft: ActivityDraft = {
        ...state.draft,
        name: overrides.name?.trim() || state.draft.name,
        description: overrides.description ?? state.draft.description,
      }

      const accessToken = await this.dependencies.getAccessToken()
      // An activity created by a previous attempt that crashed before saving its id is adopted.
      const activityId =
        (await this.findPublishedActivity(
          http,
          accessToken,
          target.day,
          draft
        )) ?? (await this.uploadActivity(http, accessToken, target, draft))
      const published = publications.markPublished(key, activityId, this.now())

      if (this.dependencies.settings().hideFromHome) {
        await http
          .updateActivity(accessToken, activityId, {hide_from_home: true})
          .catch(() => undefined)
      }
      this.emit("change", key)
      return {ok: true, value: published}
    } catch (error) {
      const result = toStravaResult<Publication>(error)
      if (!result.ok)
        publications.markFailed(key, result.error, result.message, this.now())
      this.emit("change", key)
      return result
    }
  }

  private async findPublishedActivity(
    http: StravaHttp,
    accessToken: string,
    day: DayKey,
    draft: ActivityDraft
  ): Promise<string | null> {
    const dayStartSeconds = startOfDay(day) / 1000
    const activities = await http.listActivities(
      accessToken,
      dayStartSeconds - SEARCH_MARGIN_SECONDS,
      dayStartSeconds + 2 * SEARCH_MARGIN_SECONDS
    )
    return (
      findWalkPublishedForDraft(toStravaWalks(activities), draft)?.id ?? null
    )
  }
}
