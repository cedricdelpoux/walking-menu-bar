import {describe, expect, it} from "vitest"
import {goalPresets, isGoalAhead, projectGoal} from "./goal"

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

describe("projectGoal", () => {
  const walked = {walkedMeters: 2270, walkedSeconds: 4092, reachedAt: null}

  it("tells how long the rest of a distance takes at the current speed", () => {
    const projection = projectGoal(
      {...walked, goal: {kind: "distance", targetMeters: 2500}},
      2
    )
    expect(projection?.remainingSeconds).toBeCloseTo(414)
    expect(projection?.distanceAtEndMeters).toBe(2500)
  })

  it("tells the distance walked when a time goal ends", () => {
    const projection = projectGoal(
      {...walked, goal: {kind: "duration", targetSeconds: 4992}},
      3.6
    )
    expect(projection).toEqual({
      remainingSeconds: 900,
      distanceAtEndMeters: 3170,
    })
  })

  it("has nothing to tell while the belt is stopped", () => {
    expect(
      projectGoal({...walked, goal: {kind: "distance", targetMeters: 2500}}, 0)
    ).toBeNull()
  })
})
