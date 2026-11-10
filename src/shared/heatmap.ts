import {addDays, startOfDay, type DayHistory, type DayKey} from "./day"

export const HEATMAP_WEEKS = 26
export const HEATMAP_LEVELS = 4

export interface HeatmapDay {
  day: DayKey
  distanceMeters: number
  level: number
}

// Weeks start on Monday; the days after today are left out of the last week.
export function buildHeatmap(
  days: DayHistory[],
  today: DayKey,
  weekCount = HEATMAP_WEEKS
): HeatmapDay[][] {
  const metersByDay = new Map(
    days.map(({day, summary}) => [day, summary.distanceMeters])
  )
  const weekday = (new Date(startOfDay(today)).getDay() + 6) % 7
  const firstDay = addDays(today, -weekday - (weekCount - 1) * 7)
  const weeks = Array.from({length: weekCount}, (_, week) =>
    Array.from({length: 7}, (_, index) => addDays(firstDay, week * 7 + index))
      .filter((day) => day <= today)
      .map((day) => ({day, distanceMeters: metersByDay.get(day) ?? 0}))
  )
  const maxMeters = Math.max(
    0,
    ...weeks.flat().map(({distanceMeters}) => distanceMeters)
  )
  return weeks.map((week) =>
    week.map((cell) => ({
      ...cell,
      level:
        maxMeters > 0
          ? Math.ceil((cell.distanceMeters / maxMeters) * HEATMAP_LEVELS)
          : 0,
    }))
  )
}
