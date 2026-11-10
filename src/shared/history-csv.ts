import {estimateCalories} from "./calories"
import {dayKeyOf} from "./day"
import {averageSpeedKmh, type SessionRecord} from "./session"

const toTimeOfDay = (epochMs: number) => {
  const date = new Date(epochMs)
  const hours = String(date.getHours()).padStart(2, "0")
  return `${hours}:${String(date.getMinutes()).padStart(2, "0")}`
}

export function buildHistoryCsv(
  sessions: SessionRecord[],
  weightKg: number | null
): string {
  const header = [
    "date",
    "start",
    "end",
    "duration_seconds",
    "distance_km",
    "steps",
    "average_speed_kmh",
    "max_speed_kmh",
    ...(weightKg === null ? [] : ["calories_kcal"]),
  ]
  const rows = [...sessions]
    .sort((left, right) => left.startedAt - right.startedAt)
    .map((session) => [
      dayKeyOf(session.startedAt),
      toTimeOfDay(session.startedAt),
      toTimeOfDay(session.endedAt),
      Math.round(session.durationSeconds),
      (session.distanceMeters / 1000).toFixed(3),
      session.steps,
      averageSpeedKmh(session).toFixed(2),
      session.maxSpeedKmh.toFixed(1),
      ...(weightKg === null ? [] : [estimateCalories(session, weightKg)]),
    ])
  return [header, ...rows].map((row) => row.join(",")).join("\n") + "\n"
}
