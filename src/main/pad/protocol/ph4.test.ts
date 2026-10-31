import {describe, expect, it} from "vitest"
import {
  computeChecksum,
  decodePh4Notification,
  encodePh4Command,
  encodeSpeed,
} from "./ph4"

const bytes = (frame: Uint8Array) => Array.from(frame)

describe("encodePh4Command", () => {
  it("builds the status request used by ph4-walkingpad", () => {
    expect(bytes(encodePh4Command({type: "requestStatus"}))).toEqual([
      247, 162, 0, 0, 162, 253,
    ])
  })

  it("builds the record requests used by ph4-walkingpad", () => {
    expect(bytes(encodePh4Command({type: "requestRecords", mode: 0}))).toEqual([
      247, 167, 170, 255, 80, 253,
    ])
    expect(bytes(encodePh4Command({type: "requestRecords", mode: 1}))).toEqual([
      247, 167, 170, 0, 81, 253,
    ])
  })

  it("builds start, stop and speed commands", () => {
    expect(bytes(encodePh4Command({type: "start"}))).toEqual([
      247, 162, 4, 1, 167, 253,
    ])
    expect(bytes(encodePh4Command({type: "stop"}))).toEqual([
      247, 162, 1, 0, 163, 253,
    ])
    expect(bytes(encodePh4Command({type: "setSpeed", speedKmh: 3.5}))).toEqual([
      247, 162, 1, 35, 198, 253,
    ])
  })

  it("builds mode commands", () => {
    expect(
      bytes(encodePh4Command({type: "setMode", mode: "automatic"}))
    ).toEqual([247, 162, 2, 0, 164, 253])
    expect(bytes(encodePh4Command({type: "setMode", mode: "manual"}))).toEqual([
      247, 162, 2, 1, 165, 253,
    ])
    expect(bytes(encodePh4Command({type: "setMode", mode: "standby"}))).toEqual(
      [247, 162, 2, 2, 166, 253]
    )
  })

  it("wraps the checksum around 256", () => {
    expect(computeChecksum([247, 200, 100, 0, 253])).toBe(44)
  })

  it("rounds speeds to the 0.1 km/h resolution and rejects invalid ones", () => {
    expect(encodeSpeed(2.04)).toBe(20)
    expect(() => encodeSpeed(-1)).toThrow(RangeError)
    expect(() => encodeSpeed(30)).toThrow(RangeError)
    expect(() => encodeSpeed(Number.NaN)).toThrow(RangeError)
  })
})

const withChecksum = (frame: number[]) => {
  const bytesWithChecksum = Uint8Array.from(frame)
  bytesWithChecksum[bytesWithChecksum.length - 2] =
    computeChecksum(bytesWithChecksum)
  return bytesWithChecksum
}

const fromHex = (hex: string) =>
  Uint8Array.from(hex.split(" ").map((byte) => parseInt(byte, 16)))

describe("decodePh4Notification", () => {
  it("parses a status frame captured on a C2", () => {
    const frame = fromHex(
      "f8 a2 01 14 01 00 04 ab 00 00 42 00 05 28 00 00 03 00 d9 fd"
    )
    expect(decodePh4Notification(frame)).toEqual({
      type: "status",
      status: {
        rawBeltState: 1,
        beltState: "running",
        speedKmh: 2,
        mode: "manual",
        elapsedSeconds: 1195,
        distanceMeters: 660,
        steps: 1320,
        rawLastRemoteButton: 3,
      },
    })
  })

  it("parses a current status frame", () => {
    const frame = withChecksum([
      0xf8,
      0xa2,
      1, // belt running
      35, // 3.5 km/h
      1, // manual mode
      0x00,
      0x07,
      0x08, // 1800 s
      0x00,
      0x00,
      0xf0, // 240 * 10 m
      0x00,
      0x0b,
      0xb8, // 3000 steps
      105,
      0,
      0,
      0,
      0xfd,
    ])

    expect(decodePh4Notification(frame)).toEqual({
      type: "status",
      status: {
        rawBeltState: 1,
        beltState: "running",
        speedKmh: 3.5,
        mode: "manual",
        elapsedSeconds: 1800,
        distanceMeters: 2400,
        steps: 3000,
        rawLastRemoteButton: 0,
      },
    })
  })

  it("reads the start countdown and the stop captured on a C2", () => {
    const beltStateOf = (hex: string) => {
      const notification = decodePh4Notification(fromHex(hex))
      return notification.type === "status"
        ? notification.status.beltState
        : notification.type
    }
    expect(
      beltStateOf("f8 a2 00 03 01 00 05 9a 00 00 4f 00 06 20 00 00 03 00 bd fd")
    ).toBe("idle")
    expect(
      beltStateOf("f8 a2 09 00 01 00 05 9a 00 00 4f 00 06 20 00 00 03 00 c3 fd")
    ).toBe("starting")
    expect(
      beltStateOf("f8 a2 08 00 01 00 05 9a 00 00 4f 00 06 20 00 00 03 00 c2 fd")
    ).toBe("starting")
    expect(
      beltStateOf("f8 a2 07 00 01 00 05 9a 00 00 4f 00 06 20 00 00 03 00 c1 fd")
    ).toBe("starting")
  })

  it("reads the standby state a C2 falls into after a while", () => {
    const notification = decodePh4Notification(
      withChecksum([
        0xf8, 0xa2, 4, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xfd,
      ])
    )
    expect(notification.type === "status" && notification.status).toMatchObject(
      {beltState: "standby", mode: "standby"}
    )
  })

  it("keeps unknown belt states and modes visible", () => {
    const frame = withChecksum([
      0xf8, 0xa2, 3, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xfd,
    ])
    const notification = decodePh4Notification(frame)
    expect(notification.type === "status" && notification.status).toMatchObject(
      {
        rawBeltState: 3,
        beltState: "unknown",
        mode: "unknown",
      }
    )
  })

  it("parses a last record frame", () => {
    const frame = withChecksum([
      0xf8,
      0xa7,
      0,
      0,
      0,
      0,
      0,
      0,
      0x00,
      0x0e,
      0x10, // 3600 s
      0x00,
      0x01,
      0xf4, // 500 * 10 m
      0x00,
      0x13,
      0x88, // 5000 steps
      0,
      0xfd,
    ])
    expect(decodePh4Notification(frame)).toEqual({
      type: "lastRecord",
      record: {elapsedSeconds: 3600, distanceMeters: 5000, steps: 5000},
    })
  })

  it("rejects frames with a bad checksum", () => {
    const frame = fromHex(
      "f8 a2 01 14 01 00 04 ab 00 00 42 00 05 28 00 00 03 00 00 fd"
    )
    expect(decodePh4Notification(frame).type).toBe("unknown")
  })

  it("leaves the C2 tagged counter frames as unknown", () => {
    expect(
      decodePh4Notification(fromHex("f8 b2 06 0d 04 ab 0a 05 28 ab fd")).type
    ).toBe("unknown")
  })

  it("returns unknown for truncated or foreign frames", () => {
    expect(
      decodePh4Notification(Uint8Array.from([0xf8, 0xa2, 1, 2])).type
    ).toBe("unknown")
    expect(
      decodePh4Notification(Uint8Array.from([0x01, 0x02, 0x03])).type
    ).toBe("unknown")
  })
})
