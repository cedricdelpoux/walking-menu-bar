import {EventEmitter} from "node:events"
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"
import type {PadStatus} from "../../shared/pad"
import {SessionRecorder} from "../session/session-recorder"
import {AppStateRepository} from "../storage/app-state-repository"
import {openDatabase, type AppDatabase} from "../storage/database"
import {SessionRepository} from "../storage/session-repository"
import type {PadConnection} from "./pad-connection"
import {PadService} from "./pad-service"
import type {PadCommand} from "./protocol/types"

const status = (
  mode: PadStatus["mode"],
  rawBeltState: number,
  beltState: PadStatus["beltState"]
): PadStatus => ({
  mode,
  rawBeltState,
  beltState,
  speedKmh: beltState === "running" ? 2 : 0,
  elapsedSeconds: 0,
  distanceMeters: 0,
  steps: 0,
})

const ASLEEP = status("standby", 4, "standby")
const STARTING_IN_AUTOMATIC = status("automatic", 9, "starting")
const RUNNING_IN_AUTOMATIC = status("automatic", 1, "running")
const RUNNING_IN_MANUAL = status("manual", 1, "running")
const IDLE_IN_AUTOMATIC = status("automatic", 0, "idle")
const STARTING_IN_MANUAL = status("manual", 9, "starting")

class FakeConnection extends EventEmitter {
  sendCommand = vi.fn(async (_command: PadCommand) => undefined)
  getState = () => ({
    kind: "connected" as const,
    padName: "KS-BLC2",
    peripheralId: "id",
    protocolId: "ph4",
  })
}

describe("PadService preferred mode", () => {
  let database: AppDatabase
  let connection: FakeConnection
  let appState: AppStateRepository

  let diagnosticLines: string[]
  let padClockSeconds: number

  const createService = () => {
    const sessions = new SessionRepository(database)
    const recorder = new SessionRecorder(sessions, appState, {
      pauseTimeoutMs: 300_000,
    })
    const diagnostics = {
      write: (message: string) => diagnosticLines.push(message),
    }
    return new PadService(
      connection as unknown as PadConnection,
      recorder,
      sessions,
      appState,
      diagnostics
    )
  }
  const receive = (padStatus: PadStatus) => connection.emit("status", padStatus)
  const sentCommandTypes = () =>
    connection.sendCommand.mock.calls.map(([command]) => command.type)
  const sentStops = () =>
    sentCommandTypes().filter((type) => type === "stop").length
  // Walks at 1 m/s, the clock, the pad time and the pad distance moving together, with a status
  // at least every minute as the pad never stays silent longer while the app is connected.
  const STATUS_INTERVAL_SECONDS = 60
  const walkTo = (meters: number, overrides: Partial<PadStatus> = {}) => {
    while (padClockSeconds + STATUS_INTERVAL_SECONDS < meters) {
      vi.advanceTimersByTime(STATUS_INTERVAL_SECONDS * 1000)
      padClockSeconds += STATUS_INTERVAL_SECONDS
      receive({
        ...RUNNING_IN_MANUAL,
        speedKmh: 3.6,
        elapsedSeconds: padClockSeconds,
        distanceMeters: padClockSeconds,
        rawLastRemoteButton: overrides.rawLastRemoteButton,
      })
    }
    vi.advanceTimersByTime(Math.max(0, meters - padClockSeconds) * 1000)
    padClockSeconds = Math.max(padClockSeconds, meters)
    receive({
      ...RUNNING_IN_MANUAL,
      speedKmh: 3.6,
      elapsedSeconds: padClockSeconds,
      distanceMeters: meters,
      ...overrides,
    })
  }
  const stopAt = (meters: number, overrides: Partial<PadStatus> = {}) =>
    walkTo(meters, {
      beltState: "idle",
      rawBeltState: 0,
      speedKmh: 0,
      ...overrides,
    })
  const sentModes = () =>
    connection.sendCommand.mock.calls
      .map(([command]) => command)
      .flatMap((command) => (command.type === "setMode" ? [command.mode] : []))

  beforeEach(() => {
    vi.useFakeTimers({now: new Date(2026, 9, 19, 10, 30)})
    database = openDatabase(":memory:")
    appState = new AppStateRepository(database)
    connection = new FakeConnection()
    diagnosticLines = []
    padClockSeconds = 0
  })

  afterEach(() => {
    database.close()
    vi.useRealTimers()
  })

  it("switches a pad that wakes up in automatic mode back to manual", async () => {
    const service = createService()
    receive(ASLEEP)
    await service.startBelt()
    expect(sentModes()).toEqual([])

    receive(STARTING_IN_AUTOMATIC)
    expect(sentModes()).toEqual(["manual"])

    vi.advanceTimersByTime(1000)
    receive(STARTING_IN_AUTOMATIC)
    expect(sentModes()).toEqual(["manual"])

    vi.advanceTimersByTime(1000)
    receive(RUNNING_IN_AUTOMATIC)
    expect(sentModes()).toEqual(["manual", "manual"])

    receive(RUNNING_IN_MANUAL)
    vi.advanceTimersByTime(5000)
    receive(RUNNING_IN_AUTOMATIC)
    expect(sentModes()).toEqual(["manual", "manual"])
  })

  describe("resuming a paused session", () => {
    const runAt = (speedKmh: number, fromSecond: number, toSecond: number) => {
      for (let second = fromSecond; second <= toSecond; second++) {
        vi.advanceTimersByTime(1000)
        receive({
          ...RUNNING_IN_MANUAL,
          speedKmh,
          elapsedSeconds: second,
          steps: second,
        })
      }
    }
    const sentSpeeds = () =>
      connection.sendCommand.mock.calls
        .map(([command]) => command)
        .flatMap((command) =>
          command.type === "setSpeed" ? [command.speedKmh] : []
        )

    it("goes back to the speed walked before the pause, not the start speed of the pad", async () => {
      const service = createService()
      connection.emit("state", connection.getState())
      runAt(3, 1, 20)
      await service.pauseBelt()
      runAt(1.4, 21, 21)
      runAt(0.8, 22, 22)
      receive({
        ...IDLE_IN_AUTOMATIC,
        mode: "manual",
        elapsedSeconds: 22,
        steps: 22,
      })

      await service.startBelt()
      receive({...STARTING_IN_MANUAL, elapsedSeconds: 22, steps: 22})
      vi.advanceTimersByTime(1000)
      receive({
        ...RUNNING_IN_MANUAL,
        speedKmh: 2,
        elapsedSeconds: 22,
        steps: 22,
      })
      expect(sentSpeeds()).toEqual([3])
      expect(diagnosticLines).toContain(
        "command setSpeed 3km/h reason=resumeSpeedRestore"
      )

      runAt(3, 23, 30)
      expect(sentSpeeds()).toEqual([3])
    })

    it("leaves the start speed of the pad alone for a new session", async () => {
      const service = createService()
      connection.emit("state", connection.getState())
      await service.startBelt()
      receive({...STARTING_IN_MANUAL})
      runAt(2, 1, 5)
      expect(sentSpeeds()).toEqual([])
    })
  })

  describe("stops made by the pad", () => {
    const walkSeconds = (
      fromSecond: number,
      toSecond: number,
      stepsAt: (second: number) => number
    ) => {
      for (let second = fromSecond; second <= toSecond; second++) {
        vi.advanceTimersByTime(1000)
        receive({
          ...RUNNING_IN_MANUAL,
          speedKmh: 2,
          elapsedSeconds: second,
          steps: stepsAt(second),
        })
      }
    }

    it("tells that the pad stopped after sensing no step for a few seconds", () => {
      const service = createService()
      walkSeconds(1, 30, (second) => Math.min(second, 20))
      vi.advanceTimersByTime(1000)
      receive({
        ...IDLE_IN_AUTOMATIC,
        mode: "manual",
        elapsedSeconds: 30,
        steps: 20,
      })

      expect(service.getLiveState().padStop).toMatchObject({cause: "noSteps"})
      expect(
        diagnosticLines.some((line) =>
          line.startsWith("pad stopped on its own: noSteps")
        )
      ).toBe(true)

      receive({...STARTING_IN_MANUAL})
      expect(service.getLiveState().padStop).toBeNull()
    })

    it("tells that the pad or its remote stopped the belt while steps were counted", () => {
      const service = createService()
      walkSeconds(1, 30, (second) => second)
      vi.advanceTimersByTime(1000)
      receive({
        ...IDLE_IN_AUTOMATIC,
        mode: "manual",
        elapsedSeconds: 30,
        steps: 30,
      })
      expect(service.getLiveState().padStop).toMatchObject({
        cause: "padOrRemote",
      })
    })

    it("says nothing when the app asked for the stop", async () => {
      const service = createService()
      walkSeconds(1, 30, (second) => Math.min(second, 20))
      await service.pauseBelt()
      receive({
        ...IDLE_IN_AUTOMATIC,
        mode: "manual",
        elapsedSeconds: 30,
        steps: 20,
      })
      expect(service.getLiveState().padStop).toBeNull()
    })
  })

  it("remembers the mode chosen in the app and shows it while the pad sleeps", async () => {
    await createService().setMode("automatic")
    const service = createService()
    receive(ASLEEP)
    expect(service.getLiveState().preferredMode).toBe("automatic")
  })

  it("stops the belt once when the goal is reached, and forgets it on the next start", async () => {
    const service = createService()
    walkTo(0)
    service.setGoal("session", {kind: "distance", targetMeters: 1000})
    walkTo(990)
    expect(sentStops()).toBe(0)

    walkTo(1000)
    walkTo(1001)
    expect(sentStops()).toBe(1)

    walkTo(1004)
    expect(sentStops()).toBe(2)

    walkTo(1100)
    expect(sentStops()).toBe(2)

    await service.startBelt()
    expect(service.getLiveState().goals.session).toBeNull()
  })

  it("counts the distance the session already walked towards a new goal", () => {
    const service = createService()
    walkTo(0)
    walkTo(600)

    service.setGoal("session", {kind: "distance", targetMeters: 1000})
    expect(service.getLiveState().goals.session).toMatchObject({
      walkedMeters: 600,
      reachedAt: null,
    })

    service.setGoal("session", {kind: "distance", targetMeters: 500})
    expect(sentStops()).toBe(1)
  })

  it("keeps a pending goal across restarts, but not a reached one", () => {
    createService().setGoal("session", {kind: "distance", targetMeters: 1000})
    const restarted = createService()
    expect(restarted.getLiveState().goals.session?.goal).toEqual({
      kind: "distance",
      targetMeters: 1000,
    })

    walkTo(0)
    walkTo(1000)
    expect(createService().getLiveState().goals.session).toBeNull()
  })

  it("keeps asking a sleeping pad to start until its belt starts", async () => {
    const service = createService()
    receive(ASLEEP)
    await service.startBelt()
    expect(service.getLiveState().startRequest).toBe("pending")

    vi.advanceTimersByTime(2000)
    receive(ASLEEP)
    expect(sentCommandTypes()).toEqual(["start"])

    vi.advanceTimersByTime(1000)
    receive(ASLEEP)
    expect(sentCommandTypes()).toEqual(["start", "start"])

    vi.advanceTimersByTime(3000)
    receive(IDLE_IN_AUTOMATIC)
    await vi.waitFor(() =>
      expect(sentCommandTypes()).toEqual(["start", "start", "setMode", "start"])
    )

    receive(STARTING_IN_MANUAL)
    expect(service.getLiveState().startRequest).toBeNull()
  })

  it("reports a pad that does not wake up", async () => {
    const service = createService()
    receive(ASLEEP)
    await service.startBelt()
    vi.advanceTimersByTime(21_000)
    receive(ASLEEP)
    expect(service.getLiveState().startRequest).toBe("failed")

    await service.stopBelt()
    expect(service.getLiveState().startRequest).toBeNull()
  })

  it("cancels a pending start when asked to stop", async () => {
    const service = createService()
    receive(ASLEEP)
    await service.startBelt()
    await service.stopBelt()
    vi.advanceTimersByTime(5000)
    receive(IDLE_IN_AUTOMATIC)
    expect(sentCommandTypes()).toEqual(["start", "stop"])
  })

  it("logs why the belt stopped", () => {
    const service = createService()
    const remoteFaster = {rawLastRemoteButton: 2}
    walkTo(0, remoteFaster)
    walkTo(500, remoteFaster)
    service.setGoal("session", {kind: "distance", targetMeters: 1000})
    walkTo(1000, remoteFaster)
    stopAt(1000, remoteFaster)
    stopAt(1000, {rawLastRemoteButton: 3})

    expect(diagnosticLines).toEqual([
      "status belt=running(1) mode=manual lastRemoteButton=faster speed=3.6km/h time=0s distance=0m steps=0",
      "session started",
      "session goal set to 1000m",
      "session goal reached after 1000s 1000m",
      "command stop reason=goalReached",
      "status belt=idle(0) mode=manual lastRemoteButton=faster speed=0km/h time=1000s distance=1000m steps=0",
      "status belt=idle(0) mode=manual lastRemoteButton=stop speed=0km/h time=1000s distance=1000m steps=0",
    ])
  })

  it("pauses the belt and keeps the session open until the pause timeout", async () => {
    const service = createService()
    walkTo(0)
    walkTo(300)
    expect(service.getLiveState().sessionEndsAt).toBeNull()

    await service.pauseBelt()
    walkTo(305, {speedKmh: 1.3})
    expect(service.getLiveState().isStopping).toBe(true)

    stopAt(310)
    expect(service.getLiveState().isStopping).toBe(false)
    expect(sentCommandTypes()).toEqual(["stop"])
    expect(service.getLiveState()).toMatchObject({
      currentSession: {distanceMeters: 310},
      sessionEndsAt: Date.now() + 300_000,
    })
  })

  it("ends the session once the belt has stopped, counting the slowdown", async () => {
    const service = createService()
    walkTo(0)
    walkTo(500)

    await service.endSession()
    walkTo(510)
    expect(service.getLiveState().currentSession).toMatchObject({
      distanceMeters: 510,
    })

    stopAt(520)
    expect(service.getLiveState().currentSession).toBeNull()
    expect(diagnosticLines).toContain("command stop reason=endSessionRequest")
    expect(diagnosticLines).toContain("session ended 520s 520m 0 steps")

    walkTo(530)
    expect(service.getLiveState().currentSession).toMatchObject({
      distanceMeters: 10,
    })
  })

  it("ends a paused session right away", async () => {
    const service = createService()
    walkTo(0)
    walkTo(200)
    stopAt(200)

    await service.endSession()
    expect(service.getLiveState().currentSession).toBeNull()
    expect(sentCommandTypes()).toEqual([])
  })

  it("stops the belt when the day total reaches its goal, across sessions", async () => {
    const service = createService()
    walkTo(0)
    walkTo(1370)
    stopAt(1370)
    await service.endSession()

    service.setGoal("day", {kind: "distance", targetMeters: 2000})
    expect(service.getLiveState().goals.day).toMatchObject({
      walkedMeters: 1370,
      reachedAt: null,
    })

    walkTo(1380)
    walkTo(2000)
    expect(service.getLiveState().goals.day).toMatchObject({walkedMeters: 2000})
    expect(sentStops()).toBe(1)
    expect(diagnosticLines).toContain("day goal reached after 2000s 2000m")
  })

  it("drops the session goal when its session ends", async () => {
    const service = createService()
    walkTo(0)
    walkTo(300)
    service.setGoal("session", {kind: "distance", targetMeters: 1000})
    stopAt(300)

    await service.endSession()
    expect(service.getLiveState().goals.session).toBeNull()
    expect(createService().getLiveState().goals.session).toBeNull()
  })

  it("forgets a day goal set on a previous day", () => {
    createService().setGoal("day", {kind: "distance", targetMeters: 5000})
    vi.advanceTimersByTime(24 * 3600_000)
    expect(createService().getLiveState().goals.day).toBeNull()
  })

  it("leaves a mode chosen with the remote alone once the start is over", async () => {
    const service = createService()
    receive(RUNNING_IN_MANUAL)
    await service.startBelt()
    receive(RUNNING_IN_MANUAL)

    vi.advanceTimersByTime(20_000)
    receive(RUNNING_IN_AUTOMATIC)
    expect(sentModes()).toEqual([])
  })
})
