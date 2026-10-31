import {afterEach, beforeEach, describe, expect, it} from "vitest"
import type {PadStatus} from "../pad/protocol/types"
import {AppStateRepository} from "../storage/app-state-repository"
import {openDatabase, type AppDatabase} from "../storage/database"
import {SessionRepository} from "../storage/session-repository"
import {SessionRecorder} from "./session-recorder"

const PAUSE_TIMEOUT_MS = 5 * 60_000
const T0 = Date.UTC(2026, 9, 16, 14, 0, 0)
const at = (seconds: number) => T0 + seconds * 1000

const running = (
  elapsedSeconds: number,
  distanceMeters: number,
  steps: number
): PadStatus => ({
  beltState: "running",
  rawBeltState: 1,
  mode: "manual",
  speedKmh: 3.6,
  elapsedSeconds,
  distanceMeters,
  steps,
})

describe("SessionRecorder", () => {
  let database: AppDatabase
  let sessions: SessionRepository
  let appState: AppStateRepository
  const createRecorder = () =>
    new SessionRecorder(sessions, appState, {pauseTimeoutMs: PAUSE_TIMEOUT_MS})

  beforeEach(() => {
    database = openDatabase(":memory:")
    sessions = new SessionRepository(database)
    appState = new AppStateRepository(database)
  })

  afterEach(() => database.close())

  it("saves the session and its samples after every status", () => {
    const recorder = createRecorder()
    recorder.handleStatus(running(10, 0, 10), at(0))
    recorder.handleStatus(running(11, 10, 12), at(1))
    recorder.handleStatus(running(12, 10, 13), at(2))

    const [stored] = sessions.listSessionsStartedBetween(at(-60), at(60))
    expect(stored).toMatchObject({
      isActive: true,
      durationSeconds: 2,
      distanceMeters: 2,
      steps: 3,
    })
    expect(sessions.listSamples(stored.id)).toHaveLength(3)
  })

  it("resumes the active session after a crash, including progress made meanwhile", () => {
    const beforeCrash = createRecorder()
    beforeCrash.handleStatus(running(100, 50, 100), at(0))
    beforeCrash.handleStatus(running(160, 80, 160), at(60))

    const afterRestart = createRecorder()
    afterRestart.handleStatus(running(220, 110, 220), at(120))

    const stored = sessions.listSessionsStartedBetween(at(-60), at(200))
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      durationSeconds: 120,
      distanceMeters: 120,
      steps: 120,
    })
  })

  it("completes a stale active session on the next tick", () => {
    createRecorder().handleStatus(running(0, 0, 0), at(0))
    const recorder = createRecorder()
    recorder.handleStatus(running(60, 30, 60), at(60))

    const [ended] = recorder.tick(at(61) + PAUSE_TIMEOUT_MS)
    expect(ended.type).toBe("sessionEnded")
    expect(sessions.findActiveSession()).toBeUndefined()
  })

  it("deletes a session with its samples", () => {
    const recorder = createRecorder()
    recorder.handleStatus(running(0, 0, 0), at(0))
    recorder.handleStatus(running(60, 30, 60), at(60))
    recorder.tick(at(61) + PAUSE_TIMEOUT_MS)
    const [stored] = sessions.listSessionsStartedBetween(at(-60), at(60))

    sessions.deleteSession(stored.id)
    expect(sessions.findById(stored.id)).toBeUndefined()
    expect(sessions.listSamples(stored.id)).toEqual([])
  })
})
