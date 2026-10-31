import {useState} from "react"
import {Loader2, Minus, Pause, Play, Plus, Square} from "lucide-react"
import {formatClock, formatNumber, formatSpeed} from "@shared/format"
import type {LiveState} from "@shared/ipc"
import {
  PLATEAU_MIN_SECONDS,
  type Plateau,
  type SelectableMode,
} from "@shared/pad"
import {useNow} from "../hooks"
import {useI18n} from "../i18n"
import {Button, Card, cn, Segmented} from "./ui"

const api = window.walkingBar
const ERROR_DISPLAY_MS = 4000

const isSelectableMode = (mode: string | undefined): mode is SelectableMode =>
  mode === "manual" || mode === "automatic"

const PLATEAU_REFRESH_MS = 1000

// Fills while the current speed is held, until Strava can draw it as a plateau.
function PlateauIndicator({plateau}: {plateau: Plateau}) {
  const {t, locale} = useI18n()
  const now = useNow(PLATEAU_REFRESH_MS)
  const walkedMs =
    plateau.walkedMs +
    (plateau.walkingSince === null ? 0 : now - plateau.walkingSince)
  const heldSeconds = Math.max(0, Math.floor(walkedMs / 1000))
  const isReady = heldSeconds >= PLATEAU_MIN_SECONDS
  const labelParams = {
    speed: formatSpeed(plateau.speedKmh, locale),
    time: formatClock(heldSeconds),
  }
  return (
    <div className="mt-3 space-y-1">
      <div
        className={cn(
          "text-[11px] tabular-nums",
          isReady ? "text-accent" : "text-black/50 dark:text-white/50"
        )}
      >
        {isReady
          ? t("controls.plateauReady", labelParams)
          : t("controls.plateau", labelParams)}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            isReady ? "bg-accent" : "bg-black/30 dark:bg-white/40"
          )}
          style={{
            width: `${Math.min(100, (heldSeconds / PLATEAU_MIN_SECONDS) * 100)}%`,
          }}
        />
      </div>
    </div>
  )
}

export function PadControls({
  live,
  speedShortcutsKmh,
  showPlateauIndicator,
}: {
  live: LiveState
  speedShortcutsKmh: number[]
  showPlateauIndicator: boolean
}) {
  const {t, locale} = useI18n()
  const [error, setError] = useState<string | null>(null)

  const {status, model} = live
  const isConnected = live.connection.kind === "connected" && status !== null
  const isRunning = status?.beltState === "running"
  const isStarting = status?.beltState === "starting"
  const statusMode = status?.mode
  const mode = isSelectableMode(statusMode) ? statusMode : live.preferredMode
  const displayedSpeed = live.targetSpeedKmh ?? status?.speedKmh ?? 0
  const canChangeSpeed = isConnected && isRunning && mode === "manual"
  const isWakingUp =
    live.startRequest === "pending" && !isRunning && !isStarting
  const beltLabel = !status
    ? "—"
    : status.beltState === "running"
      ? null
      : t(`belt.${status.beltState}`)
  const speedShortcuts = speedShortcutsKmh.filter(
    (speedKmh) =>
      !model || (speedKmh >= model.minSpeedKmh && speedKmh <= model.maxSpeedKmh)
  )
  const message =
    error ??
    (live.startRequest === "failed" ? t("controls.wakeUpFailed") : null)

  const hasSession = live.currentSession !== null
  const isBeltMoving = isRunning || isStarting
  const padStopMessage =
    live.padStop && !isBeltMoving
      ? t(
          live.padStop.cause === "noSteps"
            ? "controls.padStoppedNoSteps"
            : "controls.padStoppedByPad"
        )
      : null
  const isPaused =
    hasSession && (!isBeltMoving || live.isStopping) && !isWakingUp

  const run = (command: () => Promise<void>) => {
    command().catch(() => {
      setError(t("controls.commandFailed"))
      setTimeout(() => setError(null), ERROR_DISPLAY_MS)
    })
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <Button
          className="h-11 w-11 rounded-full px-0"
          aria-label={t("controls.slower")}
          title={t("controls.slower")}
          disabled={
            !canChangeSpeed ||
            (model !== null && displayedSpeed <= model.minSpeedKmh)
          }
          onClick={() => run(() => api.changeSpeed(-1))}
        >
          <Minus className="h-5 w-5" />
        </Button>

        <div className="text-center">
          <div className="text-4xl font-semibold tabular-nums">
            {formatNumber(displayedSpeed, locale, 1)}
            <span className="ml-1 text-sm font-normal text-black/50 dark:text-white/50">
              km/h
            </span>
          </div>
          {beltLabel && (
            <div className="text-xs text-black/50 dark:text-white/50">
              {beltLabel}
            </div>
          )}
        </div>

        <Button
          className="h-11 w-11 rounded-full px-0"
          aria-label={t("controls.faster")}
          title={t("controls.faster")}
          disabled={
            !canChangeSpeed ||
            (model !== null && displayedSpeed >= model.maxSpeedKmh)
          }
          onClick={() => run(() => api.changeSpeed(1))}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {showPlateauIndicator && hasSession && live.plateau !== null && (
        <PlateauIndicator plateau={live.plateau} />
      )}

      {speedShortcuts.length > 0 && (
        <div className="mt-3">
          <Segmented<string>
            value={String(displayedSpeed)}
            disabled={!canChangeSpeed}
            onChange={(speed) => run(() => api.setSpeed(Number(speed)))}
            options={speedShortcuts.map((speedKmh) => ({
              value: String(speedKmh),
              label: formatNumber(speedKmh, locale, 1),
            }))}
          />
        </div>
      )}

      <div className={speedShortcuts.length > 0 ? "mt-2" : "mt-3"}>
        <Segmented<SelectableMode>
          value={mode}
          disabled={!isConnected}
          onChange={(nextMode) => run(() => api.setMode(nextMode))}
          options={[
            {value: "manual", label: t("controls.manual")},
            {value: "automatic", label: t("controls.automatic")},
          ]}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {isWakingUp ? (
          <Button variant="primary" className="flex-1" disabled>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {hasSession ? t("controls.resume") : t("controls.start")}
          </Button>
        ) : isPaused ? (
          <>
            <Button
              variant="primary"
              className="flex-1"
              disabled={!isConnected || live.isStopping}
              onClick={() => run(api.startBelt)}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {t("controls.resume")}
            </Button>
            <Button
              variant="danger"
              className="flex-1 whitespace-nowrap"
              onClick={() => run(api.endSession)}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              {t("controls.endSession")}
            </Button>
          </>
        ) : isBeltMoving ? (
          <Button
            variant="primary"
            className="flex-1"
            disabled={!isConnected}
            onClick={() => run(api.pauseBelt)}
          >
            <Pause className="h-3.5 w-3.5 fill-current" />
            {t("controls.pause")}
          </Button>
        ) : (
          <Button
            variant="primary"
            className="flex-1"
            disabled={!isConnected}
            onClick={() => run(api.startBelt)}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {t("controls.start")}
          </Button>
        )}
      </div>

      {message && <p className="mt-2 text-xs text-rose-500">{message}</p>}
      {!message && padStopMessage && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {padStopMessage}
        </p>
      )}
    </Card>
  )
}
