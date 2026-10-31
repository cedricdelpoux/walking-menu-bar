import {averageSpeedKmh, type SessionValues} from "../../shared/session"
import type {PadStatus} from "../pad/protocol/types"
import {
  computeCounterDelta,
  hasProgress,
  type CounterDelta,
  type CounterReading,
} from "./counter-delta"

export interface SessionSample {
  at: number
  speedKmh: number
  distanceMeters: number
  steps: number
}

export type TrackerEvent =
  | {type: "sessionStarted"; session: SessionValues}
  | {type: "sessionProgressed"; session: SessionValues; sample: SessionSample}
  | {type: "sessionEnded"; session: SessionValues}

export interface SessionTrackerOptions {
  pauseTimeoutMs: number
}

export interface SessionTrackerSnapshot {
  counters?: CounterReading
  session?: SessionValues
}

// A speed only counts towards the max once held for this many consecutive statuses, which
// filters the one-second spike some pads report when the belt starts.
const MAX_SPEED_SUSTAINED_SAMPLES = 3
const KMH_TO_METERS_PER_SECOND = 1 / 3.6

export class SessionTracker {
  private counters: CounterReading | undefined
  private session: SessionValues | undefined
  private recentRunningSpeeds: number[] = []
  private steadySpeedKmh: number | null = null
  private lastRunningSpeedKmh: number | null = null
  private secondsBeforeSteadySpeed = 0
  private metersBeforeSteadySpeed = 0

  constructor(
    private options: SessionTrackerOptions,
    snapshot: SessionTrackerSnapshot = {}
  ) {
    this.counters = snapshot.counters
    this.session = snapshot.session && {...snapshot.session}
  }

  get currentSession(): SessionValues | undefined {
    return this.session && {...this.session}
  }

  get lastCounters(): CounterReading | undefined {
    return this.counters
  }

  get pauseTimeoutMs(): number {
    return this.options.pauseTimeoutMs
  }

  setPauseTimeout(pauseTimeoutMs: number): void {
    this.options = {...this.options, pauseTimeoutMs}
  }

  handleStatus(status: PadStatus, at: number): TrackerEvent[] {
    const events = this.tick(at)
    const reading: CounterReading = {
      at,
      elapsedSeconds: status.elapsedSeconds,
      distanceMeters: status.distanceMeters,
      steps: status.steps,
    }
    const delta = computeCounterDelta(this.counters, reading)
    this.counters = reading

    const isRunning = status.beltState === "running" && status.speedKmh > 0
    let walkedMeters = this.walkedMeters(delta, status)
    this.updateSteadySpeed(status, isRunning)
    walkedMeters += this.correctionBeforeSteadySpeed()
    if (!isRunning) this.recentRunningSpeeds = []
    if (!isRunning && !hasProgress(delta)) return events

    if (!this.session) {
      // Progress made while the app was not listening is back-dated to when it happened.
      const startedAt = at - delta.elapsedSeconds * 1000
      this.session = {
        startedAt,
        endedAt: at,
        durationSeconds: 0,
        distanceMeters: 0,
        steps: 0,
        maxSpeedKmh: 0,
      }
      events.push({type: "sessionStarted", session: {...this.session}})
    }

    const session = this.session
    session.durationSeconds += delta.elapsedSeconds
    session.distanceMeters += walkedMeters
    session.steps += delta.steps
    session.endedAt = at

    if (isRunning) {
      this.recentRunningSpeeds = [
        ...this.recentRunningSpeeds,
        status.speedKmh,
      ].slice(-MAX_SPEED_SUSTAINED_SAMPLES)
      if (this.recentRunningSpeeds.length === MAX_SPEED_SUSTAINED_SAMPLES) {
        session.maxSpeedKmh = Math.max(
          session.maxSpeedKmh,
          Math.min(...this.recentRunningSpeeds)
        )
      }
    }

    events.push({
      type: "sessionProgressed",
      session: {...session},
      sample: {
        at,
        speedKmh: isRunning ? status.speedKmh : 0,
        distanceMeters: session.distanceMeters,
        steps: session.steps,
      },
    })
    return events
  }

  // The pad counts its distance in 10 m steps that drift from its own speed. The distance follows
  // the belt speed instead: each second of walking counts at the last steady speed, so the burst
  // the pad reports for a second when the belt starts is ignored.
  private walkedMeters(delta: CounterDelta, status: PadStatus): number {
    if (delta.elapsedSeconds <= 0) return 0
    if (this.steadySpeedKmh !== null)
      return (
        delta.elapsedSeconds * this.steadySpeedKmh * KMH_TO_METERS_PER_SECOND
      )
    if (status.speedKmh <= 0) return delta.distanceMeters
    const walkedMeters =
      delta.elapsedSeconds * status.speedKmh * KMH_TO_METERS_PER_SECOND
    this.secondsBeforeSteadySpeed += delta.elapsedSeconds
    this.metersBeforeSteadySpeed += walkedMeters
    return walkedMeters
  }

  // The first seconds of the belt count at its current speed, then at the steady speed once it is
  // known, so the burst of a start is left out.
  private correctionBeforeSteadySpeed(): number {
    if (this.steadySpeedKmh === null || this.secondsBeforeSteadySpeed === 0)
      return 0
    const correctedMeters =
      this.secondsBeforeSteadySpeed *
      this.steadySpeedKmh *
      KMH_TO_METERS_PER_SECOND
    const correctionMeters = correctedMeters - this.metersBeforeSteadySpeed
    this.secondsBeforeSteadySpeed = 0
    this.metersBeforeSteadySpeed = 0
    return correctionMeters
  }

  private updateSteadySpeed(status: PadStatus, isRunning: boolean): void {
    if (!isRunning) {
      this.lastRunningSpeedKmh = null
      return
    }
    if (status.speedKmh === this.lastRunningSpeedKmh)
      this.steadySpeedKmh = status.speedKmh
    this.lastRunningSpeedKmh = status.speedKmh
  }

  tick(now: number): TrackerEvent[] {
    if (
      !this.session ||
      now - this.session.endedAt <= this.options.pauseTimeoutMs
    )
      return []
    return this.endSession()
  }

  endSession(): TrackerEvent[] {
    if (!this.session) return []
    const ended = {...this.session}
    // Sessions too short to have a sustained speed still get a meaningful max.
    ended.maxSpeedKmh = Math.max(
      ended.maxSpeedKmh,
      Math.round(averageSpeedKmh(ended) * 10) / 10
    )
    this.session = undefined
    this.recentRunningSpeeds = []
    return [{type: "sessionEnded", session: ended}]
  }
}
