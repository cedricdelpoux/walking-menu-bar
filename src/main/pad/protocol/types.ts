import type {PadMode, PadRecord, PadStatus} from "../../../shared/pad"

export type {
  BeltState,
  PadMode,
  PadRecord,
  PadStatus,
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

export interface PadProtocol {
  id: string
  serviceUuid: string
  notifyCharacteristicUuid: string
  writeCharacteristicUuid: string
  minCommandIntervalMs: number
  encodeCommand(command: PadCommand): Uint8Array
  decodeNotification(data: Uint8Array): PadNotification
}
