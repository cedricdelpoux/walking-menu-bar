import {useState} from "react"
import {startOfDay} from "@shared/day"
import {
  formatDuration,
  formatKilometerValue,
  formatKilometers,
  formatNumber,
} from "@shared/format"
import type {Locale} from "@shared/i18n"
import {
  buildWalkStats,
  STATS_PERIODS,
  type StatsBar,
  type StatsBarSize,
  type StatsPeriod,
} from "@shared/stats"
import {useHistory} from "../hooks"
import {Card, Segmented, Stat, cn} from "../components/ui"
import {useI18n} from "../i18n"

const ALL_HISTORY_DAYS = 36_600
const WIDTH = 300
const HEIGHT = 84
const TOP_MARGIN = 10
const BOTTOM_AXIS_HEIGHT = 12
const BAR_GAP_RATIO = 0.25
const MIN_BAR_HEIGHT = 2
const MAX_LABELLED_BARS = 12
const MAX_WIDE_LABELS = 6
const MAX_BAR_WIDTH = 28

function toBarDate(key: string): number {
  return startOfDay(key.padEnd(10, "-01").slice(0, 10))
}

function formatBarDate(
  bar: StatsBar,
  locale: Locale,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(locale, options).format(toBarDate(bar.key))
}

const TOOLTIP_FORMATS: Record<StatsBarSize, Intl.DateTimeFormatOptions> = {
  day: {weekday: "short", day: "numeric", month: "short"},
  month: {month: "long", year: "numeric"},
  year: {year: "numeric"},
}

function getAxisFormat(
  barSize: StatsBarSize,
  barCount: number
): Intl.DateTimeFormatOptions {
  if (barSize === "year") return {year: "numeric"}
  if (barSize === "day") {
    return barCount > MAX_LABELLED_BARS
      ? {day: "numeric", month: "short"}
      : {weekday: "narrow"}
  }
  if (barCount > MAX_LABELLED_BARS) return {month: "short", year: "2-digit"}
  return barCount > MAX_WIDE_LABELS ? {month: "narrow"} : {month: "short"}
}

function DistanceBars({
  bars,
  barSize,
}: {
  bars: StatsBar[]
  barSize: StatsBarSize
}) {
  const {locale} = useI18n()
  const maxMeters = Math.max(...bars.map((bar) => bar.distanceMeters))
  const plotBottom = HEIGHT - BOTTOM_AXIS_HEIGHT
  const slotWidth = WIDTH / bars.length
  const barWidth = Math.min(MAX_BAR_WIDTH, slotWidth * (1 - BAR_GAP_RATIO))
  const hasEveryLabel = bars.length <= MAX_LABELLED_BARS
  const axisFormat = getAxisFormat(barSize, bars.length)

  const getBarHeight = (meters: number) =>
    Math.max(MIN_BAR_HEIGHT, (meters / maxMeters) * (plotBottom - TOP_MARGIN))

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mt-2 w-full text-black/40 dark:text-white/40"
    >
      {maxMeters > 0 && (
        <>
          <line
            x1={0}
            x2={WIDTH}
            y1={TOP_MARGIN}
            y2={TOP_MARGIN}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeDasharray="2 3"
            strokeWidth={0.5}
          />
          <text x={0} y={TOP_MARGIN - 3} fontSize={8} fill="currentColor">
            {formatKilometers(maxMeters, locale, 1)}
          </text>
        </>
      )}
      <line
        x1={0}
        x2={WIDTH}
        y1={plotBottom}
        y2={plotBottom}
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeWidth={0.5}
      />
      {bars.map((bar, index) => {
        const isLast = index === bars.length - 1
        const barCenter = slotWidth * (index + 0.5)
        const hasLabel = hasEveryLabel || index === 0 || isLast
        const textAnchor = hasEveryLabel
          ? "middle"
          : index === 0
            ? "start"
            : "end"
        const barHeight = getBarHeight(bar.distanceMeters)
        return (
          <g key={bar.key}>
            {bar.distanceMeters > 0 && (
              <rect
                x={barCenter - barWidth / 2}
                y={plotBottom - barHeight}
                width={barWidth}
                height={barHeight}
                rx={Math.min(1.5, barWidth / 2)}
                className={cn("fill-accent", !isLast && "opacity-60")}
              >
                <title>
                  {`${formatBarDate(bar, locale, TOOLTIP_FORMATS[barSize])} · ${formatKilometers(bar.distanceMeters, locale)}`}
                </title>
              </rect>
            )}
            {hasLabel && (
              <text
                x={hasEveryLabel ? barCenter : index === 0 ? 0 : WIDTH}
                y={HEIGHT - 2}
                fontSize={8}
                textAnchor={textAnchor}
                fill="currentColor"
              >
                {formatBarDate(bar, locale, axisFormat)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function StatsView() {
  const {t, locale} = useI18n()
  const history = useHistory(ALL_HISTORY_DAYS)
  const [period, setPeriod] = useState<StatsPeriod>("month")
  if (!history) return null
  if (history.length === 0) {
    return (
      <p className="p-4 text-sm text-black/50 dark:text-white/50">
        {t("history.empty")}
      </p>
    )
  }

  const stats = buildWalkStats(history, period)
  return (
    <Card>
      <Segmented<StatsPeriod>
        value={period}
        onChange={setPeriod}
        options={STATS_PERIODS.map((value) => ({
          value,
          label: t(`stats.period.${value}`),
        }))}
      />
      <DistanceBars bars={stats.bars} barSize={stats.barSize} />
      <div className="mt-2 grid grid-cols-4 gap-2">
        <Stat
          label="km"
          value={formatKilometerValue(stats.distanceMeters, locale, 1)}
        />
        <Stat
          label={t("stats.duration")}
          value={formatDuration(stats.durationSeconds)}
        />
        <Stat
          label={t("stats.steps")}
          value={formatNumber(stats.steps, locale)}
        />
        <Stat label={t("stats.activeDays")} value={stats.activeDays} />
      </div>
      {stats.bestDayMeters > 0 && (
        <p className="mt-2 text-[11px] text-black/50 dark:text-white/50">
          {t("stats.bestDay", {
            distance: formatKilometers(stats.bestDayMeters, locale),
          })}
        </p>
      )}
    </Card>
  )
}
