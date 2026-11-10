import {EventEmitter} from "node:events"
import {
  DEFAULT_SETTINGS,
  PAUSE_TIMEOUT_RANGE_MINUTES,
  sanitizeSpeedShortcuts,
  SHORTCUT_ACTIONS,
  type Settings,
  type SettingsPatch,
  type Shortcuts,
  type StravaSettings,
} from "../shared/settings"
import {WEIGHT_RANGE_KG} from "../shared/calories"
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

function sanitizeWeight(weightKg: unknown): number | null {
  const number = Number(weightKg)
  if (weightKg === null || !Number.isFinite(number) || number <= 0) return null
  return Math.round(clamp(number, WEIGHT_RANGE_KG.min, WEIGHT_RANGE_KG.max, 0))
}

const ACCELERATOR = /^[A-Za-z0-9+]{0,60}$/

function sanitizeShortcuts(shortcuts: Shortcuts): Shortcuts {
  return Object.fromEntries(
    SHORTCUT_ACTIONS.map((action) => [
      action,
      typeof shortcuts[action] === "string" &&
      ACCELERATOR.test(shortcuts[action])
        ? shortcuts[action]
        : DEFAULT_SETTINGS.shortcuts[action],
    ])
  ) as Shortcuts
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
    weightKg: sanitizeWeight(settings.weightKg),
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
    shortcuts: sanitizeShortcuts(settings.shortcuts),
    strava: sanitizeStrava(settings.strava),
  }
}

function merge(base: Settings, patch: SettingsPatch): Settings {
  return {
    ...base,
    ...patch,
    shortcuts: {...base.shortcuts, ...patch.shortcuts},
    strava: {...base.strava, ...patch.strava},
  }
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
