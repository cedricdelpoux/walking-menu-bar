import {summarizeSessions} from "./day"
import {formatDuration, formatKilometers, formatNumber} from "./format"
import {createTranslator, type Locale} from "./i18n"
import type {SessionValues} from "./session"
import type {StravaSettings} from "./settings"
import type {ActivityDraft} from "./strava"

// Strava reads start_date_local as a wall-clock time; the offset keeps the UTC instant right.
export function toLocalIsoString(epochMs: number): string {
  const date = new Date(epochMs)
  const pad = (value: number) => String(Math.abs(value)).padStart(2, "0")
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? "+" : "-"
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(offsetMinutes / 60))}:${pad(offsetMinutes % 60)}`
  )
}

export function renderTitle(
  template: string,
  values: Record<string, string>
): string {
  return template
    .replace(/\{(\w+)\}/g, (token, name: string) => values[name] ?? token)
    .trim()
}

export function buildActivityDraft(
  sessions: SessionValues[],
  settings: StravaSettings,
  locale: Locale
): ActivityDraft | null {
  if (sessions.length === 0) return null
  const ordered = [...sessions].sort(
    (left, right) => left.startedAt - right.startedAt
  )
  const summary = summarizeSessions(ordered)
  const t = createTranslator(locale)
  const template = settings.titleTemplate.trim() || t("strava.defaultTitle")
  const name = renderTitle(template, {
    distance: formatKilometers(summary.distanceMeters, locale, 1),
    duration: formatDuration(summary.durationSeconds),
    sessions: String(summary.sessionCount),
    steps: formatNumber(summary.steps, locale),
    date: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
    }).format(ordered[0].startedAt),
  })
  return {
    name: name || t("strava.defaultTitle"),
    description: "",
    sportType: "Walk",
    startDateLocal: toLocalIsoString(ordered[0].startedAt),
    elapsedTimeSeconds: summary.durationSeconds,
    distanceMeters: summary.distanceMeters,
    trainer: true,
  }
}
