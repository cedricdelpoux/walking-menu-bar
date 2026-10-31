import {addDays, dayKeyOf, type DayHistory, type DayKey} from "./day"

export const STATS_PERIODS = ["week", "month", "year", "all"] as const

export type StatsPeriod = (typeof STATS_PERIODS)[number]

export type StatsBarSize = "day" | "month" | "year"

export interface StatsBar {
  key: string
  distanceMeters: number
}

export interface WalkStats {
  barSize: StatsBarSize
  bars: StatsBar[]
  distanceMeters: number
  durationSeconds: number
  steps: number
  activeDays: number
  bestDayMeters: number
}

const MONTHS_PER_YEAR = 12
const MAX_MONTH_BARS = 24
const BAR_KEY_LENGTH: Record<StatsBarSize, number> = {
  day: 10,
  month: 7,
  year: 4,
}

const getBarKey = (day: DayKey, barSize: StatsBarSize) =>
  day.slice(0, BAR_KEY_LENGTH[barSize])

function toMonthIndex(day: DayKey): number {
  const [year, month] = day.split("-").map(Number)
  return year * MONTHS_PER_YEAR + month - 1
}

function toMonthKey(monthIndex: number): string {
  const year = Math.floor(monthIndex / MONTHS_PER_YEAR)
  const month = (monthIndex % MONTHS_PER_YEAR) + 1
  return `${year}-${String(month).padStart(2, "0")}`
}

const listLastDays = (today: DayKey, count: number) =>
  Array.from({length: count}, (_, index) => addDays(today, index + 1 - count))

function listMonths(firstDay: DayKey, lastDay: DayKey): string[] {
  const firstMonth = toMonthIndex(firstDay)
  const count = toMonthIndex(lastDay) - firstMonth + 1
  return Array.from({length: count}, (_, index) =>
    toMonthKey(firstMonth + index)
  )
}

function listYears(firstDay: DayKey, lastDay: DayKey): string[] {
  const firstYear = Number(getBarKey(firstDay, "year"))
  const count = Number(getBarKey(lastDay, "year")) - firstYear + 1
  return Array.from({length: count}, (_, index) => String(firstYear + index))
}

function listBarKeys(
  period: StatsPeriod,
  firstWalkDay: DayKey,
  today: DayKey
): {barSize: StatsBarSize; keys: string[]} {
  if (period === "week") return {barSize: "day", keys: listLastDays(today, 7)}
  if (period === "month") return {barSize: "day", keys: listLastDays(today, 30)}
  if (period === "year") {
    const lastMonth = toMonthIndex(today)
    const firstDay = `${toMonthKey(lastMonth - MONTHS_PER_YEAR + 1)}-01`
    return {barSize: "month", keys: listMonths(firstDay, today)}
  }
  const months = listMonths(firstWalkDay, today)
  return months.length > MAX_MONTH_BARS
    ? {barSize: "year", keys: listYears(firstWalkDay, today)}
    : {barSize: "month", keys: months}
}

export function buildWalkStats(
  days: DayHistory[],
  period: StatsPeriod,
  today: DayKey = dayKeyOf(Date.now())
): WalkStats {
  const firstWalkDay = days.map(({day}) => day).sort()[0] ?? today
  const {barSize, keys} = listBarKeys(period, firstWalkDay, today)
  const metersByBar = new Map(keys.map((key) => [key, 0]))
  const periodDays = days.filter(({day}) =>
    metersByBar.has(getBarKey(day, barSize))
  )
  for (const {day, summary} of periodDays) {
    const key = getBarKey(day, barSize)
    metersByBar.set(key, metersByBar.get(key)! + summary.distanceMeters)
  }

  const sumOf = (field: "distanceMeters" | "durationSeconds" | "steps") =>
    periodDays.reduce((total, {summary}) => total + summary[field], 0)
  return {
    barSize,
    bars: keys.map((key) => ({
      key,
      distanceMeters: metersByBar.get(key)!,
    })),
    distanceMeters: sumOf("distanceMeters"),
    durationSeconds: sumOf("durationSeconds"),
    steps: sumOf("steps"),
    activeDays: periodDays.length,
    bestDayMeters: Math.max(
      0,
      ...periodDays.map(({summary}) => summary.distanceMeters)
    ),
  }
}
