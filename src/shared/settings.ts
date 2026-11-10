import type {LanguagePreference, Locale} from "./i18n"
import {SPEED_STEP_KMH} from "./pad"
import type {PublicationGrouping} from "./strava"

export interface StravaSettings {
  grouping: PublicationGrouping
  autoPublish: boolean
  publishTime: string
  titleTemplate: string
  hideFromHome: boolean
}

export interface Settings {
  language: LanguagePreference
  accentColor: string
  weightKg: number | null
  pauseTimeoutMinutes: number
  launchAtLogin: boolean
  speedShortcutsKmh: number[]
  showPlateauIndicator: boolean
  strava: StravaSettings
}

export const ACCENT_COLORS = [
  "#10b981",
  "#007aff",
  "#5856d6",
  "#af52de",
  "#ff2d55",
  "#ff3b30",
  "#ff9500",
  "#8e8e93",
]

export const DEFAULT_SETTINGS: Settings = {
  language: "system",
  accentColor: ACCENT_COLORS[0],
  weightKg: null,
  pauseTimeoutMinutes: 5,
  launchAtLogin: false,
  speedShortcutsKmh: [2, 2.5, 3, 3.5, 4],
  showPlateauIndicator: true,
  strava: {
    grouping: "day",
    autoPublish: true,
    publishTime: "19:00",
    titleTemplate: "",
    hideFromHome: false,
  },
}

export const PAUSE_TIMEOUT_RANGE_MINUTES = {min: 1, max: 60}
// More shortcuts no longer fit on one line of the popover.
export const MAX_SPEED_SHORTCUTS = 6

export function sanitizeSpeedShortcuts(value: unknown): number[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.speedShortcutsKmh
  const speeds = value
    .map((speed) => Math.round(Number(speed) / SPEED_STEP_KMH) * SPEED_STEP_KMH)
    .filter((speed) => Number.isFinite(speed) && speed > 0)
  return [...new Set(speeds)]
    .sort((left, right) => left - right)
    .slice(0, MAX_SPEED_SHORTCUTS)
}

export const TITLE_TEMPLATE_TOKENS = [
  "{distance}",
  "{duration}",
  "{sessions}",
  "{steps}",
  "{date}",
] as const

export interface SettingsSnapshot {
  settings: Settings
  locale: Locale
}

export type SettingsPatch = Partial<Omit<Settings, "strava">> & {
  strava?: Partial<StravaSettings>
}
