import {
  averageSpeedKmh,
  type SessionRecord,
  type SessionValues,
} from "./session"

export type DayKey = string

export interface DaySummary {
  sessionCount: number
  durationSeconds: number
  distanceMeters: number
  steps: number
  averageSpeedKmh: number
  maxSpeedKmh: number
  firstStartedAt: number | null
}

export interface DayHistory {
  day: DayKey
  summary: DaySummary
  sessions: SessionRecord[]
}

export function dayKeyOf(epochMs: number): DayKey {
  const date = new Date(epochMs)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function startOfDay(day: DayKey): number {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(year, month - 1, date).getTime()
}

export function addDays(day: DayKey, offset: number): DayKey {
  const [year, month, date] = day.split("-").map(Number)
  return dayKeyOf(new Date(year, month - 1, date + offset).getTime())
}

export function summarizeSessions(sessions: SessionValues[]): DaySummary {
  const durationSeconds = sessions.reduce(
    (total, session) => total + session.durationSeconds,
    0
  )
  const distanceMeters = sessions.reduce(
    (total, session) => total + session.distanceMeters,
    0
  )
  return {
    sessionCount: sessions.length,
    durationSeconds,
    distanceMeters,
    steps: sessions.reduce((total, session) => total + session.steps, 0),
    averageSpeedKmh: averageSpeedKmh({durationSeconds, distanceMeters}),
    maxSpeedKmh: sessions.reduce(
      (max, session) => Math.max(max, session.maxSpeedKmh),
      0
    ),
    firstStartedAt:
      sessions.length > 0
        ? Math.min(...sessions.map((session) => session.startedAt))
        : null,
  }
}

// A session belongs to the day it started on, even when it runs past midnight.
export function groupSessionsByDay(sessions: SessionRecord[]): DayHistory[] {
  const byDay = new Map<DayKey, SessionRecord[]>()
  for (const session of sessions) {
    const day = dayKeyOf(session.startedAt)
    byDay.set(day, [...(byDay.get(day) ?? []), session])
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([day, daySessions]) => {
      const ordered = [...daySessions].sort(
        (left, right) => left.startedAt - right.startedAt
      )
      return {day, summary: summarizeSessions(ordered), sessions: ordered}
    })
}
