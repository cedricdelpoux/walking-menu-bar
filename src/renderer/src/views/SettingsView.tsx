import {useEffect, useState, type ReactNode} from "react"
import {Power} from "lucide-react"
import {formatNumber} from "@shared/format"
import {LOCALES, type LanguagePreference} from "@shared/i18n"
import type {LiveState} from "@shared/ipc"
import {createTranslator} from "@shared/i18n"
import {DEFAULT_SPEED_RANGE, speedsInRange} from "@shared/pad"
import {isValidCredentials, type PublicationGrouping} from "@shared/strava"
import {
  ACCENT_COLORS,
  MAX_SPEED_SHORTCUTS,
  PAUSE_TIMEOUT_RANGE_MINUTES,
  type Settings,
  type SettingsPatch,
  type StravaSettings,
} from "@shared/settings"
import {useAppInfo, useStravaState} from "../hooks"
import {ConnectStravaButton} from "../components/StravaControls"
import {useI18n} from "../i18n"
import {stravaErrorMessage} from "../labels"
import {Button, Card, Checkbox, Segmented, cn} from "../components/ui"

const api = window.walkingBar

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && (
          <div className="text-[11px] text-black/50 dark:text-white/50">
            {hint}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const swatchClassName =
  "h-4 w-4 shrink-0 rounded-full outline-offset-2 outline-black/40 dark:outline-white/60"

function AccentColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  const {t} = useI18n()
  const isCustom = !ACCENT_COLORS.includes(value)
  return (
    <div className="flex items-center gap-1.5">
      {ACCENT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          aria-pressed={color === value}
          onClick={() => onChange(color)}
          className={cn(swatchClassName, color === value && "outline-2")}
          style={{backgroundColor: color}}
        />
      ))}
      <label
        title={t("settings.customColor")}
        className={cn(swatchClassName, "relative", isCustom && "outline-2")}
        style={{
          background: isCustom
            ? value
            : "conic-gradient(#ff3b30, #ff9500, #ffcc00, #34c759, #007aff, #af52de, #ff3b30)",
        }}
      >
        <input
          type="color"
          value={value}
          aria-label={t("settings.customColor")}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}

const STRAVA_API_SETTINGS_URL = "https://www.strava.com/settings/api"
const SAVED_SECRET_PLACEHOLDER = "••••••••"

const inputClassName =
  "rounded-md border border-black/10 bg-white px-2 py-1 text-sm outline-none focus:border-accent dark:border-white/15 dark:bg-white/10"

export function SettingsView({
  settings,
  onChange,
  live,
}: {
  settings: Settings
  onChange: (patch: SettingsPatch) => void
  live: LiveState | null
}) {
  const {t, locale} = useI18n()
  const appInfo = useAppInfo()

  const model = live?.model

  return (
    <div className="space-y-3">
      <Card>
        <Row label={t("settings.language")}>
          <select
            className={inputClassName}
            value={settings.language}
            onChange={(event) =>
              onChange({language: event.target.value as LanguagePreference})
            }
          >
            <option value="system">{t("settings.systemLanguage")}</option>
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {t(`settings.languageNames.${code}`)}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t("settings.accentColor")}>
          <AccentColorPicker
            value={settings.accentColor}
            onChange={(accentColor) => onChange({accentColor})}
          />
        </Row>
        <Row
          label={t("settings.launchAtLogin")}
          hint={
            appInfo && !appInfo.isPackaged
              ? t("settings.launchAtLoginDevHint")
              : undefined
          }
        >
          <Checkbox
            checked={settings.launchAtLogin}
            onChange={(isChecked) => onChange({launchAtLogin: isChecked})}
          />
        </Row>
      </Card>

      <Card title={t("settings.pad")}>
        {model && (
          <Row
            label={model.name}
            hint={t("controls.speedRange", {
              min: formatNumber(model.minSpeedKmh, locale, 1),
              max: formatNumber(model.maxSpeedKmh, locale, 1),
            })}
          >
            <Button
              className="px-2 py-1 text-xs"
              onClick={() => void api.forgetPad()}
            >
              {t("settings.forgetPad")}
            </Button>
          </Row>
        )}
        <Row
          label={t("settings.plateauIndicator")}
          hint={t("settings.plateauIndicatorHint")}
        >
          <Checkbox
            checked={settings.showPlateauIndicator}
            onChange={(isChecked) =>
              onChange({showPlateauIndicator: isChecked})
            }
          />
        </Row>
        <SpeedShortcutsSetting
          selectedSpeeds={settings.speedShortcutsKmh}
          availableSpeeds={speedsInRange(model ?? DEFAULT_SPEED_RANGE)}
          onChange={(speedShortcutsKmh) => onChange({speedShortcutsKmh})}
        />
      </Card>

      <StravaSettingsCard
        settings={settings.strava}
        onChange={(strava) => onChange({strava})}
        pauseTimeoutMinutes={settings.pauseTimeoutMinutes}
        onPauseTimeoutChange={(pauseTimeoutMinutes) =>
          onChange({pauseTimeoutMinutes})
        }
      />

      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex flex-col items-start text-[11px] text-black/40 dark:text-white/40">
          <span>
            {appInfo && t("settings.version", {version: appInfo.version})}
          </span>
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={() => void api.revealDiagnosticsLog()}
          >
            {t("settings.showDiagnosticsLog")}
          </button>
        </div>
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() => void api.quit()}
        >
          <Power className="h-3.5 w-3.5" />
          {t("app.quit")}
        </Button>
      </div>
    </div>
  )
}

function SpeedShortcutsSetting({
  selectedSpeeds,
  availableSpeeds,
  onChange,
}: {
  selectedSpeeds: number[]
  availableSpeeds: number[]
  onChange: (speeds: number[]) => void
}) {
  const {t, locale} = useI18n()
  const isFull = selectedSpeeds.length >= MAX_SPEED_SHORTCUTS
  const toggle = (speed: number, isChecked: boolean) =>
    onChange(
      isChecked
        ? [...selectedSpeeds, speed]
        : selectedSpeeds.filter((selected) => selected !== speed)
    )

  return (
    <div className="py-1.5">
      <div className="text-sm">{t("settings.speedShortcuts")}</div>
      <div className="text-[11px] text-black/50 dark:text-white/50">
        {t("settings.speedShortcutsHint", {max: MAX_SPEED_SHORTCUTS})}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-y-1.5">
        {availableSpeeds.map((speed) => {
          const isChecked = selectedSpeeds.includes(speed)
          return (
            <label
              key={speed}
              className="flex cursor-pointer items-center gap-1.5 text-sm tabular-nums"
            >
              <Checkbox
                checked={isChecked}
                disabled={!isChecked && isFull}
                onChange={(checked) => toggle(speed, checked)}
              />
              {formatNumber(speed, locale, 1)}
            </label>
          )
        })}
      </div>
    </div>
  )
}

// Where the sessions end only matters on Strava when each session is its own activity.
function PauseTimeoutRow({
  minutes,
  onChange,
}: {
  minutes: number
  onChange: (minutes: number) => void
}) {
  const {t} = useI18n()
  const [typedMinutes, setTypedMinutes] = useState(String(minutes))

  useEffect(() => setTypedMinutes(String(minutes)), [minutes])

  const commit = () => {
    const parsedMinutes = Number(typedMinutes)
    if (Number.isFinite(parsedMinutes)) onChange(parsedMinutes)
    else setTypedMinutes(String(minutes))
  }

  return (
    <Row
      label={t("settings.pauseTimeout")}
      hint={t("settings.pauseTimeoutHint")}
    >
      <span className="flex items-center gap-1.5 text-sm">
        <input
          type="number"
          min={PAUSE_TIMEOUT_RANGE_MINUTES.min}
          max={PAUSE_TIMEOUT_RANGE_MINUTES.max}
          value={typedMinutes}
          onChange={(event) => setTypedMinutes(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && commit()}
          className={`${inputClassName} w-16 text-right tabular-nums`}
        />
        {t("settings.minutes")}
      </span>
    </Row>
  )
}

function StravaCredentialsForm({clientId}: {clientId: string | null}) {
  const {t} = useI18n()
  const [typedClientId, setTypedClientId] = useState(clientId ?? "")
  const [typedSecret, setTypedSecret] = useState("")
  const [error, setError] = useState<string | null>(null)
  const credentials = {
    clientId: typedClientId.trim(),
    clientSecret: typedSecret.trim(),
  }

  const save = async () => {
    setError(null)
    const result = await api.saveStravaCredentials(credentials)
    if (result.ok) setTypedSecret("")
    else setError(stravaErrorMessage(t, result.error, result.message))
  }

  return (
    <div className="pb-1.5">
      <Row
        label={t("strava.settings.application")}
        hint={t("strava.settings.applicationHint")}
      >
        <a
          href={STRAVA_API_SETTINGS_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent hover:underline"
        >
          strava.com/settings/api
        </a>
      </Row>
      <div className="flex gap-1.5">
        <input
          value={typedClientId}
          placeholder={t("strava.settings.clientId")}
          aria-label={t("strava.settings.clientId")}
          inputMode="numeric"
          onChange={(event) => setTypedClientId(event.target.value)}
          className={`${inputClassName} w-24 tabular-nums`}
        />
        <input
          type="password"
          value={typedSecret}
          placeholder={
            clientId
              ? SAVED_SECRET_PLACEHOLDER
              : t("strava.settings.clientSecret")
          }
          aria-label={t("strava.settings.clientSecret")}
          onChange={(event) => setTypedSecret(event.target.value)}
          className={`${inputClassName} min-w-0 flex-1`}
        />
        <Button
          className="px-2 py-1 text-xs"
          disabled={!isValidCredentials(credentials)}
          onClick={() => void save()}
        >
          {t("strava.settings.saveCredentials")}
        </Button>
      </div>
      {error && <div className="mt-1 text-[11px] text-rose-500">{error}</div>}
    </div>
  )
}

function StravaSettingsCard({
  settings,
  onChange,
  pauseTimeoutMinutes,
  onPauseTimeoutChange,
}: {
  settings: StravaSettings
  onChange: (patch: Partial<StravaSettings>) => void
  pauseTimeoutMinutes: number
  onPauseTimeoutChange: (minutes: number) => void
}) {
  const {t, locale} = useI18n()
  const strava = useStravaState()
  const [titleTemplate, setTitleTemplate] = useState(settings.titleTemplate)

  useEffect(
    () => setTitleTemplate(settings.titleTemplate),
    [settings.titleTemplate]
  )

  if (!strava) return null
  if (!strava.configured) {
    return (
      <Card title={t("strava.title")}>
        <StravaCredentialsForm clientId={null} />
      </Card>
    )
  }

  const athlete = strava.athlete
  const isGroupedBySession = settings.grouping === "session"

  return (
    <Card title={t("strava.title")}>
      {!strava.connected && (
        <StravaCredentialsForm clientId={strava.clientId} />
      )}
      <Row
        label={
          athlete
            ? t("strava.connectedAs", {
                name: `${athlete.firstname} ${athlete.lastname}`,
              })
            : t("strava.connectHint")
        }
      >
        {strava.connected ? (
          <Button
            className="px-2 py-1 text-xs"
            onClick={() => void api.disconnectStrava()}
          >
            {t("strava.disconnect")}
          </Button>
        ) : (
          <ConnectStravaButton />
        )}
      </Row>
      <Row label={t("strava.settings.grouping")}>
        <div className="w-36">
          <Segmented<PublicationGrouping>
            value={settings.grouping}
            onChange={(grouping) => onChange({grouping})}
            options={[
              {value: "day", label: t("strava.settings.groupingDay")},
              {value: "session", label: t("strava.settings.groupingSession")},
            ]}
          />
        </div>
      </Row>
      {isGroupedBySession && (
        <PauseTimeoutRow
          minutes={pauseTimeoutMinutes}
          onChange={onPauseTimeoutChange}
        />
      )}
      <div className="py-1.5">
        <div className="text-sm">{t("strava.settings.titleTemplate")}</div>
        <input
          value={titleTemplate}
          placeholder={createTranslator(locale)("strava.defaultTitle")}
          onChange={(event) => setTitleTemplate(event.target.value)}
          onBlur={() => onChange({titleTemplate})}
          onKeyDown={(event) =>
            event.key === "Enter" && onChange({titleTemplate})
          }
          className={`${inputClassName} mt-1 w-full`}
        />
        <div className="mt-0.5 text-[11px] text-black/50 dark:text-white/50">
          {t("strava.settings.titleTemplateHint")}
        </div>
      </div>
      <Row
        label={t("strava.settings.hideFromHome")}
        hint={t("strava.settings.hideFromHomeHint")}
      >
        <Checkbox
          checked={settings.hideFromHome}
          onChange={(isChecked) => onChange({hideFromHome: isChecked})}
        />
      </Row>
      <Row
        label={t("strava.settings.autoPublish")}
        hint={
          isGroupedBySession
            ? t("strava.settings.autoPublishSessionHint")
            : undefined
        }
      >
        <Checkbox
          checked={settings.autoPublish}
          onChange={(isChecked) => onChange({autoPublish: isChecked})}
        />
      </Row>
      {settings.autoPublish && !isGroupedBySession && (
        <Row label={t("strava.settings.publishTime")}>
          <input
            type="time"
            value={settings.publishTime}
            onChange={(event) =>
              event.target.value && onChange({publishTime: event.target.value})
            }
            className={`${inputClassName} tabular-nums`}
          />
        </Row>
      )}
    </Card>
  )
}
