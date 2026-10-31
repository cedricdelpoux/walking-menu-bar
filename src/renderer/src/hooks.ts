import {useCallback, useEffect, useState} from "react"
import type {DayHistory} from "@shared/day"
import type {AppInfo, LiveState} from "@shared/ipc"
import type {SettingsPatch, SettingsSnapshot} from "@shared/settings"
import type {
  PublicationState,
  PublicationTarget,
  SpeedInterval,
  StravaState,
} from "@shared/strava"

const api = window.walkingBar

export function useLiveState(): LiveState | null {
  const [state, setState] = useState<LiveState | null>(null)
  useEffect(() => {
    void api.getLiveState().then(setState)
    return api.onLiveState(setState)
  }, [])
  return state
}

export function useHistory(days: number): DayHistory[] | null {
  const [history, setHistory] = useState<DayHistory[] | null>(null)
  useEffect(() => {
    const load = () => void api.listHistory(days).then(setHistory)
    load()
    return api.onHistoryChanged(load)
  }, [days])
  return history
}

export function useSettings(): [
  SettingsSnapshot | null,
  (patch: SettingsPatch) => void,
] {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null)
  useEffect(() => {
    void api.getSettings().then(setSnapshot)
    return api.onSettingsChanged(setSnapshot)
  }, [])
  const update = useCallback(
    (patch: SettingsPatch) => void api.updateSettings(patch).then(setSnapshot),
    []
  )
  return [snapshot, update]
}

export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => void api.getAppInfo().then(setInfo), [])
  return info
}

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

export function useStravaState(): StravaState | null {
  const [state, setState] = useState<StravaState | null>(null)
  useEffect(() => {
    void api.getStravaState().then(setState)
    return api.onStravaChanged(setState)
  }, [])
  return state
}

// Sessions and settings both shape the draft, so it is reloaded when either changes.
// A publication of the day covers its sessions and the other way round: any change of that day
// reloads the state.
export function usePublication(
  target: PublicationTarget
): PublicationState | null {
  const [state, setState] = useState<PublicationState | null>(null)
  const {day, sessionId} = target
  useEffect(() => {
    const load = () => void api.getPublication({day, sessionId}).then(setState)
    load()
    const unsubscribers = [
      api.onPublicationChanged(
        (changedKey) => changedKey.startsWith(day) && load()
      ),
      api.onHistoryChanged(load),
      api.onSettingsChanged(load),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [day, sessionId])
  return state
}

export function useSpeedProfile(
  target: PublicationTarget
): SpeedInterval[] | null {
  const [intervals, setIntervals] = useState<SpeedInterval[] | null>(null)
  const {day, sessionId} = target
  useEffect(() => {
    const load = () =>
      void api.getSpeedProfile({day, sessionId}).then(setIntervals)
    load()
    return api.onHistoryChanged(load)
  }, [day, sessionId])
  return intervals
}
