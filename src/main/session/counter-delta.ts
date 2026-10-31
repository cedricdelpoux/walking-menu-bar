export interface PadCounters {
  elapsedSeconds: number
  distanceMeters: number
  steps: number
}

export interface CounterReading extends PadCounters {
  at: number
}

export interface CounterDelta extends PadCounters {
  countersReset: boolean
}

const CLOCK_TOLERANCE_SECONDS = 10
// The pad falls asleep, and resets its counters, well before staying idle this long.
const PAD_SLEEPS_WITHIN_IDLE_SECONDS = 30 * 60

const NO_PROGRESS: CounterDelta = {
  elapsedSeconds: 0,
  distanceMeters: 0,
  steps: 0,
  countersReset: false,
}

export function computeCounterDelta(
  previous: CounterReading | undefined,
  current: CounterReading
): CounterDelta {
  if (!previous) return NO_PROGRESS

  const anyCounterDecreased =
    current.elapsedSeconds < previous.elapsedSeconds ||
    current.distanceMeters < previous.distanceMeters ||
    current.steps < previous.steps

  // The pad clock cannot run faster than the wall clock: if it did, the counters restarted
  // from zero in between (pad turned off while the app was not connected) and grew past
  // their previous values.
  const wallClockSeconds = Math.max(0, (current.at - previous.at) / 1000)
  const padClockSeconds = current.elapsedSeconds - previous.elapsedSeconds
  const padClockOutranWallClock =
    padClockSeconds > wallClockSeconds + CLOCK_TOLERANCE_SECONDS

  // Counters that kept going would mean the pad stayed idle for that long without sleeping.
  const idleSecondsIfCountersKeptGoing = wallClockSeconds - padClockSeconds
  const padMustHaveSlept =
    idleSecondsIfCountersKeptGoing > PAD_SLEEPS_WITHIN_IDLE_SECONDS

  if (anyCounterDecreased || padClockOutranWallClock || padMustHaveSlept) {
    return {
      elapsedSeconds: current.elapsedSeconds,
      distanceMeters: current.distanceMeters,
      steps: current.steps,
      countersReset: true,
    }
  }

  return {
    elapsedSeconds: current.elapsedSeconds - previous.elapsedSeconds,
    distanceMeters: current.distanceMeters - previous.distanceMeters,
    steps: current.steps - previous.steps,
    countersReset: false,
  }
}

export function hasProgress(delta: PadCounters): boolean {
  return delta.elapsedSeconds > 0 || delta.distanceMeters > 0 || delta.steps > 0
}
