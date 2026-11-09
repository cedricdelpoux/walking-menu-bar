import {describe, expect, it} from "vitest"
import type {PadStatus} from "../../shared/pad"
import {PlateauTracker} from "./plateau-tracker"

const running = (speedKmh: number): PadStatus => ({
  beltState: "running",
  rawBeltState: 1,
  mode: "manual",
  speedKmh,
  elapsedSeconds: 0,
  distanceMeters: 0,
  steps: 0,
})
const idle: PadStatus = {...running(0), beltState: "idle", rawBeltState: 0}

function feed(
  tracker: PlateauTracker,
  statuses: Array<PadStatus | number>,
  startAt = 0
) {
  let now = startAt
  for (const status of statuses) {
    if (typeof status === "number") now += status * 1000
    else {
      now += 1000
      tracker.update(status, now)
    }
  }
  return now
}

const walkedSeconds = (tracker: PlateauTracker, now: number) => {
  const plateau = tracker.current!
  return (
    (plateau.walkedMs +
      (plateau.walkingSince === null ? 0 : now - plateau.walkingSince)) /
    1000
  )
}

describe("PlateauTracker", () => {
  it("starts a plateau once a speed is held for a few seconds", () => {
    const tracker = new PlateauTracker()
    feed(tracker, [running(2.7), running(2), running(2)])
    expect(tracker.current).toBeNull()
    const now = feed(tracker, [running(2), running(2)], 3000)
    expect(tracker.current?.speedKmh).toBe(2)
    expect(walkedSeconds(tracker, now)).toBe(3)
  })

  it("carries a plateau over a pause, without its slowdown nor the restart of the pad", () => {
    const tracker = new PlateauTracker()
    let now = feed(tracker, Array(121).fill(running(3)))
    const walkedBeforePause = walkedSeconds(tracker, now)
    now = feed(
      tracker,
      [
        running(1.4),
        running(0.8),
        idle,
        600,
        idle,
        running(2.7),
        running(2),
        running(2.5),
        running(3),
      ],
      now
    )
    expect(tracker.current?.speedKmh).toBe(3)
    expect(walkedSeconds(tracker, now)).toBeCloseTo(walkedBeforePause + 1, 0)
  })

  it("starts over once another speed is held", () => {
    const tracker = new PlateauTracker()
    let now = feed(tracker, Array(60).fill(running(3)))
    now = feed(tracker, Array(4).fill(running(2.5)), now)
    expect(tracker.current?.speedKmh).toBe(2.5)
    expect(walkedSeconds(tracker, now)).toBe(3)
  })

  it("saves the plateau frozen at the given time", () => {
    const tracker = new PlateauTracker()
    const now = feed(tracker, [
      running(3),
      running(3),
      running(3),
      running(3),
      10,
    ])
    const restored = new PlateauTracker(tracker.toSaved(now))
    expect(restored.current).toEqual({
      speedKmh: 3,
      walkedMs: 13_000,
      walkingSince: null,
    })
  })
})
