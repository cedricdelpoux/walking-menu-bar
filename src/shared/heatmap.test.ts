import {describe, expect, it} from "vitest"
import type {DayHistory} from "./day"
import {buildHeatmap} from "./heatmap"

const walk = (day: string, distanceMeters: number) =>
  ({day, summary: {distanceMeters}}) as DayHistory

describe("buildHeatmap", () => {
  // 2026-11-11 is a Wednesday.
  const today = "2026-11-11"

  it("lays the weeks out from Monday and stops at today", () => {
    const weeks = buildHeatmap([], today, 2)
    expect(weeks[0].map(({day}) => day)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ])
    expect(weeks[1].map(({day}) => day)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
    ])
  })

  it("grades each day against the longest walk", () => {
    const weeks = buildHeatmap(
      [walk("2026-11-09", 4000), walk("2026-11-10", 1000)],
      today,
      1
    )
    expect(weeks[0].map(({level}) => level)).toEqual([4, 1, 0])
  })

  it("leaves every day empty without walks", () => {
    expect(buildHeatmap([], today, 1)[0].every(({level}) => level === 0)).toBe(
      true
    )
  })
})
