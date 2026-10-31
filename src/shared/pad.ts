export type BeltState = "idle" | "running" | "standby" | "starting" | "unknown"

export type PadMode = "automatic" | "manual" | "standby"

export type SelectableMode = Exclude<PadMode, "standby">

export interface PadStatus {
  beltState: BeltState
  rawBeltState: number
  mode: PadMode | "unknown"
  speedKmh: number
  elapsedSeconds: number
  distanceMeters: number
  steps: number
  rawLastRemoteButton?: number
}

export interface PadRecord {
  elapsedSeconds: number
  distanceMeters: number
  steps: number
}

export interface PadModel {
  id: string
  name: string
  minSpeedKmh: number
  maxSpeedKmh: number
}

export type PadConnectionFailure =
  "padNotFound" | "connectFailed" | "unsupportedProtocol" | "disconnected"

export type PadConnectionState =
  | {kind: "stopped"}
  | {kind: "bluetoothUnavailable"; adapterState: string}
  | {kind: "scanning"}
  | {kind: "connecting"; padName: string}
  | {
      kind: "connected"
      padName: string
      peripheralId: string
      protocolId: string
    }
  | {kind: "retrying"; failure: PadConnectionFailure; retryAt: number}

export const SPEED_STEP_KMH = 0.5

// Why the belt stopped without the app asking: the pad stops on its own once it senses no step
// for a few seconds, and its remote can stop it too.
export type PadStopCause = "noSteps" | "padOrRemote"

// The speed walked lately and how long, pauses left out. It shows on Strava as a plateau once
// walked for PLATEAU_MIN_SECONDS.
export interface Plateau {
  speedKmh: number
  walkedMs: number
  walkingSince: number | null
}

export interface PadStop {
  cause: PadStopCause
  at: number
}
// Strava smooths its pace graph over about 2:30 around a speed change, so a speed held this long
// shows as a plateau.
export const PLATEAU_MIN_SECONDS = 180
// Unknown pads get the most common range, which every KingSmith walking pad supports.
export const DEFAULT_SPEED_RANGE = {minSpeedKmh: 0.5, maxSpeedKmh: 6}

export function speedsInRange(range: {
  minSpeedKmh: number
  maxSpeedKmh: number
}): number[] {
  const speeds: number[] = []
  for (
    let step = Math.ceil(range.minSpeedKmh / SPEED_STEP_KMH);
    step * SPEED_STEP_KMH <= range.maxSpeedKmh;
    step++
  ) {
    speeds.push(step * SPEED_STEP_KMH)
  }
  return speeds
}
