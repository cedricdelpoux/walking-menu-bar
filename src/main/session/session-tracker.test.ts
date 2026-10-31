import {describe, expect, it} from "vitest"
import type {BeltState, PadStatus} from "../pad/protocol/types"
import {SessionTracker, type TrackerEvent} from "./session-tracker"

const PAUSE_TIMEOUT_MS = 5 * 60_000
const T0 = Date.UTC(2026, 9, 16, 14, 0, 0)

const status = (
  beltState: BeltState,
  speedKmh: number,
  elapsedSeconds: number,
  distanceMeters: number,
  steps: number
): PadStatus => ({
  beltState,
  rawBeltState: beltState === "running" ? 1 : 0,
  mode: "manual",
  speedKmh,
  elapsedSeconds,
  distanceMeters,
  steps,
})

const at = (seconds: number) => T0 + seconds * 1000
const typesOf = (events: TrackerEvent[]) => events.map((event) => event.type)

describe("SessionTracker", () => {
  it("starts a session when the belt runs, counting the distance from the belt speed and the steps from the pad", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    expect(tracker.handleStatus(status("idle", 0, 100, 50, 80), at(0))).toEqual(
      []
    )

    expect(
      typesOf(tracker.handleStatus(status("running", 3.6, 101, 60, 82), at(1)))
    ).toEqual(["sessionStarted", "sessionProgressed"])
    tracker.handleStatus(status("running", 3.6, 102, 60, 83), at(2))

    expect(tracker.currentSession).toMatchObject({
      startedAt: at(0),
      endedAt: at(2),
      durationSeconds: 2,
      distanceMeters: 2,
      steps: 3,
    })
  })

  it("counts each second at the last steady speed, ignoring the burst when the belt starts", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    const speedsKmh = [2, 2, 2, 2, 0, 0, 2.8, 2.2, 2, 2, 2]
    let elapsedSeconds = 0
    speedsKmh.forEach((speedKmh, second) => {
      if (speedKmh > 0) elapsedSeconds++
      tracker.handleStatus(
        status(
          speedKmh > 0 ? "running" : "idle",
          speedKmh,
          elapsedSeconds,
          0,
          0
        ),
        at(second)
      )
    })
    const session = tracker.currentSession!
    expect(
      (session.distanceMeters / session.durationSeconds) * 3.6
    ).toBeCloseTo(2, 6)
  })

  it("counts the burst of the very first start at the steady speed once it is known", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    const speedsKmh = [3, 2.5, 2, 2, 2]
    speedsKmh.forEach((speedKmh, second) =>
      tracker.handleStatus(
        status("running", speedKmh, second + 1, 0, 0),
        at(second)
      )
    )
    const session = tracker.currentSession!
    expect(session.durationSeconds).toBe(4)
    expect(session.distanceMeters).toBeCloseTo((4 * 2) / 3.6, 9)
  })

  it("averages two speeds walked for the same time", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    for (let second = 0; second <= 600; second++) {
      tracker.handleStatus(
        status("running", second < 300 ? 2 : 3, second, 0, 0),
        at(second)
      )
    }
    const session = tracker.currentSession!
    expect(
      (session.distanceMeters / session.durationSeconds) * 3.6
    ).toBeCloseTo(2.5, 2)
  })

  it("does not count the countdown and keeps a short stop in the same session", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    tracker.handleStatus(status("running", 2, 1430, 790, 1560), at(0))
    tracker.handleStatus(status("running", 2, 1434, 790, 1568), at(4))
    tracker.handleStatus(status("idle", 0, 1434, 790, 1568), at(10))
    expect(
      tracker.handleStatus(status("starting", 0, 1434, 790, 1568), at(12))
    ).toEqual([])

    const events = tracker.handleStatus(
      status("running", 2, 1436, 790, 1568),
      at(15)
    )
    expect(typesOf(events)).toEqual(["sessionProgressed"])
    expect(tracker.currentSession?.durationSeconds).toBe(6)
  })

  it("ends the session at the last activity once the pause exceeds the timeout", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    tracker.handleStatus(status("running", 2, 0, 0, 0), at(0))
    tracker.handleStatus(status("running", 2, 600, 330, 600), at(600))
    tracker.handleStatus(status("idle", 0, 600, 330, 600), at(610))

    expect(tracker.tick(at(600) + PAUSE_TIMEOUT_MS)).toEqual([])
    const [ended] = tracker.tick(at(601) + PAUSE_TIMEOUT_MS)
    expect(ended).toMatchObject({
      type: "sessionEnded",
      session: {endedAt: at(600), durationSeconds: 600},
    })
    expect(tracker.currentSession).toBeUndefined()

    const restart = tracker.handleStatus(
      status("running", 2, 601, 330, 601),
      at(1000)
    )
    expect(typesOf(restart)).toEqual(["sessionStarted", "sessionProgressed"])
  })

  it("ignores a one-second speed spike when computing the max speed", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    const speeds = [3, 2.3, 2, 2, 2, 2.5, 2.5, 2.5, 2.2, 2]
    speeds.forEach((speed, second) =>
      tracker.handleStatus(
        status("running", speed, second, second * 6, second),
        at(second)
      )
    )
    expect(tracker.currentSession?.maxSpeedKmh).toBe(2.5)
  })

  it("falls back to the average speed for sessions too short to sustain one", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    tracker.handleStatus(status("running", 3, 0, 0, 0), at(0))
    tracker.handleStatus(status("idle", 0, 60, 40, 60), at(60))
    const [ended] = tracker.tick(at(61) + PAUSE_TIMEOUT_MS)
    expect(ended.session.maxSpeedKmh).toBe(2.4)
  })

  it("back-dates a session made of progress the app missed while disconnected", () => {
    const tracker = new SessionTracker(
      {pauseTimeoutMs: PAUSE_TIMEOUT_MS},
      {counters: {at: at(0), elapsedSeconds: 0, distanceMeters: 0, steps: 0}}
    )
    const events = tracker.handleStatus(
      status("idle", 0, 900, 500, 900),
      at(3600)
    )
    expect(events[0]).toMatchObject({
      type: "sessionStarted",
      session: {startedAt: at(2700)},
    })
    expect(tracker.currentSession).toMatchObject({
      durationSeconds: 900,
      distanceMeters: 500,
    })
  })

  it("counts a counter reset without losing the progress made since", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    tracker.handleStatus(status("running", 3.6, 1000, 550, 1000), at(0))
    tracker.handleStatus(status("running", 3.6, 1001, 560, 1001), at(1))
    tracker.handleStatus(status("running", 3.6, 5, 0, 4), at(30))
    expect(tracker.currentSession).toMatchObject({
      durationSeconds: 6,
      distanceMeters: 6,
      steps: 5,
    })
  })

  it("ends the session on request, at its last activity", () => {
    const tracker = new SessionTracker({pauseTimeoutMs: PAUSE_TIMEOUT_MS})
    tracker.handleStatus(status("running", 2, 0, 0, 0), at(0))
    tracker.handleStatus(status("running", 2, 120, 70, 120), at(120))
    tracker.handleStatus(status("idle", 0, 120, 70, 120), at(130))

    const [ended] = tracker.endSession()
    expect(ended).toMatchObject({
      type: "sessionEnded",
      session: {endedAt: at(120), durationSeconds: 120},
    })
    expect(tracker.currentSession).toBeUndefined()
    expect(tracker.endSession()).toEqual([])

    const restart = tracker.handleStatus(
      status("running", 2, 121, 70, 121),
      at(140)
    )
    expect(restart.map((event) => event.type)).toEqual([
      "sessionStarted",
      "sessionProgressed",
    ])
  })
})
