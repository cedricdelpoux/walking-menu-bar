import {averageSpeedKmh, type SessionTotals} from "./session"

// Walking on a level surface, from the Compendium of Physical Activities: [from km/h, MET].
const WALKING_METS: [number, number][] = [
  [0, 2],
  [3.2, 2.8],
  [4, 3],
  [4.8, 3.5],
  [5.6, 4.3],
  [6.4, 5],
  [7.2, 7],
]

export const WEIGHT_RANGE_KG = {min: 30, max: 250}

export function getWalkingMet(speedKmh: number): number {
  const bands = WALKING_METS.filter(([fromKmh]) => speedKmh >= fromKmh)
  return bands[bands.length - 1][1]
}

export function estimateCalories(
  totals: Pick<SessionTotals, "durationSeconds" | "distanceMeters">,
  weightKg: number
): number {
  const hours = totals.durationSeconds / 3600
  return Math.round(getWalkingMet(averageSpeedKmh(totals)) * weightKg * hours)
}
