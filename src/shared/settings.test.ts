import {describe, expect, it} from "vitest"
import {speedsInRange} from "./pad"
import {DEFAULT_SETTINGS, sanitizeSpeedShortcuts} from "./settings"

describe("speed shortcuts", () => {
  it("offers every belt step of the pad range", () => {
    expect(speedsInRange({minSpeedKmh: 0.5, maxSpeedKmh: 6})).toHaveLength(12)
    expect(speedsInRange({minSpeedKmh: 1, maxSpeedKmh: 2.5})).toEqual([
      1, 1.5, 2, 2.5,
    ])
  })

  it("keeps at most six sorted belt steps", () => {
    expect(sanitizeSpeedShortcuts([4, 2, 2, 2.4, 6, 5, 3, 1])).toEqual([
      1, 2, 2.5, 3, 4, 5,
    ])
    expect(sanitizeSpeedShortcuts([])).toEqual([])
    expect(sanitizeSpeedShortcuts("2,3")).toEqual(
      DEFAULT_SETTINGS.speedShortcutsKmh
    )
  })
})
