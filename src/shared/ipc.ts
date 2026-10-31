import type {DayHistory, DaySummary} from "./day"
import type {GoalProgressByScope, GoalScope, WalkGoal} from "./goal"
import type {
  PadConnectionState,
  PadModel,
  PadStatus,
  PadStop,
  Plateau,
  SelectableMode,
} from "./pad"
import type {SessionValues} from "./session"
import type {SettingsPatch, SettingsSnapshot} from "./settings"
import type {
  Publication,
  PublicationKey,
  PublicationState,
  PublicationTarget,
  SpeedInterval,
  StravaCredentials,
  StravaResult,
  StravaState,
  StravaWalksByDay,
} from "./strava"

export type StartRequestState = "pending" | "failed"

export interface LiveState {
  connection: PadConnectionState
  model: PadModel | null
  status: PadStatus | null
  targetSpeedKmh: number | null
  preferredMode: SelectableMode
  startRequest: StartRequestState | null
  goals: GoalProgressByScope
  currentSession: SessionValues | null
  sessionEndsAt: number | null
  isStopping: boolean
  plateau: Plateau | null
  padStop: PadStop | null
  today: DaySummary
}

export interface AppInfo {
  version: string
  isPackaged: boolean
}

export interface WalkingBarApi {
  getAppInfo(): Promise<AppInfo>
  getLiveState(): Promise<LiveState>
  onLiveState(listener: (state: LiveState) => void): () => void
  startBelt(): Promise<void>
  pauseBelt(): Promise<void>
  endSession(): Promise<void>
  changeSpeed(direction: 1 | -1): Promise<void>
  setSpeed(speedKmh: number): Promise<void>
  setMode(mode: SelectableMode): Promise<void>
  setGoal(scope: GoalScope, goal: WalkGoal | null): Promise<void>
  forgetPad(): Promise<void>
  listHistory(days: number): Promise<DayHistory[]>
  onHistoryChanged(listener: () => void): () => void
  deleteSession(id: number): Promise<void>
  getSettings(): Promise<SettingsSnapshot>
  updateSettings(patch: SettingsPatch): Promise<SettingsSnapshot>
  onSettingsChanged(listener: (snapshot: SettingsSnapshot) => void): () => void
  getStravaState(): Promise<StravaState>
  onStravaChanged(listener: (state: StravaState) => void): () => void
  saveStravaCredentials(
    credentials: StravaCredentials
  ): Promise<StravaResult<StravaState>>
  connectStrava(): Promise<StravaResult<StravaState>>
  disconnectStrava(): Promise<void>
  syncStrava(dayCount: number): Promise<StravaResult<StravaWalksByDay>>
  getPublication(target: PublicationTarget): Promise<PublicationState>
  getSpeedProfile(target: PublicationTarget): Promise<SpeedInterval[]>
  onPublicationChanged(listener: (key: PublicationKey) => void): () => void
  publish(
    target: PublicationTarget,
    overrides: {name?: string; description?: string}
  ): Promise<StravaResult<Publication>>
  dismissPublication(target: PublicationTarget): Promise<void>
  resetPublication(target: PublicationTarget): Promise<void>
  revealDiagnosticsLog(): Promise<void>
  quit(): Promise<void>
  fitWindowHeight(contentHeight: number): Promise<void>
}

export const IpcChannel = {
  getAppInfo: "app:info",
  getLiveState: "live:get",
  liveStateChanged: "live:changed",
  startBelt: "pad:start",
  pauseBelt: "pad:pause",
  endSession: "session:end",
  changeSpeed: "pad:change-speed",
  setSpeed: "pad:set-speed",
  setMode: "pad:set-mode",
  setGoal: "pad:set-goal",
  forgetPad: "pad:forget",
  listHistory: "history:list",
  historyChanged: "history:changed",
  deleteSession: "session:delete",
  getSettings: "settings:get",
  updateSettings: "settings:update",
  settingsChanged: "settings:changed",
  getStravaState: "strava:state",
  stravaChanged: "strava:changed",
  saveStravaCredentials: "strava:save-credentials",
  connectStrava: "strava:connect",
  disconnectStrava: "strava:disconnect",
  syncStrava: "strava:sync",
  getPublication: "publication:get",
  getSpeedProfile: "publication:speed-profile",
  publicationChanged: "publication:changed",
  publish: "publication:publish",
  dismissPublication: "publication:dismiss",
  resetPublication: "publication:reset",
  revealDiagnosticsLog: "app:reveal-diagnostics-log",
  quit: "app:quit",
  fitWindowHeight: "window:fit-height",
} as const
