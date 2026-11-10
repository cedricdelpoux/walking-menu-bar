import type {GoalScope, WalkGoal} from "../../shared/goal"
import type {PadConnectionState, PadStatus} from "../../shared/pad"
import type {SessionValues} from "../../shared/session"
import type {PadCommand} from "../pad/protocol/types"

const REMOTE_BUTTON_NAMES: Record<number, string> = {
  0: "none",
  2: "faster",
  3: "stop",
  4: "slower",
}

function describeRemoteButton(rawButton: number | undefined): string {
  if (rawButton === undefined) return "unknown"
  return REMOTE_BUTTON_NAMES[rawButton] ?? `raw ${rawButton}`
}

// The remote button byte keeps the last button pressed, so only its changes are meaningful.
export function statusChangeKey(status: PadStatus): string {
  return [status.rawBeltState, status.mode, status.rawLastRemoteButton].join(
    "|"
  )
}

export function describeStatus(status: PadStatus): string {
  return [
    `status belt=${status.beltState}(${status.rawBeltState})`,
    `mode=${status.mode}`,
    `lastRemoteButton=${describeRemoteButton(status.rawLastRemoteButton)}`,
    `speed=${status.speedKmh}km/h`,
    `time=${status.elapsedSeconds}s`,
    `distance=${status.distanceMeters}m`,
    `steps=${status.steps}`,
  ].join(" ")
}

export function describeCommand(command: PadCommand): string {
  switch (command.type) {
    case "setSpeed":
      return `setSpeed ${command.speedKmh}km/h`
    case "setMode":
      return `setMode ${command.mode}`
    case "requestRecords":
      return `requestRecords mode ${command.mode}`
    default:
      return command.type
  }
}

export function describeConnectionState(state: PadConnectionState): string {
  switch (state.kind) {
    case "connected":
      return state.speedRange
        ? `connection connected to ${state.padName} (${state.protocolId}, ${state.speedRange.minSpeedKmh}-${state.speedRange.maxSpeedKmh}km/h)`
        : `connection connected to ${state.padName} (${state.protocolId})`
    case "connecting":
      return `connection connecting to ${state.padName}`
    case "retrying":
      return `connection lost or failed: ${state.failure}`
    case "bluetoothUnavailable":
      return `connection bluetooth unavailable (${state.adapterState})`
    default:
      return `connection ${state.kind}`
  }
}

export function describeSession(session: SessionValues): string {
  return `${session.durationSeconds}s ${session.distanceMeters}m ${session.steps} steps`
}

export function describeGoal(scope: GoalScope, goal: WalkGoal | null): string {
  if (!goal) return `${scope} goal removed`
  const target =
    goal.kind === "distance"
      ? `${goal.targetMeters}m`
      : `${goal.targetSeconds}s`
  return `${scope} goal set to ${target}`
}
