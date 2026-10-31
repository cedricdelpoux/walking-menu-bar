import {SPEED_STEP_KMH, type PadModel} from "../../shared/pad"

const EPSILON = 1e-6

// Moves to the next multiple of the step, so 2.2 km/h goes up to 2.5 and down to 2.0.
export function nextTargetSpeed(
  currentKmh: number,
  direction: 1 | -1,
  model: PadModel
): number {
  const stepsFromZero = currentKmh / SPEED_STEP_KMH
  const nextStep =
    direction > 0
      ? Math.floor(stepsFromZero + EPSILON) + 1
      : Math.ceil(stepsFromZero - EPSILON) - 1
  return clampToModel(nextStep * SPEED_STEP_KMH, model)
}

export function clampToModel(speedKmh: number, model: PadModel): number {
  return Math.min(model.maxSpeedKmh, Math.max(model.minSpeedKmh, speedKmh))
}
