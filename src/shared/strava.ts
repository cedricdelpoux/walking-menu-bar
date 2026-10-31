import type {DayKey} from "./day"

export interface StravaAthlete {
  id: number
  firstname: string
  lastname: string
}

export type StravaErrorCode =
  | "notConfigured"
  | "invalidCredentials"
  | "notConnected"
  | "encryptionUnavailable"
  | "authorizationDenied"
  | "missingScope"
  | "authorizationTimeout"
  | "rateLimited"
  | "network"
  | "api"

export interface StravaCredentials {
  clientId: string
  clientSecret: string
}

export const isValidCredentials = ({
  clientId,
  clientSecret,
}: StravaCredentials) => /^\d+$/.test(clientId) && clientSecret.length > 0

export interface StravaState {
  configured: boolean
  clientId: string | null
  connected: boolean
  connecting: boolean
  athlete: StravaAthlete | null
  connectedAt: number | null
}

export interface ActivityDraft {
  name: string
  description: string
  sportType: "Walk"
  startDateLocal: string
  elapsedTimeSeconds: number
  distanceMeters: number
  trainer: true
}

export type PublicationStatus = "published" | "failed" | "dismissed"

// Strava gets one activity per day, gathering its sessions, or one activity per session.
export type PublicationGrouping = "day" | "session"

export interface PublicationTarget {
  day: DayKey
  sessionId: number | null
}

// The key starts with the day, so the publications of a period sort and filter by day.
export type PublicationKey = string

export const publicationKeyOf = (target: PublicationTarget): PublicationKey =>
  target.sessionId === null
    ? target.day
    : `${target.day}/session-${target.sessionId}`

export const dayTarget = (day: DayKey): PublicationTarget => ({
  day,
  sessionId: null,
})

export interface Publication {
  key: PublicationKey
  status: PublicationStatus
  activityId: string | null
  publishedAt: number | null
  lastError: string | null
  lastErrorCode: StravaErrorCode | null
  attempts: number
  lastAttemptAt: number | null
}

export interface PublicationState {
  target: PublicationTarget
  draft: ActivityDraft | null
  hasActiveSession: boolean
  // The publication of the target, or the one already covering it in the other grouping.
  publication: Publication | null
}

// A stretch of the activity at one speed, as Strava reads it from the uploaded file.
export interface SpeedInterval {
  startSeconds: number
  endSeconds: number
  speedKmh: number
}

export interface StravaWalk {
  id: string
  name: string
  distanceMeters: number
  startDateLocal: string
  isTrainer: boolean
}

export type StravaWalksByDay = Record<DayKey, StravaWalk[]>

export type StravaResult<T> =
  {ok: true; value: T} | {ok: false; error: StravaErrorCode; message: string}

export const stravaActivityUrl = (activityId: string) =>
  `https://www.strava.com/activities/${activityId}`
