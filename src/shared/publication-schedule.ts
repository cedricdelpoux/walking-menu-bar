import {addDays, startOfDay, type DayKey} from "./day"
import type {PublicationState} from "./strava"

const FIRST_RETRY_DELAY_MS = 5 * 60_000
const MAX_RETRY_DELAY_MS = 60 * 60_000

export const CATCH_UP_DAYS = 14

export interface ScheduleOptions {
  now: number
  publishTime: string
  earliestDay: DayKey
}

export function publishInstant(day: DayKey, publishTime: string): number {
  const [hours, minutes] = publishTime.split(":").map(Number)
  return startOfDay(day) + (hours * 60 + minutes) * 60_000
}

export function retryDelayMs(attempts: number): number {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    FIRST_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1)
  )
}

// A day waits for the publish time, while a session leaves as soon as it ends.
export function isDueForAutoPublish(
  state: PublicationState,
  options: ScheduleOptions
): boolean {
  const {day, sessionId} = state.target
  if (day < options.earliestDay) return false
  if (
    sessionId === null &&
    options.now < publishInstant(day, options.publishTime)
  )
    return false
  // A session still going on would be cut from the activity; it ends after the pause timeout.
  if (!state.draft || state.hasActiveSession) return false

  const {publication} = state
  if (!publication) return true
  if (publication.status !== "failed") return false
  return (
    options.now - (publication.lastAttemptAt ?? 0) >=
    retryDelayMs(publication.attempts)
  )
}

// Oldest first, so a catch-up publishes the days in order.
export function catchUpDays(today: DayKey, earliestDay: DayKey): DayKey[] {
  const days: DayKey[] = []
  for (let offset = CATCH_UP_DAYS - 1; offset >= 0; offset--) {
    const day = addDays(today, -offset)
    if (day >= earliestDay) days.push(day)
  }
  return days
}
