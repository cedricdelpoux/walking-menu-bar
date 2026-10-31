import {describe, expect, it} from "vitest"
import {detectProtocol, looksLikeWalkingPad} from "./detect"
import {normalizeUuid} from "./uuid"

describe("normalizeUuid", () => {
  it("shortens Bluetooth base UUIDs and keeps custom ones", () => {
    expect(normalizeUuid("0000FE00-0000-1000-8000-00805F9B34FB")).toBe("fe00")
    expect(normalizeUuid("fe00")).toBe("fe00")
    expect(normalizeUuid("00010203-0405-0607-0809-0a0b0c0d1912")).toBe(
      "000102030405060708090a0b0c0d1912"
    )
  })
})

describe("detectProtocol", () => {
  it("prefers the KingSmith protocol when the pad exposes it", () => {
    const detected = detectProtocol([
      "180a",
      "0000fe00-0000-1000-8000-00805f9b34fb",
      "1826",
    ])
    expect(detected.kind === "supported" && detected.protocol.id).toBe("ph4")
  })

  it("reports FTMS-only pads separately", () => {
    expect(detectProtocol(["1826"]).kind).toBe("ftms")
    expect(detectProtocol(["180a"]).kind).toBe("none")
  })
})

describe("looksLikeWalkingPad", () => {
  it("matches on name or advertised services", () => {
    expect(looksLikeWalkingPad("WalkingPad", [])).toBe(true)
    expect(looksLikeWalkingPad("KS-ST-C2", [])).toBe(true)
    expect(looksLikeWalkingPad(undefined, ["fe00"])).toBe(true)
    expect(looksLikeWalkingPad("AirPods", ["180a"])).toBe(false)
  })
})
