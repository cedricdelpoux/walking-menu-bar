import {addDays, dayKeyOf, startOfDay, type DayKey} from "../../shared/day"
import {
  catchUpDays,
  isDueForAutoPublish,
} from "../../shared/publication-schedule"
import type {StravaSettings} from "../../shared/settings"
import {
  dayTarget,
  type PublicationTarget,
  type StravaState,
} from "../../shared/strava"
import type {SessionRepository} from "../storage/session-repository"
import type {ActivityPublisher} from "./activity-publisher"

const CHECK_INTERVAL_MS = 60_000

export interface PublicationSchedulerDependencies {
  publisher: ActivityPublisher
  sessions: SessionRepository
  settings: () => StravaSettings
  stravaState: () => StravaState
  now?: () => number
}

// Checks every minute rather than arming a timer for the publish time: timers stop while the
// Mac sleeps, and a minute check also picks up a session ending.
export class PublicationScheduler {
  private timer: NodeJS.Timeout | undefined
  private running: Promise<void> | null = null
  private readonly now: () => number

  constructor(private readonly dependencies: PublicationSchedulerDependencies) {
    this.now = dependencies.now ?? Date.now
  }

  start(): void {
    clearInterval(this.timer)
    this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS)
    void this.check()
  }

  stop(): void {
    clearInterval(this.timer)
  }

  check(): Promise<void> {
    this.running ??= this.publishDueTargets().finally(() => {
      this.running = null
    })
    return this.running
  }

  private async publishDueTargets(): Promise<void> {
    const settings = this.dependencies.settings()
    const strava = this.dependencies.stravaState()
    if (
      !settings.autoPublish ||
      !strava.connected ||
      strava.connectedAt === null
    )
      return

    const now = this.now()
    const options = {
      now,
      publishTime: settings.publishTime,
      earliestDay: dayKeyOf(strava.connectedAt),
    }
    for (const day of catchUpDays(dayKeyOf(now), options.earliestDay)) {
      for (const target of this.targetsOf(day, settings.grouping)) {
        const state = this.dependencies.publisher.getState(target)
        if (isDueForAutoPublish(state, options))
          await this.dependencies.publisher.publish(target)
      }
    }
  }

  private targetsOf(
    day: DayKey,
    grouping: StravaSettings["grouping"]
  ): PublicationTarget[] {
    if (grouping === "day") return [dayTarget(day)]
    return this.dependencies.sessions
      .listSessionsStartedBetween(startOfDay(day), startOfDay(addDays(day, 1)))
      .map((session) => ({day, sessionId: session.id}))
  }
}
