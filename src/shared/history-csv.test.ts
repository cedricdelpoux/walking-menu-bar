import {describe, expect, it} from "vitest"
import {buildHistoryCsv} from "./history-csv"
import type {SessionRecord} from "./session"

const session = (startedAt: Date, overrides: Partial<SessionRecord> = {}) => ({
  id: 1,
  startedAt: startedAt.getTime(),
  endedAt: startedAt.getTime() + 3_600_000,
  durationSeconds: 3600,
  distanceMeters: 4000,
  steps: 5200,
  maxSpeedKmh: 4.5,
  isActive: false,
  editedAt: null,
  ...overrides,
})

describe("buildHistoryCsv", () => {
  it("writes one row per session, oldest first", () => {
    const csv = buildHistoryCsv(
      [
        session(new Date(2026, 10, 9, 14, 5)),
        session(new Date(2026, 10, 8, 9, 30), {distanceMeters: 2500}),
      ],
      null
    )
    expect(csv).toBe(
      [
        "date,start,end,duration_seconds,distance_km,steps,average_speed_kmh,max_speed_kmh",
        "2026-11-08,09:30,10:30,3600,2.500,5200,2.50,4.5",
        "2026-11-09,14:05,15:05,3600,4.000,5200,4.00,4.5",
        "",
      ].join("\n")
    )
  })

  it("adds the calories when the weight is known", () => {
    const [header, row] = buildHistoryCsv(
      [session(new Date(2026, 10, 9, 14, 5))],
      70
    ).split("\n")
    expect(header.endsWith(",calories_kcal")).toBe(true)
    expect(row.endsWith(",210")).toBe(true)
  })
})
