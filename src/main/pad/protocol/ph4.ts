// Port of the unofficial KingSmith protocol from ph4-walkingpad (ph4_walkingpad/pad.py).
// Frames look like [0xF7, type, ...payload, checksum, 0xFD] for commands and
// [0xF8, type, ...payload, checksum, 0xFD] for notifications.
import type {
  BeltState,
  PadCommand,
  PadMode,
  PadNotification,
  PadProtocol,
  PadRecord,
  PadStatus,
} from "./types"

const COMMAND_HEADER = 0xf7
const NOTIFICATION_HEADER = 0xf8
const FRAME_FOOTER = 0xfd

const TYPE_CONTROL = 0xa2
const TYPE_RECORD = 0xa7

const CONTROL_STATUS = 0
const CONTROL_SPEED = 1
const CONTROL_MODE = 2
const CONTROL_START = 4

const RECORD_REQUEST = 0xaa
const RECORD_REQUEST_MODES = {0: 0xff, 1: 0x00}

const MODE_CODES: Record<PadMode, number> = {
  automatic: 0,
  manual: 1,
  standby: 2,
}

// 9, 8 and 7 are the 3-2-1 countdown shown before the belt starts. The C2 reports 4 once it
// falls asleep, and resets its counters at that point.
const BELT_STATES: Record<number, BeltState> = {
  0: "idle",
  1: "running",
  4: "standby",
  5: "standby",
  7: "starting",
  8: "starting",
  9: "starting",
}

const STATUS_FRAME_MIN_LENGTH = 14
const LAST_REMOTE_BUTTON_INDEX = 16
const RECORD_FRAME_MIN_LENGTH = 17

export const PH4_MAX_ENCODABLE_SPEED_KMH = 25.5

export function computeChecksum(frame: ArrayLike<number>): number {
  let sum = 0
  for (let index = 1; index < frame.length - 2; index++) sum += frame[index]
  return sum % 256
}

function buildFrame(type: number, payload: number[]): Uint8Array {
  const frame = Uint8Array.from([
    COMMAND_HEADER,
    type,
    ...payload,
    0,
    FRAME_FOOTER,
  ])
  frame[frame.length - 2] = computeChecksum(frame)
  return frame
}

function readUint24(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2]
}

export function encodeSpeed(speedKmh: number): number {
  if (
    !Number.isFinite(speedKmh) ||
    speedKmh < 0 ||
    speedKmh > PH4_MAX_ENCODABLE_SPEED_KMH
  ) {
    throw new RangeError(`Speed out of range: ${speedKmh} km/h`)
  }
  return Math.round(speedKmh * 10)
}

export function encodePh4Command(command: PadCommand): Uint8Array {
  switch (command.type) {
    case "requestStatus":
      return buildFrame(TYPE_CONTROL, [CONTROL_STATUS, 0])
    case "requestRecords":
      return buildFrame(TYPE_RECORD, [
        RECORD_REQUEST,
        RECORD_REQUEST_MODES[command.mode],
      ])
    case "start":
      return buildFrame(TYPE_CONTROL, [CONTROL_START, 1])
    case "stop":
      return buildFrame(TYPE_CONTROL, [CONTROL_SPEED, 0])
    case "setSpeed":
      return buildFrame(TYPE_CONTROL, [
        CONTROL_SPEED,
        encodeSpeed(command.speedKmh),
      ])
    case "setMode":
      return buildFrame(TYPE_CONTROL, [CONTROL_MODE, MODE_CODES[command.mode]])
  }
}

function decodeMode(code: number): PadMode | "unknown" {
  const entry = Object.entries(MODE_CODES).find(([, value]) => value === code)
  return entry ? (entry[0] as PadMode) : "unknown"
}

export function parseStatusFrame(bytes: Uint8Array): PadStatus {
  return {
    rawBeltState: bytes[2],
    beltState: BELT_STATES[bytes[2]] ?? "unknown",
    speedKmh: bytes[3] / 10,
    mode: decodeMode(bytes[4]),
    elapsedSeconds: readUint24(bytes, 5),
    // The pad reports distance in units of 10 m.
    distanceMeters: readUint24(bytes, 8) * 10,
    steps: readUint24(bytes, 11),
    ...(bytes.length > LAST_REMOTE_BUTTON_INDEX + 2
      ? {rawLastRemoteButton: bytes[LAST_REMOTE_BUTTON_INDEX]}
      : {}),
  }
}

export function parseRecordFrame(bytes: Uint8Array): PadRecord {
  return {
    elapsedSeconds: readUint24(bytes, 8),
    distanceMeters: readUint24(bytes, 11) * 10,
    steps: readUint24(bytes, 14),
  }
}

function isValidNotificationFrame(data: Uint8Array): boolean {
  return (
    data.length >= 4 &&
    data[0] === NOTIFICATION_HEADER &&
    data[data.length - 1] === FRAME_FOOTER &&
    data[data.length - 2] === computeChecksum(data)
  )
}

// Some pads (the C2 at least) also push 0xB2 frames holding tagged counters that duplicate
// the status frame. They are left as unknown.
export function decodePh4Notification(data: Uint8Array): PadNotification {
  if (isValidNotificationFrame(data)) {
    if (data[1] === TYPE_CONTROL && data.length >= STATUS_FRAME_MIN_LENGTH) {
      return {type: "status", status: parseStatusFrame(data)}
    }
    if (data[1] === TYPE_RECORD && data.length >= RECORD_FRAME_MIN_LENGTH) {
      return {type: "lastRecord", record: parseRecordFrame(data)}
    }
  }
  return {type: "unknown", bytes: data}
}

export const PH4_SERVICE_UUID = "fe00"
const WRITE_CHARACTERISTIC_UUID = "fe02"

export const ph4Protocol: PadProtocol = {
  id: "ph4",
  notifyCharacteristicUuids: ["fe01"],
  // ph4-walkingpad spaces commands by at least 0.69 s, the pad drops them otherwise.
  minCommandIntervalMs: 700,
  capabilities: {modes: true, steps: true},
  setupWrites: [],
  encodeCommand: (command) => [
    {
      characteristicUuid: WRITE_CHARACTERISTIC_UUID,
      frame: encodePh4Command(command),
    },
  ],
  decodeNotification: decodePh4Notification,
}
