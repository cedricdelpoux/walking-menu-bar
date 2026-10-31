import type {Locale} from "./i18n"

export function formatNumber(
  value: number,
  locale: Locale,
  fractionDigits = 0
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

// Strava truncates distances, so 3816 m shows as 3.81 km there: the app does the same.
export function formatKilometerValue(
  meters: number,
  locale: Locale,
  fractionDigits = 2
): string {
  const truncatedKilometers =
    Math.trunc((meters / 1000) * 10 ** fractionDigits + 1e-9) /
    10 ** fractionDigits
  return formatNumber(truncatedKilometers, locale, fractionDigits)
}

export function formatKilometers(
  meters: number,
  locale: Locale,
  fractionDigits = 2
): string {
  return `${formatKilometerValue(meters, locale, fractionDigits)} km`
}

export function formatSpeed(kmh: number, locale: Locale): string {
  return `${formatNumber(kmh, locale, 1)} km/h`
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(
    hours > 0 ? 2 : 1,
    "0"
  )
  const rest = String(seconds % 60).padStart(2, "0")
  return hours > 0 ? `${hours}:${minutes}:${rest}` : `${minutes}:${rest}`
}

export function formatTimeOfDay(epochMs: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(epochMs)
}
