import {addDays, dayKeyOf, startOfDay, type DayKey} from "@shared/day"
import type {Locale, Translate} from "@shared/i18n"
import type {StravaErrorCode} from "@shared/strava"

export function dayLabel(day: DayKey, t: Translate, locale: Locale): string {
  const today = dayKeyOf(Date.now())
  if (day === today) return t("history.today")
  if (day === addDays(today, -1)) return t("history.yesterday")
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(startOfDay(day))
}

export function shortDayLabel(
  day: DayKey,
  t: Translate,
  locale: Locale
): string {
  const today = dayKeyOf(Date.now())
  if (day === today) return t("history.today")
  if (day === addDays(today, -1)) return t("history.yesterday")
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(startOfDay(day))
}

export function stravaErrorMessage(
  t: Translate,
  code: StravaErrorCode | null,
  message: string | null
): string {
  if (!code || code === "api")
    return [t("strava.errors.api"), message].filter(Boolean).join(" ")
  return t(`strava.errors.${code}`)
}
