import {EventEmitter} from "node:events"
import {
  DEFAULT_SETTINGS,
  PAUSE_TIMEOUT_RANGE_MINUTES,
  sanitizeSpeedShortcuts,
  type Settings,
  type SettingsPatch,
  type StravaSettings,
} from "../shared/settings"
import type {AppStateRepository} from "./storage/app-state-repository"

const SETTINGS_KEY = "settings"
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function clamp(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const number = Number(value)
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback
}

function sanitizeStrava(strava: StravaSettings): StravaSettings {
  const defaults = DEFAULT_SETTINGS.strava
  return {
    grouping: strava.grouping === "session" ? "session" : "day",
    autoPublish:
      typeof strava.autoPublish === "boolean"
        ? strava.autoPublish
        : defaults.autoPublish,
    publishTime: TIME_OF_DAY.test(strava.publishTime)
      ? strava.publishTime
      : defaults.publishTime,
    titleTemplate: String(strava.titleTemplate ?? "").slice(0, 200),
    hideFromHome: Boolean(strava.hideFromHome),
  }
}

function sanitize(settings: Settings): Settings {
  const {min, max} = PAUSE_TIMEOUT_RANGE_MINUTES
  return {
    ...settings,
    accentColor: HEX_COLOR.test(settings.accentColor)
      ? settings.accentColor.toLowerCase()
      : DEFAULT_SETTINGS.accentColor,
    pauseTimeoutMinutes: Math.round(
      clamp(
        settings.pauseTimeoutMinutes,
        min,
        max,
        DEFAULT_SETTINGS.pauseTimeoutMinutes
      )
    ),
    speedShortcutsKmh: sanitizeSpeedShortcuts(settings.speedShortcutsKmh),
    showPlateauIndicator: settings.showPlateauIndicator !== false,
    strava: sanitizeStrava(settings.strava),
  }
}

function merge(base: Settings, patch: SettingsPatch): Settings {
  return {...base, ...patch, strava: {...base.strava, ...patch.strava}}
}

export class SettingsStore extends EventEmitter<{change: [Settings]}> {
  private settings: Settings

  constructor(private readonly appState: AppStateRepository) {
    super()
    this.settings = sanitize(
      merge(DEFAULT_SETTINGS, appState.get<SettingsPatch>(SETTINGS_KEY) ?? {})
    )
  }

  get(): Settings {
    return this.settings
  }

  update(patch: SettingsPatch): Settings {
    this.settings = sanitize(merge(this.settings, patch))
    this.appState.set(SETTINGS_KEY, this.settings)
    this.emit("change", this.settings)
    return this.settings
  }
}
