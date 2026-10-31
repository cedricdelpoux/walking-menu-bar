import {describe, expect, it} from "vitest"
import {
  addDays,
  dayKeyOf,
  groupSessionsByDay,
  startOfDay,
  summarizeSessions,
} from "./day"
import type {SessionRecord} from "./session"

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime()

const session = (
  id: number,
  startedAt: number,
  durationSeconds: number,
  distanceMeters: number,
  maxSpeedKmh = 3
): SessionRecord => ({
  id,
  startedAt,
  endedAt: startedAt + durationSeconds * 1000,
  durationSeconds,
  distanceMeters,
  steps: Math.round(distanceMeters * 1.4),
  maxSpeedKmh,
  isActive: false,
  editedAt: null,
})

describe("day keys", () => {
  it("uses the local calendar day", () => {
    expect(dayKeyOf(at(16, 0, 5))).toBe("2026-10-16")
    expect(dayKeyOf(at(16, 23, 59))).toBe("2026-10-16")
    expect(startOfDay("2026-10-16")).toBe(at(16, 0))
  })

  it("moves across month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })
})

describe("summarizeSessions", () => {
  it("adds up the sessions and derives the speeds", () => {
    const summary = summarizeSessions([
      session(1, at(16, 9), 1800, 1500, 3.5),
      session(2, at(16, 14), 1800, 1500, 4),
    ])
    expect(summary).toEqual({
      sessionCount: 2,
      durationSeconds: 3600,
      distanceMeters: 3000,
      steps: 4200,
      averageSpeedKmh: 3,
      maxSpeedKmh: 4,
      firstStartedAt: at(16, 9),
    })
  })

  it("summarizes an empty day", () => {
    expect(summarizeSessions([])).toMatchObject({
      sessionCount: 0,
      averageSpeedKmh: 0,
      firstStartedAt: null,
    })
  })
})

describe("groupSessionsByDay", () => {
  it("groups by start day, most recent day first, sessions in chronological order", () => {
    const days = groupSessionsByDay([
      session(3, at(16, 15), 600, 500),
      session(1, at(15, 10), 600, 500),
      session(2, at(16, 9), 600, 500),
    ])
    expect(days.map((day) => day.day)).toEqual(["2026-10-16", "2026-10-15"])
    expect(days[0].sessions.map((entry) => entry.id)).toEqual([2, 3])
    expect(days[0].summary.distanceMeters).toBe(1000)
  })

  it("keeps a session that runs past midnight on its start day", () => {
    const [day] = groupSessionsByDay([session(1, at(16, 23, 50), 1200, 1000)])
    expect(day.day).toBe("2026-10-16")
  })
})
