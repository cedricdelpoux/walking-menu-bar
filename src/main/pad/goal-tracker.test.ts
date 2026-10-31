import {describe, expect, it} from "vitest"
import type {SessionValues} from "../../shared/session"
import {GoalTracker} from "./goal-tracker"

const at = (seconds: number) => Date.UTC(2026, 9, 19, 9, 0) + seconds * 1000

const sessionAfter = (
  durationSeconds: number,
  distanceMeters: number
): SessionValues => ({
  startedAt: at(0),
  endedAt: at(durationSeconds),
  durationSeconds,
  distanceMeters,
  steps: 0,
  maxSpeedKmh: 3,
})

describe("GoalTracker", () => {
  it("counts what was already walked", () => {
    const tracker = new GoalTracker()
    tracker.setGoal({kind: "distance", targetMeters: 1000})
    expect(tracker.progressOf(sessionAfter(720, 600))).toMatchObject({
      walkedMeters: 600,
      walkedSeconds: 720,
      reachedAt: null,
    })
  })

  it("starts from zero without anything walked yet", () => {
    const tracker = new GoalTracker()
    tracker.setGoal({kind: "duration", targetSeconds: 3600})
    expect(tracker.progressOf(undefined)).toMatchObject({
      walkedMeters: 0,
      walkedSeconds: 0,
    })
  })

  it("remembers when the goal was first reached", () => {
    const tracker = new GoalTracker()
    tracker.setGoal({kind: "duration", targetSeconds: 3600})
    tracker.recordProgress(sessionAfter(3599, 2990), at(3599))
    expect(tracker.reachedAt).toBeNull()

    tracker.recordProgress(sessionAfter(3600, 3000), at(3600))
    tracker.recordProgress(sessionAfter(3601, 3001), at(3601))
    expect(tracker.reachedAt).toBe(at(3600))
  })

  it("is reached at once when set below what was already walked", () => {
    const tracker = new GoalTracker()
    tracker.setGoal({kind: "distance", targetMeters: 500})
    tracker.recordProgress(sessionAfter(720, 600), at(720))
    expect(tracker.reachedAt).toBe(at(720))
  })

  it("forgets the goal and its arrival once removed", () => {
    const tracker = new GoalTracker()
    tracker.setGoal({kind: "distance", targetMeters: 500})
    tracker.recordProgress(sessionAfter(720, 600), at(720))
    tracker.setGoal(null)
    expect(tracker.reachedAt).toBeNull()
    expect(tracker.progressOf(sessionAfter(720, 600))).toBeNull()
  })
})
