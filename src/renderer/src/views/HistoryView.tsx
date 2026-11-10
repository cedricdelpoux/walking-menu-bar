import {useEffect, useState} from "react"
import {Loader2, Trash2} from "lucide-react"
import type {DayHistory} from "@shared/day"
import {
  formatCalories,
  formatClock,
  formatDuration,
  formatKilometers,
  formatNumber,
  formatSpeed,
  formatTimeOfDay,
} from "@shared/format"
import {averageSpeedKmh, type SessionRecord} from "@shared/session"
import {
  dayTarget,
  type PublicationTarget,
  type StravaWalk,
  type StravaWalksByDay,
} from "@shared/strava"
import {
  useHistory,
  useSettings,
  useSpeedProfile,
  useStravaState,
} from "../hooks"
import type {Locale, Translate} from "@shared/i18n"
import {useCalories} from "../calories"
import {useI18n} from "../i18n"
import {shortDayLabel} from "../labels"
import {SpeedProfileChart} from "../components/SpeedProfileChart"
import {StravaPublicationIcon} from "../components/StravaControls"
import {Button, cn, IconButton} from "../components/ui"

const api = window.walkingBar
const HISTORY_DAYS = 60

const NO_WALKS: StravaWalk[] = []

export interface PublishRequest {
  target: PublicationTarget
  walks: StravaWalk[]
  sessionStartedAt: number | null
}

function useStravaWalksByDay(dayCount: number): {
  walksByDay: StravaWalksByDay
  isSyncing: boolean
} {
  const strava = useStravaState()
  const [walksByDay, setWalksByDay] = useState<StravaWalksByDay>({})
  const [isSyncing, setIsSyncing] = useState(false)
  const isConnected = strava?.connected === true
  // Syncing again whenever the window shows up notices an activity just deleted on Strava, so the
  // day can be published again without leaving the history.
  useEffect(() => {
    if (!isConnected) return
    const sync = () => {
      setIsSyncing(true)
      void api
        .syncStrava(dayCount)
        .then((result) => result.ok && setWalksByDay(result.value))
        .finally(() => setIsSyncing(false))
    }
    const syncWhenShown = () => document.visibilityState === "visible" && sync()
    sync()
    document.addEventListener("visibilitychange", syncWhenShown)
    return () => document.removeEventListener("visibilitychange", syncWhenShown)
  }, [isConnected, dayCount])
  return {walksByDay, isSyncing}
}

interface HistoryRowData {
  key: string
  label: string
  distanceMeters: number
  durationSeconds: number
  sessions: SessionRecord[]
  publishRequest: PublishRequest
}

function toRows(
  history: DayHistory[],
  walksByDay: StravaWalksByDay,
  isGroupedBySession: boolean,
  t: Translate,
  locale: Locale
) {
  return history.flatMap((day): HistoryRowData[] => {
    const walks = walksByDay[day.day] ?? NO_WALKS
    const label = shortDayLabel(day.day, t, locale)
    if (!isGroupedBySession) {
      return [
        {
          key: day.day,
          label,
          distanceMeters: day.summary.distanceMeters,
          durationSeconds: day.summary.durationSeconds,
          sessions: day.sessions,
          publishRequest: {
            target: dayTarget(day.day),
            walks,
            sessionStartedAt: null,
          },
        },
      ]
    }
    return [...day.sessions].reverse().map((session) => ({
      key: `${day.day}/${session.id}`,
      label: `${label} ${formatTimeOfDay(session.startedAt, locale)}`,
      distanceMeters: session.distanceMeters,
      durationSeconds: session.durationSeconds,
      sessions: [session],
      publishRequest: {
        target: {day: day.day, sessionId: session.id},
        walks,
        sessionStartedAt: session.startedAt,
      },
    }))
  })
}

export function HistoryView({
  onPublish,
}: {
  onPublish: (request: PublishRequest) => void
}) {
  const {t, locale} = useI18n()
  const history = useHistory(HISTORY_DAYS)
  const {walksByDay, isSyncing} = useStravaWalksByDay(HISTORY_DAYS)
  const [snapshot] = useSettings()
  const [openRowKey, setOpenRowKey] = useState<string | null>(null)
  const isGroupedBySession = snapshot?.settings.strava.grouping === "session"

  if (history === null) return null
  if (history.length === 0)
    return (
      <p className="p-4 text-sm text-black/50 dark:text-white/50">
        {t("history.empty")}
      </p>
    )

  const headerClassName =
    "px-3 py-1.5 text-left text-[11px] font-medium text-black/50 dark:text-white/50"
  return (
    <div className="max-h-[520px] overflow-y-auto rounded-xl border border-black/5 bg-white/70 dark:border-white/10 dark:bg-white/[0.06]">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-black/5 dark:border-white/10">
            <th className={headerClassName}>{t("history.date")}</th>
            <th className={cn(headerClassName, "text-right")}>km</th>
            <th className={cn(headerClassName, "text-right")}>
              {t("stats.duration")}
            </th>
            <th className={headerClassName}>
              <span className="sr-only">{t("strava.title")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {toRows(history, walksByDay, isGroupedBySession, t, locale).map(
            (row) => (
              <HistoryRow
                key={row.key}
                row={row}
                isOpen={openRowKey === row.key}
                onToggle={() =>
                  setOpenRowKey((current) =>
                    current === row.key ? null : row.key
                  )
                }
                isSyncing={isSyncing}
                onPublish={onPublish}
              />
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

function HistoryRow({
  row,
  isOpen,
  onToggle,
  isSyncing,
  onPublish,
}: {
  row: HistoryRowData
  isOpen: boolean
  onToggle: () => void
  isSyncing: boolean
  onPublish: (request: PublishRequest) => void
}) {
  const {locale} = useI18n()
  const kilometers = formatKilometers(row.distanceMeters, locale).replace(
    " km",
    ""
  )
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        onClick={onToggle}
      >
        <td className="px-3 py-1.5 first-letter:uppercase">{row.label}</td>
        <td className="px-3 py-1.5 text-right">{kilometers}</td>
        <td className="px-3 py-1.5 text-right">
          {formatDuration(row.durationSeconds)}
        </td>
        <td
          className="w-8 py-1.5 pr-3"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="flex justify-end">
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-black/30 dark:text-white/30" />
            ) : (
              <StravaPublicationIcon
                target={row.publishRequest.target}
                onPublish={() => onPublish(row.publishRequest)}
              />
            )}
          </span>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={4} className="bg-black/[0.02] p-0 dark:bg-white/[0.03]">
            {row.sessions.length === 1 ? (
              <SingleSessionSummary session={row.sessions[0]} />
            ) : (
              <div className="px-3 pt-2">
                <WalkSummary sessions={row.sessions} />
              </div>
            )}
            <SpeedProfile
              target={row.publishRequest.target}
              sessions={row.sessions}
            />
            {row.sessions.length > 1 && (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {row.sessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function SpeedProfile({
  target,
  sessions,
}: {
  target: PublicationTarget
  sessions: SessionRecord[]
}) {
  const intervals = useSpeedProfile(target)
  if (!intervals || intervals.length === 0 || sessions.length === 0) return null
  return (
    <div className="px-3 pt-2">
      <SpeedProfileChart
        intervals={intervals}
        startedAt={Math.min(...sessions.map((session) => session.startedAt))}
        endedAt={Math.max(...sessions.map((session) => session.endedAt))}
      />
    </div>
  )
}

function WalkSummary({sessions}: {sessions: SessionRecord[]}) {
  const {t, locale} = useI18n()
  const totals = {
    distanceMeters: sessions.reduce(
      (total, session) => total + session.distanceMeters,
      0
    ),
    durationSeconds: sessions.reduce(
      (total, session) => total + session.durationSeconds,
      0
    ),
  }
  const steps = sessions.reduce((total, session) => total + session.steps, 0)
  return (
    <span className="text-xs text-black/50 tabular-nums dark:text-white/50">
      {formatSpeed(averageSpeedKmh(totals), locale)} ·{" "}
      {formatNumber(steps, locale)} {t("stats.steps").toLowerCase()}
      <CaloriesPart totals={totals} />
    </span>
  )
}

function CaloriesPart({
  totals,
}: {
  totals: Pick<SessionRecord, "durationSeconds" | "distanceMeters">
}) {
  const {locale} = useI18n()
  const calories = useCalories(totals)
  return calories === null ? null : ` · ${formatCalories(calories, locale)}`
}

function SingleSessionSummary({session}: {session: SessionRecord}) {
  const {t} = useI18n()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  if (isConfirmingDelete) {
    return (
      <div className="px-3 pt-2">
        <DeleteConfirmation
          session={session}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      </div>
    )
  }
  return (
    <div className="group flex items-center gap-2 px-3 pt-2">
      <div className="min-w-0 flex-1">
        <WalkSummary sessions={[session]} />
        {session.isActive && (
          <span className="ml-1.5 text-xs text-accent">
            {t("history.inProgress")}
          </span>
        )}
        {session.editedAt !== null && (
          <span className="ml-1.5 text-xs text-black/40 dark:text-white/40">
            {t("history.edited")}
          </span>
        )}
      </div>
      <DeleteButton
        session={session}
        onClick={() => setIsConfirmingDelete(true)}
      />
    </div>
  )
}

function DeleteButton({
  session,
  onClick,
}: {
  session: SessionRecord
  onClick: () => void
}) {
  const {t} = useI18n()
  if (session.isActive) return null
  return (
    <div className="flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
      <IconButton label={t("history.delete")} onClick={onClick}>
        <Trash2 className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  )
}

function DeleteConfirmation({
  session,
  onCancel,
}: {
  session: SessionRecord
  onCancel: () => void
}) {
  const {t} = useI18n()
  return (
    <div className="flex items-center gap-1">
      <span className="flex-1 text-xs">{t("history.confirmDelete")}</span>
      <Button
        variant="danger"
        className="px-2 py-1 text-xs"
        onClick={() => void api.deleteSession(session.id)}
      >
        {t("history.delete")}
      </Button>
      <Button className="px-2 py-1 text-xs" onClick={onCancel}>
        {t("history.cancel")}
      </Button>
    </div>
  )
}

function SessionRow({session}: {session: SessionRecord}) {
  const {t, locale} = useI18n()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  if (isConfirmingDelete) {
    return (
      <li className="px-3 py-2">
        <DeleteConfirmation
          session={session}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      </li>
    )
  }
  return (
    <li className="group flex items-center gap-2 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="tabular-nums">
          {formatTimeOfDay(session.startedAt, locale)}–
          {formatTimeOfDay(session.endedAt, locale)}
          {session.isActive && (
            <span className="ml-1.5 text-xs text-accent">
              {t("history.inProgress")}
            </span>
          )}
          {session.editedAt !== null && (
            <span className="ml-1.5 text-xs text-black/40 dark:text-white/40">
              {t("history.edited")}
            </span>
          )}
        </div>
        <div className="text-xs text-black/50 tabular-nums dark:text-white/50">
          {formatClock(session.durationSeconds)} ·{" "}
          {formatKilometers(session.distanceMeters, locale)} ·{" "}
          {formatSpeed(averageSpeedKmh(session), locale)} ·{" "}
          {formatNumber(session.steps, locale)} {t("stats.steps").toLowerCase()}
          <CaloriesPart totals={session} />
        </div>
      </div>
      <DeleteButton
        session={session}
        onClick={() => setIsConfirmingDelete(true)}
      />
    </li>
  )
}
