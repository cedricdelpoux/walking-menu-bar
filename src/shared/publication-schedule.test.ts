import {describe, expect, it} from "vitest"
import {
  catchUpDays,
  isDueForAutoPublish,
  publishInstant,
  retryDelayMs,
} from "./publication-schedule"
import type {Publication, PublicationState} from "./strava"

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime()

const draft = {
  name: "Walk",
  description: "",
  sportType: "Walk" as const,
  startDateLocal: "2026-10-16T10:00:00+02:00",
  elapsedTimeSeconds: 3600,
  distanceMeters: 3000,
  trainer: true as const,
}

const dayState = (
  overrides: Partial<PublicationState> = {}
): PublicationState => ({
  target: {day: "2026-10-16", sessionId: null},
  draft,
  hasActiveSession: false,
  publication: null,
  ...overrides,
})

const failed = (attempts: number, lastAttemptAt: number): Publication => ({
  key: "2026-10-16",
  status: "failed",
  activityId: null,
  publishedAt: null,
  lastError: "Rate Limit Exceeded",
  lastErrorCode: "rateLimited",
  attempts,
  lastAttemptAt,
})

const options = (now: number) => ({
  now,
  publishTime: "19:00",
  earliestDay: "2026-10-10",
})

describe("isDueForAutoPublish", () => {
  it("waits for the publish time of the day", () => {
    expect(publishInstant("2026-10-16", "19:00")).toBe(at(16, 19))
    expect(isDueForAutoPublish(dayState(), options(at(16, 18, 59)))).toBe(false)
    expect(isDueForAutoPublish(dayState(), options(at(16, 19)))).toBe(true)
  })

  it("publishes a session as soon as it ends, without waiting for the publish time", () => {
    const sessionState = dayState({target: {day: "2026-10-16", sessionId: 3}})
    expect(isDueForAutoPublish(sessionState, options(at(16, 10)))).toBe(true)
    expect(
      isDueForAutoPublish(
        {...sessionState, hasActiveSession: true},
        options(at(16, 10))
      )
    ).toBe(false)
  })

  it("catches up a past day the Mac slept through", () => {
    expect(isDueForAutoPublish(dayState(), options(at(17, 8)))).toBe(true)
  })

  it("waits for the session in progress to end", () => {
    expect(
      isDueForAutoPublish(
        dayState({hasActiveSession: true}),
        options(at(16, 20))
      )
    ).toBe(false)
  })

  it("skips days without sessions or before Strava was connected", () => {
    expect(
      isDueForAutoPublish(dayState({draft: null}), options(at(16, 20)))
    ).toBe(false)
    expect(
      isDueForAutoPublish(dayState(), {
        ...options(at(16, 20)),
        earliestDay: "2026-10-17",
      })
    ).toBe(false)
  })

  it("never touches a published or dismissed day", () => {
    const published = {
      ...failed(1, at(16, 19)),
      status: "published" as const,
      activityId: "1",
    }
    expect(
      isDueForAutoPublish(
        dayState({publication: published}),
        options(at(17, 20))
      )
    ).toBe(false)
    expect(
      isDueForAutoPublish(
        dayState({publication: {...published, status: "dismissed"}}),
        options(at(17, 20))
      )
    ).toBe(false)
  })

  it("retries a failure with a growing delay", () => {
    expect(retryDelayMs(1)).toBe(5 * 60_000)
    expect(retryDelayMs(3)).toBe(20 * 60_000)
    expect(retryDelayMs(10)).toBe(60 * 60_000)

    const state = dayState({publication: failed(2, at(16, 19))})
    expect(isDueForAutoPublish(state, options(at(16, 19, 9)))).toBe(false)
    expect(isDueForAutoPublish(state, options(at(16, 19, 10)))).toBe(true)
  })
})

describe("catchUpDays", () => {
  it("lists the last 14 days, oldest first, never before the earliest day", () => {
    expect(catchUpDays("2026-10-16", "2026-10-14")).toEqual([
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ])
    const days = catchUpDays("2026-10-16", "2026-01-01")
    expect(days).toHaveLength(14)
    expect(days[0]).toBe("2026-10-03")
  })
})
