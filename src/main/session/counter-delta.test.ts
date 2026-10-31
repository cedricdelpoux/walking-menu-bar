import {describe, expect, it} from "vitest"
import {computeCounterDelta, type CounterReading} from "./counter-delta"

const reading = (
  at: number,
  elapsedSeconds: number,
  distanceMeters: number,
  steps: number
): CounterReading => ({
  at: at * 1000,
  elapsedSeconds,
  distanceMeters,
  steps,
})

describe("computeCounterDelta", () => {
  it("counts nothing without a previous reading, since its history is unknown", () => {
    expect(
      computeCounterDelta(undefined, reading(0, 1200, 660, 1320))
    ).toMatchObject({
      elapsedSeconds: 0,
      distanceMeters: 0,
      steps: 0,
    })
  })

  it("returns the difference between two consecutive readings", () => {
    expect(
      computeCounterDelta(
        reading(0, 1195, 660, 1320),
        reading(1, 1196, 670, 1322)
      )
    ).toEqual({
      elapsedSeconds: 1,
      distanceMeters: 10,
      steps: 2,
      countersReset: false,
    })
  })

  it("tolerates the pad clock jumping a few seconds between two polls", () => {
    expect(
      computeCounterDelta(
        reading(0, 1388, 770, 1528),
        reading(1, 1390, 770, 1530)
      ).countersReset
    ).toBe(false)
  })

  it("treats decreasing counters as a reset and counts the new values", () => {
    expect(
      computeCounterDelta(reading(0, 1434, 790, 1568), reading(60, 30, 20, 40))
    ).toEqual({
      elapsedSeconds: 30,
      distanceMeters: 20,
      steps: 40,
      countersReset: true,
    })
  })

  it("detects a reset hidden behind counters that grew past their previous values", () => {
    // Pad turned off and on, then used for 40 min in 10 min of wall clock time is impossible.
    const delta = computeCounterDelta(
      reading(0, 600, 300, 500),
      reading(600, 2400, 1600, 3000)
    )
    expect(delta).toEqual({
      elapsedSeconds: 2400,
      distanceMeters: 1600,
      steps: 3000,
      countersReset: true,
    })
  })

  it("keeps progress made while the app was disconnected", () => {
    const delta = computeCounterDelta(
      reading(0, 600, 300, 500),
      reading(900, 1200, 640, 1100)
    )
    expect(delta).toEqual({
      elapsedSeconds: 600,
      distanceMeters: 340,
      steps: 600,
      countersReset: false,
    })
  })

  it("detects a reset overnight, even when the new counters grew past the old ones", () => {
    // Recorded on 2026-10-20: the dev app last saw the pad the day before, at 1492 s and 810 m.
    const yesterday = {
      at: Date.UTC(2026, 9, 19, 9, 5),
      elapsedSeconds: 1492,
      distanceMeters: 810,
      steps: 1564,
    }
    const thisMorning = {
      at: Date.UTC(2026, 9, 20, 9, 26),
      elapsedSeconds: 4510,
      distanceMeters: 2500,
      steps: 4453,
    }
    expect(computeCounterDelta(yesterday, thisMorning)).toEqual({
      elapsedSeconds: 4510,
      distanceMeters: 2500,
      steps: 4453,
      countersReset: true,
    })
  })
})
