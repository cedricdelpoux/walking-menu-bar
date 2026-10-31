import {DEFAULT_SPEED_RANGE, type PadModel} from "../../shared/pad"

// Speed ranges come from the manufacturer specs.
const KNOWN_MODELS: Array<{advertisedName: RegExp; model: PadModel}> = [
  {
    advertisedName: /^KS-.*C2$/i,
    model: {id: "c2", name: "WalkingPad C2", minSpeedKmh: 0.5, maxSpeedKmh: 6},
  },
  {
    advertisedName: /^KS-.*C1$/i,
    model: {id: "c1", name: "WalkingPad C1", minSpeedKmh: 0.5, maxSpeedKmh: 6},
  },
  {
    advertisedName: /^KS-.*A1/i,
    model: {id: "a1", name: "WalkingPad A1", minSpeedKmh: 0.5, maxSpeedKmh: 6},
  },
]

export function identifyPadModel(advertisedName: string): PadModel {
  const known = KNOWN_MODELS.find((candidate) =>
    candidate.advertisedName.test(advertisedName)
  )
  return (
    known?.model ?? {
      id: "unknown",
      name: advertisedName,
      ...DEFAULT_SPEED_RANGE,
    }
  )
}
