import {describe, expect, it} from "vitest"
import {goalPresets, isGoalAhead} from "./goal"

describe("goal presets", () => {
  it("offers the next whole kilometres above the distance walked", () => {
    expect(
      goalPresets("distance", {distanceMeters: 0, durationSeconds: 0})
    ).toEqual([1, 2, 3])
    expect(
      goalPresets("distance", {distanceMeters: 4500, durationSeconds: 0})
    ).toEqual([5, 6, 7])
    expect(
      goalPresets("distance", {distanceMeters: 5000, durationSeconds: 0})
    ).toEqual([6, 7, 8])
  })

  it("offers the next quarter hours above the time walked, from 30 minutes", () => {
    expect(
      goalPresets("duration", {distanceMeters: 0, durationSeconds: 0})
    ).toEqual([30, 45, 60])
    expect(
      goalPresets("duration", {distanceMeters: 0, durationSeconds: 50 * 60})
    ).toEqual([60, 75, 90])
  })

  it("refuses a goal already walked", () => {
    const walked = {distanceMeters: 4500, durationSeconds: 3000}
    expect(isGoalAhead({kind: "distance", targetMeters: 4000}, walked)).toBe(
      false
    )
    expect(isGoalAhead({kind: "distance", targetMeters: 5000}, walked)).toBe(
      true
    )
    expect(isGoalAhead({kind: "duration", targetSeconds: 3000}, walked)).toBe(
      false
    )
  })
})
