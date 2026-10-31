import {averageSpeedKmh} from "@shared/session"
import {
  formatClock,
  formatDuration,
  formatKilometers,
  formatNumber,
  formatSpeed,
} from "@shared/format"
import type {LiveState} from "@shared/ipc"
import {useNow} from "../hooks"
import {GoalPanel, GoalToggle, useGoalToggle} from "./GoalSection"
import {useI18n} from "../i18n"
import {Card, Stat} from "./ui"

const COUNTDOWN_REFRESH_MS = 1000

function AutomaticEndCountdown({endsAt}: {endsAt: number}) {
  const {t} = useI18n()
  const now = useNow(COUNTDOWN_REFRESH_MS)
  const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000))
  return (
    <p className="mt-2 text-[11px] text-black/50 dark:text-white/50">
      {t("session.endsIn", {time: formatClock(remainingSeconds)})}
    </p>
  )
}

export function CurrentSessionCard({live}: {live: LiveState}) {
  const {t, locale} = useI18n()
  const session = live.currentSession
  const sessionGoalToggle = useGoalToggle("session", live.goals.session)
  if (!session) return null

  const isPaused = live.status?.beltState !== "running"
  return (
    <Card
      title={t("session.title")}
      aside={
        <div className="flex items-center gap-2">
          {isPaused && (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] dark:bg-white/10">
              {t("session.paused")}
            </span>
          )}
          <GoalToggle {...sessionGoalToggle} />
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-2">
        <Stat
          label={t("stats.duration")}
          value={formatClock(session.durationSeconds)}
        />
        <Stat
          label={t("stats.distance")}
          value={formatKilometers(session.distanceMeters, locale)}
        />
        <Stat
          label={t("stats.steps")}
          value={formatNumber(session.steps, locale)}
        />
        <Stat
          label={t("stats.averageSpeed")}
          value={formatNumber(averageSpeedKmh(session), locale, 1)}
        />
      </div>
      {live.sessionEndsAt !== null && (
        <AutomaticEndCountdown endsAt={live.sessionEndsAt} />
      )}
      {sessionGoalToggle.isEnabled && (
        <GoalPanel
          scope="session"
          progress={live.goals.session}
          walked={session}
        />
      )}
    </Card>
  )
}

export function TodayCard({live}: {live: LiveState}) {
  const {t, locale} = useI18n()
  const {today} = live
  const dayGoalToggle = useGoalToggle("day", live.goals.day)
  return (
    <Card title={t("today.title")} aside={<GoalToggle {...dayGoalToggle} />}>
      {today.sessionCount === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          {t("today.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-x-2 gap-y-3">
          <Stat
            label={t("stats.distance")}
            value={formatKilometers(today.distanceMeters, locale)}
          />
          <Stat
            label={t("stats.duration")}
            value={formatDuration(today.durationSeconds)}
          />
          <Stat
            label={t("stats.steps")}
            value={formatNumber(today.steps, locale)}
          />
          <Stat label={t("stats.sessions")} value={today.sessionCount} />
          <Stat
            label={t("stats.averageSpeed")}
            value={formatSpeed(today.averageSpeedKmh, locale)}
          />
          <Stat
            label={t("stats.maxSpeed")}
            value={formatSpeed(today.maxSpeedKmh, locale)}
          />
        </div>
      )}
      {dayGoalToggle.isEnabled && (
        <GoalPanel scope="day" progress={live.goals.day} walked={today} />
      )}
    </Card>
  )
}
