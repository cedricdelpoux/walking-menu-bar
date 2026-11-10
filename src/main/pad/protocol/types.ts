import type {
  PadCapabilities,
  PadMode,
  PadRecord,
  PadStatus,
  SpeedRange,
} from "../../../shared/pad"

export type {
  BeltState,
  PadMode,
  PadRecord,
  PadStatus,
  SpeedRange,
} from "../../../shared/pad"

export type PadCommand =
  | {type: "requestStatus"}
  | {type: "requestRecords"; mode: 0 | 1}
  | {type: "start"}
  | {type: "stop"}
  | {type: "setSpeed"; speedKmh: number}
  | {type: "setMode"; mode: PadMode}

export type PadNotification =
  | {type: "status"; status: PadStatus}
  | {type: "lastRecord"; record: PadRecord}
  | {type: "unknown"; bytes: Uint8Array}

export interface PadWrite {
  characteristicUuid: string
  frame: Uint8Array
  // Left out, it follows the properties of the characteristic.
  withoutResponse?: boolean
}

export interface PadProtocol {
  id: string
  notifyCharacteristicUuids: string[]
  minCommandIntervalMs: number
  capabilities: PadCapabilities
  // Sent once the notifications are on, before any command.
  setupWrites: PadWrite[]
  // A command the protocol has no frame for is encoded as no write at all.
  encodeCommand(command: PadCommand): PadWrite[]
  decodeNotification(
    data: Uint8Array,
    characteristicUuid: string,
    receivedAt: number
  ): PadNotification
  speedRange?: {
    characteristicUuid: string
    decode(data: Uint8Array): SpeedRange | null
  }
}

// What the protocol needs to know about the pad it talks to.
export interface PadProfile {
  name: string
  characteristicUuids: string[]
}
