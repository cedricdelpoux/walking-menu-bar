export interface SessionTotals {
  durationSeconds: number
  distanceMeters: number
  steps: number
  maxSpeedKmh: number
}

export interface SessionValues extends SessionTotals {
  startedAt: number
  endedAt: number
}

export interface SessionRecord extends SessionValues {
  id: number
  isActive: boolean
  editedAt: number | null
}

export function averageSpeedKmh(
  totals: Pick<SessionTotals, "durationSeconds" | "distanceMeters">
): number {
  if (totals.durationSeconds <= 0) return 0
  return (totals.distanceMeters / totals.durationSeconds) * 3.6
}
