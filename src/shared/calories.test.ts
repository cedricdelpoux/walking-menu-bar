import {describe, expect, it} from "vitest"
import {estimateCalories, getWalkingMet} from "./calories"

describe("getWalkingMet", () => {
  it("picks the MET of the speed band", () => {
    expect(getWalkingMet(0)).toBe(2)
    expect(getWalkingMet(3.19)).toBe(2)
    expect(getWalkingMet(3.2)).toBe(2.8)
    expect(getWalkingMet(4.5)).toBe(3)
    expect(getWalkingMet(6)).toBe(4.3)
    expect(getWalkingMet(9)).toBe(7)
  })
})

describe("estimateCalories", () => {
  it("multiplies the MET by the weight and the hours walked", () => {
    expect(
      estimateCalories({durationSeconds: 3600, distanceMeters: 4000}, 70)
    ).toBe(210)
  })

  it("is zero without any walking time", () => {
    expect(estimateCalories({durationSeconds: 0, distanceMeters: 0}, 70)).toBe(
      0
    )
  })
})
