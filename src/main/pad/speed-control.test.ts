import {describe, expect, it} from "vitest"
import {identifyPadModel} from "./pad-models"
import {nextTargetSpeed} from "./speed-control"

const c2 = identifyPadModel("KS-BLC2")

describe("identifyPadModel", () => {
  it("recognizes the C2 from its advertised name", () => {
    expect(c2).toMatchObject({id: "c2", minSpeedKmh: 0.5, maxSpeedKmh: 6})
  })

  it("falls back to a safe range for unknown pads", () => {
    expect(identifyPadModel("KS-XYZ")).toEqual({
      id: "unknown",
      name: "KS-XYZ",
      minSpeedKmh: 0.5,
      maxSpeedKmh: 6,
    })
  })
})

describe("nextTargetSpeed", () => {
  it("moves by 0.5 km/h from a speed on the grid", () => {
    expect(nextTargetSpeed(2, 1, c2)).toBe(2.5)
    expect(nextTargetSpeed(2, -1, c2)).toBe(1.5)
  })

  it("snaps to the grid from an intermediate speed", () => {
    expect(nextTargetSpeed(2.2, 1, c2)).toBe(2.5)
    expect(nextTargetSpeed(2.2, -1, c2)).toBe(2)
    expect(nextTargetSpeed(2.3000000001, -1, c2)).toBe(2)
  })

  it("stays within the model range", () => {
    expect(nextTargetSpeed(6, 1, c2)).toBe(6)
    expect(nextTargetSpeed(0.5, -1, c2)).toBe(0.5)
    expect(nextTargetSpeed(0, 1, c2)).toBe(0.5)
  })
})
