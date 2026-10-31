import {describe, expect, it} from "vitest"
import {summarizeSessions, type DayHistory, type DayKey} from "./day"
import {buildWalkStats} from "./stats"

const TODAY = "2026-10-31"

function walk(day: DayKey, distanceMeters: number): DayHistory {
  const session = {
    startedAt: 0,
    endedAt: 0,
    durationSeconds: distanceMeters,
    distanceMeters,
    steps: distanceMeters * 2,
    maxSpeedKmh: 3,
  }
  return {day, summary: summarizeSessions([session]), sessions: []}
}

describe("buildWalkStats", () => {
  it("adds up the days of the period and leaves the older ones out", () => {
    const days = [
      walk("2026-10-31", 2000),
      walk("2026-10-25", 3000),
      walk("2026-10-24", 9000),
    ]
    expect(buildWalkStats(days, "week", TODAY)).toMatchObject({
      barSize: "day",
      distanceMeters: 5000,
      durationSeconds: 5000,
      steps: 10000,
      activeDays: 2,
      bestDayMeters: 3000,
    })
  })

  it("draws one bar per day, the last one being today", () => {
    const {bars} = buildWalkStats([walk(TODAY, 2000)], "month", TODAY)
    expect(bars).toHaveLength(30)
    expect(bars[0]).toEqual({key: "2026-10-02", distanceMeters: 0})
    expect(bars.at(-1)).toEqual({key: TODAY, distanceMeters: 2000})
  })

  it("groups the last twelve months across the new year", () => {
    const days = [walk("2026-10-30", 2000), walk("2026-10-02", 1000)]
    const {barSize, bars} = buildWalkStats(days, "year", TODAY)
    expect(barSize).toBe("month")
    expect(bars.map((bar) => bar.key)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ])
    expect(bars.at(-1)?.distanceMeters).toBe(3000)
  })

  it("starts from the first walk, in years once there are too many months", () => {
    const recent = buildWalkStats([walk("2026-08-10", 1000)], "all", TODAY)
    expect(recent.bars.map((bar) => bar.key)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ])

    const old = buildWalkStats([walk("2023-08-10", 1000)], "all", TODAY)
    expect(old.barSize).toBe("year")
    expect(old.bars.map((bar) => bar.key)).toEqual([
      "2023",
      "2024",
      "2025",
      "2026",
    ])
  })

  it("handles an empty history", () => {
    expect(buildWalkStats([], "all", TODAY)).toMatchObject({
      bars: [{key: "2026-10", distanceMeters: 0}],
      distanceMeters: 0,
      activeDays: 0,
      bestDayMeters: 0,
    })
  })
})
