import {describe, expect, it} from "vitest"
import {
  buildActivityDraft,
  renderTitle,
  toLocalIsoString,
} from "./activity-draft"
import type {SessionValues} from "./session"
import {DEFAULT_SETTINGS} from "./settings"

const at = (hour: number, minute: number, second = 0) =>
  new Date(2026, 9, 16, hour, minute, second).getTime()

const session = (
  startedAt: number,
  durationSeconds: number,
  distanceMeters: number,
  steps: number,
  maxSpeedKmh: number
): SessionValues => ({
  startedAt,
  endedAt: startedAt + durationSeconds * 1000,
  durationSeconds,
  distanceMeters,
  steps,
  maxSpeedKmh,
})

// The 16 October 2026 sessions, as recorded during the first tests.
const sessions = [
  session(at(15, 37, 12), 2552, 1410, 2717, 2.5),
  session(at(10, 0), 4140, 2320, 0, 2),
  session(at(16, 22, 17), 156, 100, 157, 3),
]

describe("buildActivityDraft", () => {
  it("sums the day and starts at the first session", () => {
    const draft = buildActivityDraft(sessions, DEFAULT_SETTINGS.strava, "fr")
    expect(draft).toMatchObject({
      name: "Marche sur tapis",
      sportType: "Walk",
      trainer: true,
      elapsedTimeSeconds: 6848,
      distanceMeters: 3830,
      description: "",
    })
    expect(draft?.startDateLocal.slice(0, 19)).toBe("2026-10-16T10:00:00")
  })

  it("renders a custom title template", () => {
    const settings = {
      ...DEFAULT_SETTINGS.strava,
      titleTemplate:
        "{sessions} walks, {distance} in {duration} ({steps} steps)",
    }
    expect(buildActivityDraft(sessions, settings, "en")?.name).toBe(
      "3 walks, 3.8 km in 1 h 54 (2,874 steps)"
    )
  })

  it("returns no draft for a day without sessions", () => {
    expect(buildActivityDraft([], DEFAULT_SETTINGS.strava, "en")).toBeNull()
  })
})

describe("helpers", () => {
  it("keeps unknown placeholders as is", () => {
    expect(renderTitle("{distance} {unknown}", {distance: "2 km"})).toBe(
      "2 km {unknown}"
    )
  })

  it("formats the local start with its UTC offset", () => {
    expect(toLocalIsoString(at(10, 0))).toMatch(
      /^2026-10-16T10:00:00[+-]\d{2}:\d{2}$/
    )
  })
})
