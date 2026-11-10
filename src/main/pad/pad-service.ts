import {EventEmitter} from "node:events"
import {
  addDays,
  dayKeyOf,
  startOfDay,
  summarizeSessions,
  type DayKey,
  type DaySummary,
} from "../../shared/day"
import {
  GOAL_SCOPES,
  type GoalScope,
  type WalkGoal,
  type WalkedTotals,
} from "../../shared/goal"
import type {LiveState, StartRequestState} from "../../shared/ipc"
import type {
  PadConnectionState,
  PadModel,
  PadStatus,
  PadStop,
  Plateau,
  SelectableMode,
} from "../../shared/pad"
import {
  describeCommand,
  describeConnectionState,
  describeGoal,
  describeSession,
  describeStatus,
  statusChangeKey,
} from "../diagnostics/describe"
import {
  silentDiagnostics,
  type DiagnosticSink,
} from "../diagnostics/diagnostic-log"
import type {SessionRecorder} from "../session/session-recorder"
import type {TrackerEvent} from "../session/session-tracker"
import type {AppStateRepository} from "../storage/app-state-repository"
import type {SessionRepository} from "../storage/session-repository"
import {GoalTracker} from "./goal-tracker"
import {PlateauTracker} from "./plateau-tracker"
import type {PadConnection} from "./pad-connection"
import {identifyPadModel} from "./pad-models"
import type {PadCommand} from "./protocol/types"
import {clampToModel, nextTargetSpeed} from "./speed-control"

export const PERIPHERAL_ID_KEY = "padPeripheralId"
export const PREFERRED_MODE_KEY = "padPreferredMode"
export const PLATEAU_KEY = "padPlateau"
export const WALK_GOAL_KEYS: Record<GoalScope, string> = {
  session: "walkGoal",
  day: "dayWalkGoal",
}

const TICK_INTERVAL_MS = 15_000
// Successive presses build on the requested speed while the belt is still ramping to it.
const TARGET_SPEED_HOLD_MS = 3000
// The pad stops on its own about 5 s after its last sensed step, even in manual mode.
const PAD_STOP_WITHOUT_STEPS_MS = 4000
const RESUME_SPEED_TIMEOUT_MS = 20_000
const HISTORY_PROGRESS_THROTTLE_MS = 10_000
// The C2 wakes up in automatic mode, so the preferred mode is sent again once it is awake, but
// only right after a start: a mode chosen with the remote afterwards must not be overridden.
const PREFERRED_MODE_ENFORCEMENT_MS = 15_000
const MODE_CORRECTION_INTERVAL_MS = 2000
// Past this delay a reached goal no longer stops the belt, so restarting it with the remote works.
const GOAL_STOP_WINDOW_MS = 30_000
const GOAL_STOP_RETRY_INTERVAL_MS = 3000
// A sleeping pad takes a few seconds to wake up and ignores the commands it receives meanwhile.
const START_RETRY_INTERVAL_MS = 3000
const WAKE_UP_TIMEOUT_MS = 20_000

type CommandReason =
  | "userRequest"
  | "pauseRequest"
  | "endSessionRequest"
  | "wakeUpRetry"
  | "preferredModeRestore"
  | "goalReached"
  | "resumeSpeedRestore"

const isBeltMoving = (status: PadStatus | null) =>
  status?.beltState === "running" || status?.beltState === "starting"

interface PadServiceEvents {
  liveState: [LiveState]
  historyChanged: []
  sessionEnded: []
}

export class PadService extends EventEmitter<PadServiceEvents> {
  private status: PadStatus | null = null
  private model: PadModel | null = null
  private targetSpeed: {speedKmh: number; requestedAt: number} | null = null
  private readonly plateauTracker: PlateauTracker
  private resumeSpeed: {
    speedKmh: number
    requestedAt: number
    lastAttemptAt: number
  } | null = null
  private lastStep: {steps: number; at: number} | null = null
  private padStop: PadStop | null = null
  private tickTimer: NodeJS.Timeout | undefined
  private lastHistoryProgressAt = 0
  private preferredMode: SelectableMode
  private enforcePreferredModeUntil = 0
  private lastModeCorrectionAt = 0
  private readonly goalTrackers: Record<GoalScope, GoalTracker> = {
    session: new GoalTracker(),
    day: new GoalTracker(),
  }
  private lastGoalStopAttemptAt = 0
  private pendingStart: {requestedAt: number; lastAttemptAt: number} | null =
    null
  private hasStartFailed = false
  private lastLoggedStatusKey: string | null = null
  private shouldEndSessionWhenBeltStops = false
  private isStopRequested = false

  constructor(
    private readonly connection: PadConnection,
    private readonly recorder: SessionRecorder,
    private readonly sessions: SessionRepository,
    private readonly appState: AppStateRepository,
    private readonly diagnostics: DiagnosticSink = silentDiagnostics
  ) {
    super()
    this.preferredMode =
      appState.get<SelectableMode>(PREFERRED_MODE_KEY) ?? "manual"
    this.goalTrackers.session.setGoal(
      appState.get<WalkGoal>(WALK_GOAL_KEYS.session) ?? null
    )
    const savedDayGoal = appState.get<{day: DayKey; goal: WalkGoal}>(
      WALK_GOAL_KEYS.day
    )
    if (savedDayGoal?.day === dayKeyOf(Date.now()))
      this.goalTrackers.day.setGoal(savedDayGoal.goal)
    this.plateauTracker = new PlateauTracker(
      recorder.currentSession
        ? (appState.get<Plateau>(PLATEAU_KEY) ?? null)
        : null
    )
    connection.on("state", (state) => this.handleConnectionState(state))
    connection.on("status", (status) => this.handleStatus(status))
  }

  start(): void {
    this.connection.start()
    clearInterval(this.tickTimer)
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS)
  }

  async shutdown(): Promise<void> {
    clearInterval(this.tickTimer)
    await this.connection.release()
  }

  async suspend(): Promise<void> {
    this.diagnostics.write("mac going to sleep")
    await this.connection.stop()
  }

  resume(): void {
    this.diagnostics.write("mac woke up")
    this.tick()
    this.connection.start()
  }

  setPauseTimeout(minutes: number): void {
    this.recorder.setPauseTimeout(minutes * 60_000)
    this.tick()
  }

  getLiveState(): LiveState {
    const today = this.summarizeToday()
    return {
      connection: this.connection.getState(),
      model: this.model,
      status: this.status,
      targetSpeedKmh: this.activeTargetSpeed(),
      preferredMode: this.preferredMode,
      startRequest: this.startRequestState(),
      goals: {
        session: this.goalTrackers.session.progressOf(
          this.recorder.currentSession
        ),
        day: this.goalTrackers.day.progressOf(today),
      },
      currentSession: this.recorder.currentSession ?? null,
      plateau: this.plateauTracker.current,
      padStop: this.padStop,
      sessionEndsAt: this.automaticSessionEnd(),
      isStopping: this.isStopRequested && isBeltMoving(this.status),
      today,
    }
  }

  async startBelt(): Promise<void> {
    for (const scope of GOAL_SCOPES) {
      if (this.goalTrackers[scope].reachedAt !== null)
        this.replaceGoal(scope, null)
    }
    const now = Date.now()
    this.enforcePreferredModeUntil = now + PREFERRED_MODE_ENFORCEMENT_MS
    this.pendingStart = {requestedAt: now, lastAttemptAt: now}
    this.hasStartFailed = false
    this.isStopRequested = false
    // The pad always starts at its own start speed: a resumed session goes back to its speed.
    const plateauSpeedKmh = this.plateauTracker.current?.speedKmh
    const {model} = this
    const isResuming =
      this.recorder.currentSession !== undefined &&
      plateauSpeedKmh !== undefined &&
      model !== null
    this.resumeSpeed = isResuming
      ? {
          speedKmh: clampToModel(plateauSpeedKmh, model),
          requestedAt: now,
          lastAttemptAt: 0,
        }
      : null
    this.publish()
    await this.sendStartCommands("userRequest")
  }

  async stopBelt(reason: CommandReason = "userRequest"): Promise<void> {
    this.targetSpeed = null
    this.pendingStart = null
    this.hasStartFailed = false
    this.enforcePreferredModeUntil = 0
    this.isStopRequested = true
    this.publish()
    await this.sendCommand({type: "stop"}, reason)
  }

  pauseBelt(): Promise<void> {
    return this.stopBelt("pauseRequest")
  }

  // Does what the main button of the popover does at that moment.
  async toggleBelt(): Promise<void> {
    const {connection, status, startRequest, isStopping} = this.getLiveState()
    if (connection.kind !== "connected" || !status) return
    if (isBeltMoving(status)) await this.pauseBelt()
    else if (startRequest !== "pending" && !isStopping) await this.startBelt()
  }

  // Ending while the belt still runs would let the next "running" status open a new session.
  async endSession(): Promise<void> {
    if (isBeltMoving(this.status) || this.pendingStart) {
      this.shouldEndSessionWhenBeltStops = true
      await this.stopBelt("endSessionRequest")
      return
    }
    this.endCurrentSession()
  }

  async changeSpeed(direction: 1 | -1): Promise<void> {
    if (!this.model || this.status?.beltState !== "running") return
    await this.requestSpeed(
      nextTargetSpeed(
        this.activeTargetSpeed() ?? this.status.speedKmh,
        direction,
        this.model
      )
    )
  }

  async setSpeed(speedKmh: number): Promise<void> {
    if (!this.model || this.status?.beltState !== "running") return
    await this.requestSpeed(clampToModel(speedKmh, this.model))
  }

  private async requestSpeed(speedKmh: number): Promise<void> {
    this.resumeSpeed = null
    this.targetSpeed = {speedKmh, requestedAt: Date.now()}
    this.publish()
    await this.sendCommand({type: "setSpeed", speedKmh}, "userRequest")
  }

  async setMode(mode: SelectableMode): Promise<void> {
    this.preferredMode = mode
    this.appState.set(PREFERRED_MODE_KEY, mode)
    this.publish()
    await this.sendCommand({type: "setMode", mode}, "userRequest")
  }

  setGoal(scope: GoalScope, goal: WalkGoal | null): void {
    this.diagnostics.write(describeGoal(scope, goal))
    this.replaceGoal(scope, goal)
    this.updateGoalProgress()
    if (this.status) this.stopBeltWhenGoalReached(this.status)
    this.publish()
  }

  async forgetPad(): Promise<void> {
    this.appState.delete(PERIPHERAL_ID_KEY)
    this.connection.setPreferredPeripheralId(undefined)
    this.model = null
    await this.connection.stop()
    this.connection.start()
  }

  private activeTargetSpeed(): number | null {
    if (
      !this.targetSpeed ||
      Date.now() - this.targetSpeed.requestedAt > TARGET_SPEED_HOLD_MS
    )
      return null
    return this.targetSpeed.speedKmh
  }

  private sendCommand(
    command: PadCommand,
    reason: CommandReason
  ): Promise<void> {
    this.diagnostics.write(
      `command ${describeCommand(command)} reason=${reason}`
    )
    return this.connection.sendCommand(command).catch((error: Error) => {
      this.diagnostics.write(
        `command ${describeCommand(command)} failed: ${error.message}`
      )
      throw error
    })
  }

  private logStatusChange(status: PadStatus): void {
    const key = statusChangeKey(status)
    if (key === this.lastLoggedStatusKey) return
    this.lastLoggedStatusKey = key
    this.diagnostics.write(describeStatus(status))
  }

  // A session goal belongs to its session: it must not silently carry over to the next one.
  private handleSessionEvents(events: TrackerEvent[]): void {
    for (const event of events) {
      if (event.type === "sessionStarted")
        this.diagnostics.write("session started")
      if (event.type === "sessionEnded") {
        this.diagnostics.write(
          `session ended ${describeSession(event.session)}`
        )
        this.replaceGoal("session", null)
        this.plateauTracker.reset()
        this.emit("sessionEnded")
      }
    }
  }

  private handleConnectionState(state: PadConnectionState): void {
    this.diagnostics.write(describeConnectionState(state))
    this.lastLoggedStatusKey = null
    if (state.kind === "connected") {
      this.model = identifyPadModel(state.padName)
      this.appState.set(PERIPHERAL_ID_KEY, state.peripheralId)
    } else {
      this.status = null
      if (this.shouldEndSessionWhenBeltStops) this.endCurrentSession()
    }
    this.publish()
  }

  private handleStatus(status: PadStatus): void {
    const previousStatus = this.status
    this.status = status
    this.plateauTracker.update(status, Date.now())
    this.detectPadStop(previousStatus, status)
    this.logStatusChange(status)
    this.retryPendingStart(status)
    this.restorePreferredModeAfterStart(status)
    this.restoreSpeedAfterResume(status)
    const events = this.recorder.handleStatus(status)
    this.handleSessionEvents(events)
    this.appState.set(PLATEAU_KEY, this.plateauTracker.toSaved(Date.now()))
    if (!isBeltMoving(status)) this.isStopRequested = false
    if (this.shouldEndSessionWhenBeltStops && !isBeltMoving(status))
      this.endCurrentSession()
    this.updateGoalProgress()
    this.stopBeltWhenGoalReached(status)
    const startedOrEnded = events.some(
      (event) => event.type !== "sessionProgressed"
    )
    const now = Date.now()
    if (
      startedOrEnded ||
      (events.length > 0 &&
        now - this.lastHistoryProgressAt > HISTORY_PROGRESS_THROTTLE_MS)
    ) {
      this.lastHistoryProgressAt = now
      this.emit("historyChanged")
    }
    this.publish()
  }

  private detectPadStop(
    previousStatus: PadStatus | null,
    status: PadStatus
  ): void {
    const now = Date.now()
    if (status.beltState === "starting") this.padStop = null
    if (status.beltState === "running") {
      if (this.lastStep?.steps !== status.steps)
        this.lastStep = {steps: status.steps, at: now}
      return
    }
    const hasJustStopped = previousStatus?.beltState === "running"
    const lastStepAt = this.lastStep?.at ?? now
    this.lastStep = null
    if (!hasJustStopped || this.isStopRequested) return
    const cause =
      now - lastStepAt >= PAD_STOP_WITHOUT_STEPS_MS ? "noSteps" : "padOrRemote"
    this.padStop = {cause, at: now}
    this.diagnostics.write(
      `pad stopped on its own: ${cause}, last step ${Math.round((now - lastStepAt) / 1000)}s before`
    )
  }

  private endCurrentSession(): void {
    this.shouldEndSessionWhenBeltStops = false
    const events = this.recorder.endSession()
    this.handleSessionEvents(events)
    if (events.length > 0) this.emit("historyChanged")
    this.publish()
  }

  private automaticSessionEnd(): number | null {
    const session = this.recorder.currentSession
    if (!session || isBeltMoving(this.status)) return null
    return session.endedAt + this.recorder.pauseTimeoutMs
  }

  private startRequestState(): StartRequestState | null {
    if (this.pendingStart) return "pending"
    return this.hasStartFailed ? "failed" : null
  }

  private async sendStartCommands(reason: CommandReason): Promise<void> {
    const mode = this.status?.mode
    // A sleeping C2 ignores every command but a switch to automatic mode, which wakes it up.
    if (mode === "standby")
      await this.sendCommand({type: "setMode", mode: "automatic"}, reason)
    else if (mode !== this.preferredMode)
      await this.sendCommand(
        {type: "setMode", mode: this.preferredMode},
        reason
      )
    await this.sendCommand({type: "start"}, reason)
  }

  private retryPendingStart(status: PadStatus): void {
    const pendingStart = this.pendingStart
    if (!pendingStart) return
    const now = Date.now()
    if (isBeltMoving(status)) {
      this.pendingStart = null
      this.enforcePreferredModeUntil = now + PREFERRED_MODE_ENFORCEMENT_MS
      return
    }
    if (now - pendingStart.requestedAt > WAKE_UP_TIMEOUT_MS) {
      this.pendingStart = null
      this.hasStartFailed = true
      this.diagnostics.write("start failed: the pad did not wake up")
      return
    }
    if (now - pendingStart.lastAttemptAt < START_RETRY_INTERVAL_MS) return
    pendingStart.lastAttemptAt = now
    this.sendStartCommands("wakeUpRetry").catch(() => undefined)
  }

  private restorePreferredModeAfterStart(status: PadStatus): void {
    const now = Date.now()
    if (this.pendingStart || now > this.enforcePreferredModeUntil) return
    if (status.mode === this.preferredMode) {
      this.enforcePreferredModeUntil = 0
      return
    }
    const isAsleep = status.mode === "standby"
    if (
      isAsleep ||
      now - this.lastModeCorrectionAt < MODE_CORRECTION_INTERVAL_MS
    )
      return
    this.lastModeCorrectionAt = now
    this.sendCommand(
      {type: "setMode", mode: this.preferredMode},
      "preferredModeRestore"
    ).catch(() => undefined)
  }

  private restoreSpeedAfterResume(status: PadStatus): void {
    const resumeSpeed = this.resumeSpeed
    if (!resumeSpeed || status.beltState !== "running") return
    const now = Date.now()
    if (
      status.speedKmh === resumeSpeed.speedKmh ||
      now - resumeSpeed.requestedAt > RESUME_SPEED_TIMEOUT_MS
    ) {
      this.resumeSpeed = null
      return
    }
    if (now - resumeSpeed.lastAttemptAt < START_RETRY_INTERVAL_MS) return
    resumeSpeed.lastAttemptAt = now
    this.targetSpeed = {speedKmh: resumeSpeed.speedKmh, requestedAt: now}
    this.sendCommand(
      {type: "setSpeed", speedKmh: resumeSpeed.speedKmh},
      "resumeSpeedRestore"
    ).catch(() => undefined)
  }

  private summarizeToday(): DaySummary {
    const today = dayKeyOf(Date.now())
    return summarizeSessions(
      this.sessions.listSessionsStartedBetween(
        startOfDay(today),
        startOfDay(addDays(today, 1))
      )
    )
  }

  private walkedTotals(scope: GoalScope): WalkedTotals | undefined {
    return scope === "session"
      ? this.recorder.currentSession
      : this.summarizeToday()
  }

  private replaceGoal(scope: GoalScope, goal: WalkGoal | null): void {
    this.goalTrackers[scope].setGoal(goal)
    const key = WALK_GOAL_KEYS[scope]
    if (!goal) this.appState.delete(key)
    else if (scope === "day")
      this.appState.set(key, {day: dayKeyOf(Date.now()), goal})
    else this.appState.set(key, goal)
  }

  // A reached goal is no longer saved, so restarting the app later never stops the belt again.
  private updateGoalProgress(): void {
    for (const scope of GOAL_SCOPES) {
      const tracker = this.goalTrackers[scope]
      const wasReached = tracker.reachedAt !== null
      const totals = this.walkedTotals(scope)
      tracker.recordProgress(totals, Date.now())
      if (wasReached || tracker.reachedAt === null) continue
      this.appState.delete(WALK_GOAL_KEYS[scope])
      const progress = tracker.progressOf(totals)
      this.diagnostics.write(
        `${scope} goal reached after ${progress?.walkedSeconds}s ${progress?.walkedMeters}m`
      )
    }
  }

  private latestGoalReachedAt(): number | null {
    const reachedTimes = GOAL_SCOPES.map(
      (scope) => this.goalTrackers[scope].reachedAt
    ).filter((at) => at !== null)
    return reachedTimes.length > 0 ? Math.max(...reachedTimes) : null
  }

  private stopBeltWhenGoalReached(status: PadStatus): void {
    const reachedAt = this.latestGoalReachedAt()
    const now = Date.now()
    const isGoalStopPending =
      reachedAt !== null && now - reachedAt < GOAL_STOP_WINDOW_MS
    if (!isGoalStopPending || status.beltState !== "running") return
    if (now - this.lastGoalStopAttemptAt < GOAL_STOP_RETRY_INTERVAL_MS) return
    this.lastGoalStopAttemptAt = now
    this.stopBelt("goalReached").catch(() => undefined)
  }

  private tick(): void {
    const events = this.recorder.tick()
    this.handleSessionEvents(events)
    if (events.length > 0) {
      this.emit("historyChanged")
      this.publish()
    }
  }

  private publish(): void {
    this.emit("liveState", this.getLiveState())
  }
}
