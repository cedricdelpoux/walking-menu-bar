// Bluetooth Fitness Machine Service (FTMS), the standard protocol of the recent WalkingPads,
// with the KingSmith additions documented by walkingpad-controller (docs/ftms-protocol-reference.md)
// and z1-walkingpad-mcp (docs/protocol.md), both built from KS Fit captures.
import type {
  PadCommand,
  PadProfile,
  PadProtocol,
  PadStatus,
  PadWrite,
  SpeedRange,
} from "./types"

export const FTMS_SERVICE_UUID = "1826"
const TREADMILL_DATA_UUID = "2acd"
const CONTROL_POINT_UUID = "2ad9"
const SPEED_RANGE_UUID = "2ad4"
// The KS-HD-* pads (Z1…) stay silent and ignore every command until unlocked on this channel.
const SUPPLEMENT_NOTIFY_UUID = "24e2521cf63b48ed85bec5330b00fdf7"
const SUPPLEMENT_WRITE_UUID = "24e2521cf63b48ed85bec5330d00fdf7"
// The MC-21 pads only take FTMS commands right after this vendor frame.
const ODM_WRITE_UUID = "d18d2c10c44c11e8a355529269fb1459"
const ODM_PREAMBLE = Uint8Array.of(
  0x01,
  0x00,
  0x0d,
  0x00,
  0x06,
  0x0b,
  0x0f,
  0x0d
)

const OP_REQUEST_CONTROL = 0x00
const OP_SET_TARGET_SPEED = 0x02
const OP_START_OR_RESUME = 0x07
const OP_STOP_OR_PAUSE = 0x08
const STOP = 0x01

// Treadmill Data flags, in the order of the fields they add, with the size of those fields.
const MORE_DATA = 1 << 0
const TOTAL_DISTANCE = 1 << 2
const ELAPSED_TIME = 1 << 10
// KingSmith extension: the steps counted by the pad.
const KINGSMITH_STEPS = 1 << 13
const OPTIONAL_FIELDS: Array<{flag: number; size: number}> = [
  {flag: 1 << 1, size: 2}, // average speed
  {flag: TOTAL_DISTANCE, size: 3},
  {flag: 1 << 3, size: 4}, // inclination and ramp angle
  {flag: 1 << 4, size: 4}, // elevation gain
  {flag: 1 << 5, size: 1}, // instantaneous pace
  {flag: 1 << 6, size: 1}, // average pace
  {flag: 1 << 7, size: 5}, // expended energy
  {flag: 1 << 8, size: 1}, // heart rate
  {flag: 1 << 9, size: 1}, // metabolic equivalent
  {flag: ELAPSED_TIME, size: 2},
  {flag: 1 << 11, size: 2}, // remaining time
  {flag: 1 << 12, size: 4}, // force on belt and power output
  {flag: KINGSMITH_STEPS, size: 2},
]

export const FTMS_MAX_ENCODABLE_SPEED_KMH = 655.35

export interface TreadmillData {
  speedKmh?: number
  distanceMeters?: number
  elapsedSeconds?: number
  steps?: number
}

export function parseTreadmillData(bytes: Uint8Array): TreadmillData {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const flags = view.getUint16(0, true)
  const data: TreadmillData = {}
  let offset = 2
  if (!(flags & MORE_DATA)) {
    data.speedKmh = view.getUint16(offset, true) / 100
    offset += 2
  }
  for (const {flag, size} of OPTIONAL_FIELDS) {
    if (!(flags & flag)) continue
    if (offset + size > bytes.length) break
    if (flag === TOTAL_DISTANCE)
      data.distanceMeters =
        view.getUint16(offset, true) + (bytes[offset + 2] << 16)
    if (flag === ELAPSED_TIME)
      data.elapsedSeconds = view.getUint16(offset, true)
    if (flag === KINGSMITH_STEPS) data.steps = view.getUint16(offset, true)
    offset += size
  }
  return data
}

export function parseSpeedRange(bytes: Uint8Array): SpeedRange | null {
  if (bytes.length < 4) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minSpeedKmh = view.getUint16(0, true) / 100
  const maxSpeedKmh = view.getUint16(2, true) / 100
  return maxSpeedKmh > minSpeedKmh ? {minSpeedKmh, maxSpeedKmh} : null
}

const withChecksum = (bytes: number[]) =>
  Uint8Array.from([...bytes, bytes.reduce((sum, byte) => sum + byte, 0) & 0xff])

// The unlock code is the last four characters of the Bluetooth name, read as a little-endian
// number, plus one.
export function buildUnlockFrame(padName: string): Uint8Array {
  const lastChars = Array.from(padName.slice(-4).padStart(4, "\0"), (char) =>
    char.charCodeAt(0)
  )
  const code =
    (new DataView(Uint8Array.from(lastChars).buffer).getUint32(0, true) + 1) >>>
    0
  const codeBytes = [0, 8, 16, 24].map((shift) => (code >>> shift) & 0xff)
  return withChecksum([0x71, 0x00, 0x05, 0x01, ...codeBytes])
}

function encodeSpeed(speedKmh: number): number[] {
  if (
    !Number.isFinite(speedKmh) ||
    speedKmh < 0 ||
    speedKmh > FTMS_MAX_ENCODABLE_SPEED_KMH
  ) {
    throw new RangeError(`Speed out of range: ${speedKmh} km/h`)
  }
  const hundredths = Math.round(speedKmh * 100)
  return [hundredths & 0xff, hundredths >> 8]
}

function toControlFrames(command: PadCommand): number[][] {
  switch (command.type) {
    case "start":
      return [[OP_START_OR_RESUME]]
    case "stop":
      return [[OP_STOP_OR_PAUSE, STOP]]
    case "setSpeed":
      return [[OP_SET_TARGET_SPEED, ...encodeSpeed(command.speedKmh)]]
    case "requestStatus":
    case "requestRecords":
    case "setMode":
      return []
  }
}

// Asking for control again before each command keeps working after the pad drops it, when its
// own buttons were used.
export function encodeFtmsCommand(
  command: PadCommand,
  hasOdmChannel = false
): PadWrite[] {
  const frames = toControlFrames(command)
  if (frames.length === 0) return []
  return [
    ...(hasOdmChannel
      ? [{characteristicUuid: ODM_WRITE_UUID, frame: ODM_PREAMBLE}]
      : []),
    ...[[OP_REQUEST_CONTROL], ...frames].map((frame) => ({
      characteristicUuid: CONTROL_POINT_UUID,
      frame: Uint8Array.from(frame),
    })),
  ]
}

// Pads may leave the elapsed time or the distance out: they are then counted from the speed.
export function createFtmsProtocol(profile: PadProfile): PadProtocol {
  const has = (uuid: string) => profile.characteristicUuids.includes(uuid)
  const hasSupplement =
    has(SUPPLEMENT_NOTIFY_UUID) && has(SUPPLEMENT_WRITE_UUID)
  const hasOdmChannel = has(ODM_WRITE_UUID)
  let status: PadStatus | null = null
  let lastDataAt: number | null = null
  let countedSeconds = 0
  let countedMeters = 0

  return {
    id: "ftms",
    notifyCharacteristicUuids: [
      ...(hasSupplement ? [SUPPLEMENT_NOTIFY_UUID] : []),
      TREADMILL_DATA_UUID,
      CONTROL_POINT_UUID,
    ],
    // The Z1 drops the commands sent less than 400 ms apart.
    minCommandIntervalMs: 400,
    capabilities: {modes: false, steps: false},
    setupWrites: hasSupplement
      ? [
          {
            characteristicUuid: SUPPLEMENT_WRITE_UUID,
            frame: buildUnlockFrame(profile.name),
            withoutResponse: true,
          },
        ]
      : [],
    encodeCommand: (command) => encodeFtmsCommand(command, hasOdmChannel),
    speedRange: {characteristicUuid: SPEED_RANGE_UUID, decode: parseSpeedRange},
    decodeNotification(data, characteristicUuid, receivedAt) {
      if (characteristicUuid !== TREADMILL_DATA_UUID || data.length < 2)
        return {type: "unknown", bytes: data}
      const fields = parseTreadmillData(data)
      const speedKmh = fields.speedKmh ?? status?.speedKmh ?? 0
      const seconds =
        lastDataAt === null ? 0 : Math.max(0, (receivedAt - lastDataAt) / 1000)
      lastDataAt = receivedAt
      if (speedKmh > 0) {
        countedSeconds += seconds
        countedMeters += (speedKmh / 3.6) * seconds
      }
      const isRunning = speedKmh > 0
      status = {
        beltState: isRunning ? "running" : "idle",
        rawBeltState: isRunning ? 1 : 0,
        mode: "manual",
        speedKmh,
        elapsedSeconds: fields.elapsedSeconds ?? Math.floor(countedSeconds),
        distanceMeters: fields.distanceMeters ?? Math.floor(countedMeters),
        steps: fields.steps ?? status?.steps ?? 0,
      }
      return {type: "status", status}
    },
  }
}
