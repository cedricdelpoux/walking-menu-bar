import {useState} from "react"
import {CircleCheck} from "lucide-react"
import {
  formatClock,
  formatDuration,
  formatKilometers,
  formatSpeed,
  formatTimeOfDay,
} from "@shared/format"
import {
  goalCompletionRatio,
  goalPresets,
  isGoalAhead,
  isValidGoal,
  projectGoal,
  type GoalProgress,
  type GoalScope,
  type WalkedTotals,
  type WalkGoal,
  type WalkGoalKind,
} from "@shared/goal"
import {useNow} from "../hooks"
import {useI18n} from "../i18n"
import {Button, Checkbox, Segmented} from "./ui"

const api = window.walkingBar

function goalFromInput(kind: WalkGoalKind, value: number): WalkGoal {
  return kind === "distance"
    ? {kind, targetMeters: Math.round(value * 1000)}
    : {kind, targetSeconds: Math.round(value * 60)}
}

function GoalPicker({scope, walked}: {scope: GoalScope; walked: WalkedTotals}) {
  const {t} = useI18n()
  const [kind, setKind] = useState<WalkGoalKind>("distance")
  const [customValue, setCustomValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  const unit = kind === "distance" ? "km" : "min"
  const presets = goalPresets(kind, walked)

  const setGoal = (value: number) => {
    const goal = goalFromInput(kind, value)
    const nextError = !isValidGoal(goal)
      ? t("goal.invalid")
      : !isGoalAhead(goal, walked)
        ? t("goal.alreadyWalked")
        : null
    setError(nextError)
    if (nextError === null) void api.setGoal(scope, goal)
  }

  return (
    <div className="space-y-2">
      <Segmented<WalkGoalKind>
        value={kind}
        onChange={setKind}
        options={[
          {value: "distance", label: t("goal.distance")},
          {value: "duration", label: t("goal.duration")},
        ]}
      />
      <div className="flex items-center gap-1.5">
        {presets.map((preset) => (
          <Button
            key={preset}
            className="px-2 py-1 text-xs tabular-nums"
            onClick={() => setGoal(preset)}
          >
            {preset} {unit}
          </Button>
        ))}
        <span className="flex-1" />
        <input
          value={customValue}
          inputMode="decimal"
          placeholder={unit}
          onChange={(event) => setCustomValue(event.target.value)}
          onKeyDown={(event) =>
            event.key === "Enter" &&
            setGoal(Number(customValue.replace(",", ".")))
          }
          className="w-14 rounded-md border border-black/10 bg-white px-2 py-1 text-right text-sm text-black tabular-nums outline-none focus:border-accent dark:border-white/15 dark:bg-white/10 dark:text-white"
        />
        <Button
          variant="primary"
          className="px-2 py-1 text-xs"
          onClick={() => setGoal(Number(customValue.replace(",", ".")))}
        >
          {t("goal.set")}
        </Button>
      </div>
      <p
        className={`text-[11px] ${error ? "text-rose-500" : "text-black/50 dark:text-white/50"}`}
      >
        {error ??
          (scope === "session" ? t("goal.hintSession") : t("goal.hintDay"))}
      </p>
    </div>
  )
}

const PROJECTION_REFRESH_MS = 10_000

function GoalProjectionLine({
  progress,
  speedKmh,
}: {
  progress: GoalProgress
  speedKmh: number
}) {
  const {t, locale} = useI18n()
  const now = useNow(PROJECTION_REFRESH_MS)
  const projection = projectGoal(progress, speedKmh)
  if (!projection) return null
  const speed = formatSpeed(speedKmh, locale)
  const time = formatTimeOfDay(now + projection.remainingSeconds * 1000, locale)
  return (
    <p className="text-[11px] text-black/50 tabular-nums dark:text-white/50">
      {progress.goal.kind === "distance"
        ? t("goal.projectedEnd", {
            speed,
            time,
            duration: formatDuration(projection.remainingSeconds),
          })
        : t("goal.projectedDistance", {
            speed,
            time,
            distance: formatKilometers(projection.distanceAtEndMeters, locale),
          })}
    </p>
  )
}

function GoalProgressBar({
  progress,
  speedKmh,
}: {
  progress: GoalProgress
  speedKmh: number | null
}) {
  const {t, locale} = useI18n()
  const {goal} = progress
  const completedPercent = Math.round(goalCompletionRatio(progress) * 100)
  const [walked, target, remaining] =
    goal.kind === "distance"
      ? [
          formatKilometers(progress.walkedMeters, locale),
          formatKilometers(goal.targetMeters, locale),
          formatKilometers(
            Math.max(0, goal.targetMeters - progress.walkedMeters),
            locale
          ),
        ]
      : [
          formatClock(progress.walkedSeconds),
          formatClock(goal.targetSeconds),
          formatDuration(
            Math.max(0, goal.targetSeconds - progress.walkedSeconds)
          ),
        ]

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm tabular-nums">
        <span>
          <span className="font-semibold">{walked}</span>
          <span className="text-black/50 dark:text-white/50"> / {target}</span>
        </span>
        <span className="text-xs text-black/50 dark:text-white/50">
          {t("goal.remaining", {value: remaining})}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{width: `${completedPercent}%`}}
        />
      </div>
      {speedKmh !== null && (
        <GoalProjectionLine progress={progress} speedKmh={speedKmh} />
      )}
    </div>
  )
}

function GoalReached({scope}: {scope: GoalScope}) {
  const {t} = useI18n()
  return (
    <div className="flex items-center gap-2 text-sm">
      <CircleCheck className="h-4 w-4 text-accent" />
      <span className="flex-1 font-medium">{t("goal.reached")}</span>
      <Button
        className="px-2 py-1 text-xs"
        onClick={() => void api.setGoal(scope, null)}
      >
        {t("goal.dismiss")}
      </Button>
    </div>
  )
}

export function useGoalToggle(scope: GoalScope, progress: GoalProgress | null) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const isEnabled = progress !== null || isPickerOpen
  const setEnabled = (isChecked: boolean) => {
    setIsPickerOpen(isChecked)
    if (!isChecked && progress) void api.setGoal(scope, null)
  }
  return {isEnabled, setEnabled}
}

export function GoalToggle({
  isEnabled,
  setEnabled,
}: ReturnType<typeof useGoalToggle>) {
  const {t} = useI18n()
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-black/60 dark:text-white/60">
      {t("goal.title")}
      <Checkbox checked={isEnabled} onChange={setEnabled} />
    </label>
  )
}

export function GoalPanel({
  scope,
  progress,
  walked,
  speedKmh,
}: {
  scope: GoalScope
  progress: GoalProgress | null
  walked: WalkedTotals
  speedKmh: number | null
}) {
  return (
    <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
      {!progress ? (
        <GoalPicker scope={scope} walked={walked} />
      ) : progress.reachedAt !== null ? (
        <GoalReached scope={scope} />
      ) : (
        <GoalProgressBar progress={progress} speedKmh={speedKmh} />
      )}
    </div>
  )
}
