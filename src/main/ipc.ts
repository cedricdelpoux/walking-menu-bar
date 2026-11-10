import {ipcMain, type WebContents} from "electron"
import {groupSessionsByDay, startOfDay, addDays, dayKeyOf} from "../shared/day"
import {IpcChannel, type AppInfo} from "../shared/ipc"
import {
  GOAL_SCOPES,
  isValidGoal,
  type GoalScope,
  type WalkGoal,
} from "../shared/goal"
import type {SelectableMode} from "../shared/pad"
import type {SettingsPatch, SettingsSnapshot} from "../shared/settings"
import type {PadService} from "./pad/pad-service"
import type {SessionRepository} from "./storage/session-repository"
import {
  isValidCredentials,
  type PublicationTarget,
  type StravaCredentials,
} from "../shared/strava"
import type {
  ActivityPublisher,
  DraftOverrides,
} from "./strava/activity-publisher"
import type {StravaAccount} from "./strava/strava-account"

const MAX_HISTORY_DAYS = 36_600
const MAX_STRAVA_SYNC_DAYS = 366

export interface IpcDependencies {
  appInfo: AppInfo
  padService: PadService
  sessions: SessionRepository
  getSettings: () => SettingsSnapshot
  updateSettings: (patch: SettingsPatch) => SettingsSnapshot
  stravaAccount: StravaAccount
  publisher: ActivityPublisher
  exportHistory: () => Promise<void>
  revealDiagnosticsLog: () => void
  quit: () => void
  fitWindowHeight: (contentHeight: number) => void
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function assertDayKey(day: string): string {
  if (typeof day !== "string" || !DAY_KEY.test(day))
    throw new Error(`Invalid day: ${day}`)
  return day
}

function assertTarget(target: PublicationTarget): PublicationTarget {
  const {sessionId} = target ?? {}
  if (sessionId !== null && !(Number.isInteger(sessionId) && sessionId > 0))
    throw new Error(`Invalid session: ${sessionId}`)
  return {day: assertDayKey(target.day), sessionId}
}

function assertCredentials(credentials: StravaCredentials): StravaCredentials {
  if (
    typeof credentials?.clientId !== "string" ||
    typeof credentials.clientSecret !== "string"
  ) {
    throw new Error("Invalid Strava credentials")
  }
  const trimmed = {
    clientId: credentials.clientId.trim(),
    clientSecret: credentials.clientSecret.trim(),
  }
  if (!isValidCredentials(trimmed))
    throw new Error("Invalid Strava credentials")
  return trimmed
}

function sanitizeOverrides(
  overrides: DraftOverrides | undefined
): DraftOverrides {
  return {
    name:
      typeof overrides?.name === "string"
        ? overrides.name.slice(0, 255)
        : undefined,
    description:
      typeof overrides?.description === "string"
        ? overrides.description.slice(0, 10_000)
        : undefined,
  }
}

export function registerIpcHandlers(dependencies: IpcDependencies): void {
  const {padService, sessions} = dependencies

  ipcMain.handle(IpcChannel.getAppInfo, () => dependencies.appInfo)
  ipcMain.handle(IpcChannel.getLiveState, () => padService.getLiveState())
  ipcMain.handle(IpcChannel.startBelt, () => padService.startBelt())
  ipcMain.handle(IpcChannel.pauseBelt, () => padService.pauseBelt())
  ipcMain.handle(IpcChannel.endSession, () => padService.endSession())
  ipcMain.handle(IpcChannel.changeSpeed, (_event, direction: 1 | -1) =>
    padService.changeSpeed(direction > 0 ? 1 : -1)
  )
  ipcMain.handle(IpcChannel.setSpeed, (_event, speedKmh: number) => {
    if (typeof speedKmh !== "number" || !Number.isFinite(speedKmh))
      throw new Error(`Invalid speed: ${speedKmh}`)
    return padService.setSpeed(speedKmh)
  })
  ipcMain.handle(IpcChannel.setMode, (_event, mode: SelectableMode) => {
    if (mode !== "manual" && mode !== "automatic")
      throw new Error(`Invalid mode: ${mode}`)
    return padService.setMode(mode)
  })
  ipcMain.handle(
    IpcChannel.setGoal,
    (_event, scope: GoalScope, goal: WalkGoal | null) => {
      if (!GOAL_SCOPES.includes(scope))
        throw new Error(`Invalid goal scope: ${scope}`)
      if (goal !== null && !isValidGoal(goal)) throw new Error("Invalid goal")
      padService.setGoal(scope, goal)
    }
  )
  ipcMain.handle(IpcChannel.forgetPad, () => padService.forgetPad())

  ipcMain.handle(IpcChannel.listHistory, (_event, days: number) => {
    const dayCount = Math.min(MAX_HISTORY_DAYS, Math.max(1, Math.round(days)))
    const today = dayKeyOf(Date.now())
    const from = startOfDay(addDays(today, 1 - dayCount))
    return groupSessionsByDay(
      sessions.listSessionsStartedBetween(from, startOfDay(addDays(today, 1)))
    )
  })
  ipcMain.handle(IpcChannel.deleteSession, (_event, id: number) => {
    sessions.deleteSession(id)
    padService.emit("historyChanged")
  })
  ipcMain.handle(IpcChannel.exportHistory, () => dependencies.exportHistory())

  ipcMain.handle(IpcChannel.getSettings, () => dependencies.getSettings())
  ipcMain.handle(IpcChannel.updateSettings, (_event, patch: SettingsPatch) =>
    dependencies.updateSettings(patch)
  )

  const {stravaAccount, publisher} = dependencies
  ipcMain.handle(IpcChannel.getStravaState, () => stravaAccount.getState())
  ipcMain.handle(
    IpcChannel.saveStravaCredentials,
    (_event, credentials: StravaCredentials) =>
      stravaAccount.saveCredentials(assertCredentials(credentials))
  )
  ipcMain.handle(IpcChannel.connectStrava, () => stravaAccount.connect())
  ipcMain.handle(IpcChannel.disconnectStrava, () => stravaAccount.disconnect())
  ipcMain.handle(IpcChannel.syncStrava, (_event, dayCount: number) =>
    publisher.syncWithStrava(
      Math.min(MAX_STRAVA_SYNC_DAYS, Math.max(1, Math.round(dayCount)))
    )
  )
  ipcMain.handle(
    IpcChannel.getPublication,
    (_event, target: PublicationTarget) =>
      publisher.getState(assertTarget(target))
  )
  ipcMain.handle(
    IpcChannel.getSpeedProfile,
    (_event, target: PublicationTarget) =>
      publisher.speedProfile(assertTarget(target))
  )
  ipcMain.handle(
    IpcChannel.publish,
    (_event, target: PublicationTarget, overrides: DraftOverrides) =>
      publisher.publish(assertTarget(target), sanitizeOverrides(overrides))
  )
  ipcMain.handle(
    IpcChannel.dismissPublication,
    (_event, target: PublicationTarget) =>
      void publisher.dismiss(assertTarget(target))
  )
  ipcMain.handle(
    IpcChannel.resetPublication,
    (_event, target: PublicationTarget) => publisher.reset(assertTarget(target))
  )
  ipcMain.handle(IpcChannel.revealDiagnosticsLog, () =>
    dependencies.revealDiagnosticsLog()
  )
  ipcMain.handle(IpcChannel.quit, () => dependencies.quit())
  ipcMain.handle(
    IpcChannel.fitWindowHeight,
    (_event, contentHeight: number) => {
      if (typeof contentHeight !== "number" || !Number.isFinite(contentHeight))
        throw new Error(`Invalid height: ${contentHeight}`)
      dependencies.fitWindowHeight(contentHeight)
    }
  )
}

export function broadcast(
  webContents: WebContents,
  channel: string,
  payload?: unknown
): void {
  if (!webContents.isDestroyed()) webContents.send(channel, payload)
}
