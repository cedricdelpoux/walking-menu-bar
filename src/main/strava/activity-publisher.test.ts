import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"
import {DEFAULT_SETTINGS, type StravaSettings} from "../../shared/settings"
import {dayTarget} from "../../shared/strava"
import {openDatabase, type AppDatabase} from "../storage/database"
import {PublicationRepository} from "../storage/publication-repository"
import {SessionRepository} from "../storage/session-repository"
import {ActivityPublisher} from "./activity-publisher"
import {
  StravaError,
  type ActivityFileUpload,
  type StravaHttp,
  type StravaSummaryActivity,
} from "./strava-http"

const DAY = "2026-10-16"
const DAY_TARGET = dayTarget(DAY)
const at = (hour: number, minute: number) =>
  new Date(2026, 9, 16, hour, minute).getTime()

function fakeHttp(existing: StravaSummaryActivity[] = []) {
  return {
    uploadActivityFile: vi.fn(
      async (_accessToken: string, _upload: ActivityFileUpload) => ({
        id: 1,
        status: "Your activity is still being processed.",
        error: null as string | null,
        activity_id: null as number | null,
      })
    ),
    getUpload: vi.fn(async (_accessToken: string, _uploadId: number) => ({
      id: 1,
      status: "Your activity is ready.",
      error: null as string | null,
      activity_id: 987654321 as number | null,
    })),
    updateActivity: vi.fn(
      async (_accessToken: string, _id: string, _fields: object) => ({})
    ),
    listActivities: vi.fn(async () => existing),
  }
}

describe("ActivityPublisher", () => {
  let database: AppDatabase
  let sessions: SessionRepository
  let publications: PublicationRepository
  let settings: StravaSettings
  let sessionTarget: {day: string; sessionId: number}

  const createPublisher = (http: ReturnType<typeof fakeHttp>) =>
    new ActivityPublisher({
      sessions,
      publications,
      http: http as unknown as StravaHttp,
      getAccessToken: async () => "access-token",
      settings: () => settings,
      locale: () => "en",
      now: () => at(22, 0),
      wait: async () => undefined,
    })

  beforeEach(() => {
    database = openDatabase(":memory:")
    sessions = new SessionRepository(database)
    publications = new PublicationRepository(database)
    settings = {...DEFAULT_SETTINGS.strava}
    const id = sessions.createActiveSession({
      startedAt: at(10, 0),
      endedAt: at(11, 9),
      durationSeconds: 4140,
      distanceMeters: 2320,
      steps: 4000,
      maxSpeedKmh: 2.5,
    })
    sessions.completeSession(id, sessions.findById(id)!)
    sessionTarget = {day: DAY, sessionId: id}
  })

  afterEach(() => database.close())

  it("creates the activity once and remembers its id", async () => {
    const http = fakeHttp()
    const publisher = createPublisher(http)

    const [first, second] = await Promise.all([
      publisher.publish(DAY_TARGET),
      publisher.publish(DAY_TARGET),
    ])
    const third = await publisher.publish(DAY_TARGET)

    expect(http.uploadActivityFile).toHaveBeenCalledTimes(1)
    expect(http.uploadActivityFile.mock.calls[0][1]).toMatchObject({
      name: "Treadmill walk",
    })
    expect(http.uploadActivityFile.mock.calls[0][1].externalId).toMatch(
      /^walkingbar-2026-10-16-[0-9a-f]{8}$/
    )
    expect(first).toEqual(second)
    expect(third).toMatchObject({
      ok: true,
      value: {status: "published", activityId: "987654321"},
    })
  })

  it("adopts an activity a previous attempt created without saving its id", async () => {
    const http = fakeHttp([
      {
        id: 42,
        name: "Treadmill walk",
        sport_type: "Walk",
        start_date_local: "2026-10-16T10:00:00Z",
        distance: 2320,
        trainer: true,
      },
    ])
    const result = await createPublisher(http).publish(DAY_TARGET)

    expect(http.uploadActivityFile).not.toHaveBeenCalled()
    expect(result).toMatchObject({ok: true, value: {activityId: "42"}})
  })

  it("does not adopt a different activity of the same day", async () => {
    const http = fakeHttp([
      {
        id: 7,
        name: "Tapis",
        sport_type: "Walk",
        start_date_local: "2026-10-16T10:00:00Z",
        distance: 1000,
        trainer: false,
      },
    ])
    await createPublisher(http).publish(DAY_TARGET)
    expect(http.uploadActivityFile).toHaveBeenCalledTimes(1)
  })

  it("applies the edited title and description, and mutes the activity when asked", async () => {
    settings = {...settings, hideFromHome: true}
    const http = fakeHttp()
    await createPublisher(http).publish(DAY_TARGET, {
      name: "  Morning walk ",
      description: "Custom",
    })

    expect(http.uploadActivityFile.mock.calls[0][1]).toMatchObject({
      name: "Morning walk",
      description: "Custom",
    })
    expect(http.updateActivity).toHaveBeenCalledWith(
      "access-token",
      "987654321",
      {hide_from_home: true}
    )
  })

  it("records a failure, then succeeds on retry", async () => {
    const http = fakeHttp()
    http.uploadActivityFile.mockRejectedValueOnce(
      new StravaError("rateLimited", "Rate Limit Exceeded")
    )
    const publisher = createPublisher(http)

    expect(await publisher.publish(DAY_TARGET)).toMatchObject({
      ok: false,
      error: "rateLimited",
    })
    expect(publications.find(DAY)).toMatchObject({
      status: "failed",
      lastErrorCode: "rateLimited",
      attempts: 1,
    })

    expect(await publisher.publish(DAY_TARGET)).toMatchObject({
      ok: true,
      value: {status: "published", attempts: 2},
    })
  })

  it("never publishes a dismissed day, until it is reset", async () => {
    const http = fakeHttp()
    const publisher = createPublisher(http)
    publisher.dismiss(DAY_TARGET)

    expect(await publisher.publish(DAY_TARGET)).toMatchObject({
      ok: true,
      value: {status: "dismissed"},
    })
    expect(http.uploadActivityFile).not.toHaveBeenCalled()

    publisher.reset(DAY_TARGET)
    await publisher.publish(DAY_TARGET)
    expect(http.uploadActivityFile).toHaveBeenCalledTimes(1)
  })

  it("cannot reset or dismiss a day that is published", async () => {
    const publisher = createPublisher(fakeHttp())
    await publisher.publish(DAY_TARGET)
    publisher.reset(DAY_TARGET)
    publisher.dismiss(DAY_TARGET)
    expect(publications.find(DAY)).toMatchObject({
      status: "published",
      activityId: "987654321",
    })
  })

  it("describes the day for the preview", () => {
    expect(createPublisher(fakeHttp()).getState(DAY_TARGET)).toMatchObject({
      target: DAY_TARGET,
      hasActiveSession: false,
      publication: null,
      draft: {distanceMeters: 2320},
    })
  })

  it("records a day already on Strava while syncing, and reports the walks of each day", async () => {
    const http = fakeHttp([
      {
        id: 77,
        name: "Tapis",
        sport_type: "Walk",
        start_date_local: "2026-10-16T10:00:00Z",
        distance: 2320,
        trainer: true,
      },
      {
        id: 78,
        name: "Run",
        sport_type: "Run",
        start_date_local: "2026-10-16T18:00:00Z",
        distance: 8000,
        trainer: false,
      },
    ])
    const result = await createPublisher(http).syncWithStrava(14)

    expect(result).toMatchObject({
      ok: true,
      value: {"2026-10-16": [{id: "77", name: "Tapis"}]},
    })
    expect(publications.find(DAY)).toMatchObject({
      status: "published",
      activityId: "77",
    })
    expect(http.uploadActivityFile).not.toHaveBeenCalled()
  })

  it("reads every page of recent activities", async () => {
    const http = fakeHttp()
    const fullPage = Array.from({length: 100}, (_, index) => ({
      id: index,
      name: "Ride",
      sport_type: "Ride",
      start_date_local: "2026-10-15T08:00:00Z",
      distance: 20000,
      trainer: false,
    }))
    http.listActivities
      .mockResolvedValueOnce(fullPage)
      .mockResolvedValueOnce([])
    await createPublisher(http).syncWithStrava(14)
    expect(http.listActivities).toHaveBeenCalledTimes(2)
  })

  it("adopts the existing activity when Strava reports the upload as a duplicate", async () => {
    const http = fakeHttp()
    http.getUpload.mockResolvedValueOnce({
      id: 1,
      status: "There was an error processing your activity.",
      error:
        "walkingpad.fit duplicate of <a href='/activities/555' target='_blank'>Treadmill walk</a>",
      activity_id: null,
    })
    expect(await createPublisher(http).publish(DAY_TARGET)).toMatchObject({
      ok: true,
      value: {activityId: "555"},
    })
  })

  it("reports a processing error in plain text", async () => {
    const http = fakeHttp()
    http.getUpload.mockResolvedValueOnce({
      id: 1,
      status: "Error",
      error: "Time information is missing &amp; invalid",
      activity_id: null,
    })
    expect(await createPublisher(http).publish(DAY_TARGET)).toMatchObject({
      ok: false,
      message: "Time information is missing & invalid",
    })
  })

  it("makes a day publishable again once its activity was deleted on Strava", async () => {
    const http = fakeHttp()
    const publisher = createPublisher(http)
    await publisher.publish(DAY_TARGET)
    expect(publications.find(DAY)).toMatchObject({
      status: "published",
      activityId: "987654321",
    })

    await publisher.syncWithStrava(14)
    expect(publications.find(DAY)).toBeUndefined()
  })

  it("keeps the publication when the listing of activities is incomplete", async () => {
    const http = fakeHttp()
    const publisher = createPublisher(http)
    await publisher.publish(DAY_TARGET)
    const fullPage = Array.from({length: 100}, (_, index) => ({
      id: index,
      name: "Ride",
      sport_type: "Ride",
      start_date_local: "2026-10-15T08:00:00Z",
      distance: 20000,
      trainer: false,
    }))
    http.listActivities.mockResolvedValue(fullPage)

    await publisher.syncWithStrava(14)
    expect(publications.find(DAY)).toMatchObject({status: "published"})
  })

  it("publishes a single session on its own", async () => {
    settings = {...settings, grouping: "session"}
    const afternoonId = sessions.createActiveSession({
      startedAt: at(15, 0),
      endedAt: at(15, 30),
      durationSeconds: 1800,
      distanceMeters: 1000,
      steps: 1800,
      maxSpeedKmh: 2,
    })
    sessions.completeSession(afternoonId, sessions.findById(afternoonId)!)
    const http = fakeHttp()
    const publisher = createPublisher(http)

    expect(
      publisher.getState({day: DAY, sessionId: afternoonId}).draft
    ).toMatchObject({distanceMeters: 1000})
    await publisher.publish({day: DAY, sessionId: afternoonId})

    expect(http.uploadActivityFile.mock.calls[0][1].externalId).toMatch(
      new RegExp(`^walkingbar-2026-10-16-session-${afternoonId}-[0-9a-f]{8}$`)
    )
    expect(publications.find(`${DAY}/session-${afternoonId}`)).toMatchObject({
      status: "published",
    })
  })

  it("never sends a walk twice when the grouping changes", async () => {
    const http = fakeHttp()
    const publisher = createPublisher(http)
    await publisher.publish(DAY_TARGET)

    expect(publisher.getState(sessionTarget).publication).toMatchObject({
      key: DAY,
      status: "published",
    })
    expect(await publisher.publish(sessionTarget)).toMatchObject({
      ok: true,
      value: {key: DAY},
    })
    expect(http.uploadActivityFile).toHaveBeenCalledTimes(1)
  })

  it("treats a day as published once one of its sessions is", async () => {
    const publisher = createPublisher(fakeHttp())
    await publisher.publish(sessionTarget)
    expect(publisher.getState(DAY_TARGET).publication).toMatchObject({
      key: `${DAY}/session-${sessionTarget.sessionId}`,
    })
  })

  it("records each session already on Strava while syncing by session", async () => {
    settings = {...settings, grouping: "session"}
    const http = fakeHttp([
      {
        id: 91,
        name: "Tapis",
        sport_type: "Walk",
        start_date_local: "2026-10-16T10:00:00Z",
        distance: 2320,
        trainer: true,
      },
    ])
    await createPublisher(http).syncWithStrava(14)
    expect(
      publications.find(`${DAY}/session-${sessionTarget.sessionId}`)
    ).toMatchObject({status: "published", activityId: "91"})
  })
})
