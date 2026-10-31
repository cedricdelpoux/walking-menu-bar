import {formatClock, formatNumber, formatTimeOfDay} from "@shared/format"
import type {SpeedInterval} from "@shared/strava"
import {useI18n} from "../i18n"

const WIDTH = 300
const HEIGHT = 100
const LEFT_AXIS_WIDTH = 24
const BOTTOM_AXIS_HEIGHT = 14
const HEADER_HEIGHT = 12
const TOP_MARGIN = HEADER_HEIGHT + 4
const SPEED_AXIS_STEP_KMH = 0.5

// The speed axis leaves half a step around the walked speeds, so a flat walk sits mid-height.
function speedAxisRange(intervals: SpeedInterval[]) {
  const speeds = intervals.map((interval) => interval.speedKmh)
  const toNearestStep = (speedKmh: number) =>
    Math.round(speedKmh / SPEED_AXIS_STEP_KMH) * SPEED_AXIS_STEP_KMH
  const minKmh = Math.max(
    0,
    toNearestStep(Math.min(...speeds)) - SPEED_AXIS_STEP_KMH
  )
  const maxKmh = toNearestStep(Math.max(...speeds)) + SPEED_AXIS_STEP_KMH
  return {minKmh, maxKmh}
}

export function SpeedProfileChart({
  intervals,
  startedAt,
  endedAt,
}: {
  intervals: SpeedInterval[]
  startedAt: number
  endedAt: number
}) {
  const {t, locale} = useI18n()
  if (intervals.length === 0) return null

  const totalSeconds = intervals.at(-1)!.endSeconds
  const {minKmh, maxKmh} = speedAxisRange(intervals)
  const plotBottom = HEIGHT - BOTTOM_AXIS_HEIGHT
  const xOf = (seconds: number) =>
    LEFT_AXIS_WIDTH + (seconds / totalSeconds) * (WIDTH - LEFT_AXIS_WIDTH)
  const yOf = (speedKmh: number) =>
    TOP_MARGIN +
    (1 - (speedKmh - minKmh) / (maxKmh - minKmh)) * (plotBottom - TOP_MARGIN)

  const linePath = intervals
    .map((interval, index) => {
      const move =
        index === 0
          ? `M${xOf(interval.startSeconds)},${yOf(interval.speedKmh)}`
          : `V${yOf(interval.speedKmh)}`
      return `${move}H${xOf(interval.endSeconds)}`
    })
    .join("")
  const areaPath = `${linePath}V${plotBottom}H${xOf(0)}Z`
  const labelClassName =
    "fill-current text-[9px] text-black/40 dark:text-white/40"

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img">
      <line
        x1={LEFT_AXIS_WIDTH}
        x2={WIDTH}
        y1={plotBottom}
        y2={plotBottom}
        className="stroke-black/10 dark:stroke-white/15"
      />
      <line
        x1={LEFT_AXIS_WIDTH}
        x2={LEFT_AXIS_WIDTH}
        y1={0}
        y2={plotBottom}
        className="stroke-black/10 dark:stroke-white/15"
      />
      <path d={areaPath} className="fill-accent/20" />
      <path
        d={linePath}
        className="fill-none stroke-accent"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <text
        x={LEFT_AXIS_WIDTH - 3}
        y={TOP_MARGIN + 6}
        textAnchor="end"
        className={labelClassName}
      >
        {formatNumber(maxKmh, locale, 1)}
      </text>
      <text
        x={LEFT_AXIS_WIDTH - 3}
        y={plotBottom}
        textAnchor="end"
        className={labelClassName}
      >
        {formatNumber(minKmh, locale, 1)}
      </text>
      <text x={LEFT_AXIS_WIDTH} y={HEIGHT - 2} className={labelClassName}>
        0
      </text>
      <text
        x={WIDTH}
        y={HEIGHT - 2}
        textAnchor="end"
        className={labelClassName}
      >
        {formatClock(totalSeconds)}
      </text>
      <text
        x={LEFT_AXIS_WIDTH - 3}
        y={HEADER_HEIGHT - 3}
        textAnchor="end"
        className={labelClassName}
      >
        km/h
      </text>
      <text
        x={LEFT_AXIS_WIDTH + 3}
        y={HEADER_HEIGHT - 3}
        className={labelClassName}
      >
        {t("history.timeOfDay")}
      </text>
      <text
        x={LEFT_AXIS_WIDTH + 3}
        y={TOP_MARGIN + 6}
        className={labelClassName}
      >
        {formatTimeOfDay(startedAt, locale)}
      </text>
      <text
        x={WIDTH - 2}
        y={TOP_MARGIN + 6}
        textAnchor="end"
        className={labelClassName}
      >
        {formatTimeOfDay(endedAt, locale)}
      </text>
    </svg>
  )
}
