import {dayKeyOf, startOfDay, type DayHistory} from "@shared/day"
import {formatKilometers} from "@shared/format"
import {buildHeatmap, HEATMAP_LEVELS} from "@shared/heatmap"
import {useNow} from "../hooks"
import {useI18n} from "../i18n"

const CELL = 9
const GAP = 2
const MONTH_LABEL_HEIGHT = 11
const TODAY_REFRESH_MS = 60_000

export function ActivityHeatmap({history}: {history: DayHistory[]}) {
  const {locale} = useI18n()
  const today = dayKeyOf(useNow(TODAY_REFRESH_MS))
  const weeks = buildHeatmap(history, today)
  const step = CELL + GAP
  const monthFormat = new Intl.DateTimeFormat(locale, {month: "short"})
  const dayFormat = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
  const getMonth = (weekIndex: number) => weeks[weekIndex][0].day.slice(5, 7)

  return (
    <svg
      viewBox={`0 0 ${weeks.length * step - GAP} ${MONTH_LABEL_HEIGHT + 7 * step - GAP}`}
      className="w-full text-black/40 dark:text-white/40"
    >
      {weeks.map((week, weekIndex) => (
        <g key={week[0].day}>
          {weekIndex > 0 && getMonth(weekIndex) !== getMonth(weekIndex - 1) && (
            <text
              x={weekIndex * step}
              y={MONTH_LABEL_HEIGHT - 3}
              fontSize={8}
              fill="currentColor"
            >
              {monthFormat.format(startOfDay(week[0].day))}
            </text>
          )}
          {week.map((cell, dayIndex) => (
            <rect
              key={cell.day}
              x={weekIndex * step}
              y={MONTH_LABEL_HEIGHT + dayIndex * step}
              width={CELL}
              height={CELL}
              rx={2}
              className={cell.level > 0 ? "fill-accent" : "fill-current"}
              fillOpacity={
                cell.level > 0
                  ? 0.25 + (0.75 * cell.level) / HEATMAP_LEVELS
                  : 0.2
              }
            >
              <title>
                {`${dayFormat.format(startOfDay(cell.day))} · ${formatKilometers(cell.distanceMeters, locale)}`}
              </title>
            </rect>
          ))}
        </g>
      ))}
    </svg>
  )
}
