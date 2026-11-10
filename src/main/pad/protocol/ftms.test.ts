import {describe, expect, it} from "vitest"
import {
  buildUnlockFrame,
  createFtmsProtocol,
  encodeFtmsCommand,
  parseSpeedRange,
  parseTreadmillData,
} from "./ftms"

const TREADMILL_DATA = "2acd"
const SUPPLEMENT_NOTIFY = "24e2521cf63b48ed85bec5330b00fdf7"
const SUPPLEMENT_WRITE = "24e2521cf63b48ed85bec5330d00fdf7"
const ODM_WRITE = "d18d2c10c44c11e8a355529269fb1459"
const STANDARD_CHARACTERISTICS = ["2acd", "2ad4", "2ad9", "2ada"]

const hex = (text: string) =>
  Uint8Array.from(text.match(/../g)!.map((byte) => parseInt(byte, 16)))
const plainPad = () =>
  createFtmsProtocol({
    name: "KS-AB12",
    characteristicUuids: STANDARD_CHARACTERISTICS,
  })

describe("parseTreadmillData", () => {
  it("reads the speed, the total distance and the elapsed time", () => {
    // Flags 0x0404: total distance and elapsed time, after the speed.
    expect(parseTreadmillData(hex("04042c011027005802"))).toEqual({
      speedKmh: 3,
      distanceMeters: 10_000,
      elapsedSeconds: 600,
    })
  })

  it("reads the steps of the KingSmith extension, as sent by a Z1", () => {
    // Flags 0x2404, the ones a Z1 sends: distance, elapsed time and steps.
    expect(parseTreadmillData(hex("0424fa00e803003c00a00f"))).toEqual({
      speedKmh: 2.5,
      distanceMeters: 1000,
      elapsedSeconds: 60,
      steps: 4000,
    })
  })

  it("skips the fields it does not use", () => {
    // Flags 0x0406: average speed before the distance.
    expect(parseTreadmillData(hex("0604c8009600e803003c00"))).toEqual({
      speedKmh: 2,
      distanceMeters: 1000,
      elapsedSeconds: 60,
    })
  })

  it("has no speed in the follow-up part of a split frame", () => {
    expect(parseTreadmillData(hex("0500102700"))).toEqual({
      distanceMeters: 10_000,
    })
  })
})

describe("parseSpeedRange", () => {
  it("reads the range of a Z1", () => {
    expect(parseSpeedRange(hex("a00080020a00"))).toEqual({
      minSpeedKmh: 1.6,
      maxSpeedKmh: 6.4,
    })
  })

  it("ignores an empty range", () => {
    expect(parseSpeedRange(hex("00000000"))).toBeNull()
  })
})

describe("buildUnlockFrame", () => {
  it("derives the code from the end of the Bluetooth name", () => {
    expect(buildUnlockFrame("KS-HD-Z1D")).toEqual(hex("710005012e5a314474"))
  })
})

describe("createFtmsProtocol", () => {
  it("turns the treadmill data into a status", () => {
    const notification = plainPad().decodeNotification(
      hex("0424fa00e803003c00a00f"),
      TREADMILL_DATA,
      0
    )
    expect(notification).toEqual({
      type: "status",
      status: {
        beltState: "running",
        rawBeltState: 1,
        mode: "manual",
        speedKmh: 2.5,
        elapsedSeconds: 60,
        distanceMeters: 1000,
        steps: 4000,
      },
    })
  })

  it("counts the time and distance itself when the pad leaves them out", () => {
    const protocol = plainPad()
    protocol.decodeNotification(hex("00006801"), TREADMILL_DATA, 0)
    const notification = protocol.decodeNotification(
      hex("00006801"),
      TREADMILL_DATA,
      10_000
    )
    expect(notification).toMatchObject({
      status: {speedKmh: 3.6, elapsedSeconds: 10, distanceMeters: 10},
    })
  })

  it("keeps the last speed across a split frame", () => {
    const protocol = plainPad()
    protocol.decodeNotification(hex("00002c01"), TREADMILL_DATA, 0)
    const notification = protocol.decodeNotification(
      hex("0500102700"),
      TREADMILL_DATA,
      1000
    )
    expect(notification).toMatchObject({
      status: {speedKmh: 3, beltState: "running", distanceMeters: 10_000},
    })
  })

  it("ignores the control point answers", () => {
    expect(plainPad().decodeNotification(hex("800001"), "2ad9", 0).type).toBe(
      "unknown"
    )
  })

  it("unlocks the pads that have the supplement channel", () => {
    const protocol = createFtmsProtocol({
      name: "KS-HD-Z1D",
      characteristicUuids: [
        ...STANDARD_CHARACTERISTICS,
        SUPPLEMENT_NOTIFY,
        SUPPLEMENT_WRITE,
      ],
    })
    expect(protocol.notifyCharacteristicUuids[0]).toBe(SUPPLEMENT_NOTIFY)
    expect(protocol.setupWrites).toEqual([
      {
        characteristicUuid: SUPPLEMENT_WRITE,
        frame: hex("710005012e5a314474"),
        withoutResponse: true,
      },
    ])
    expect(plainPad().setupWrites).toEqual([])
  })

  it("sends the vendor frame before each command of the MC-21 pads", () => {
    const protocol = createFtmsProtocol({
      name: "KS-MC21-D06BFD",
      characteristicUuids: [...STANDARD_CHARACTERISTICS, ODM_WRITE],
    })
    expect(protocol.encodeCommand({type: "start"})[0]).toEqual({
      characteristicUuid: ODM_WRITE,
      frame: hex("01000d00060b0f0d"),
    })
  })
})

describe("encodeFtmsCommand", () => {
  const controlFrames = (command: Parameters<typeof encodeFtmsCommand>[0]) =>
    encodeFtmsCommand(command).map(({characteristicUuid, frame}) => {
      expect(characteristicUuid).toBe("2ad9")
      return frame
    })

  it("asks for control before each command", () => {
    expect(controlFrames({type: "start"})).toEqual([hex("00"), hex("07")])
    expect(controlFrames({type: "stop"})).toEqual([hex("00"), hex("0801")])
    expect(controlFrames({type: "setSpeed", speedKmh: 2.5})).toEqual([
      hex("00"),
      hex("02fa00"),
    ])
  })

  it("has no frame for the KingSmith only commands", () => {
    expect(encodeFtmsCommand({type: "requestStatus"})).toEqual([])
    expect(encodeFtmsCommand({type: "setMode", mode: "automatic"})).toEqual([])
  })
})
