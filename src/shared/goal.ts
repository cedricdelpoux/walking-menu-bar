export type WalkGoal =
  | {kind: "distance"; targetMeters: number}
  | {kind: "duration"; targetSeconds: number}

export type WalkGoalKind = WalkGoal["kind"]

export type GoalScope = "session" | "day"

export const GOAL_SCOPES: GoalScope[] = ["session", "day"]

export interface WalkedTotals {
  distanceMeters: number
  durationSeconds: number
}

export interface GoalProgress {
  goal: WalkGoal
  walkedMeters: number
  walkedSeconds: number
  reachedAt: number | null
}

export type GoalProgressByScope = Record<GoalScope, GoalProgress | null>

export const MAX_GOAL_DISTANCE_METERS = 100_000
export const MAX_GOAL_DURATION_SECONDS = 24 * 3600

const GOAL_PRESET_COUNT = 3
const DURATION_PRESET_STEP_MINUTES = 15
const MIN_DURATION_PRESET_MINUTES = 30

// The next round values above what is already walked, in km or in minutes: a goal already behind
// would be reached at once.
export function goalPresets(
  kind: WalkGoalKind,
  walked: WalkedTotals
): number[] {
  const first =
    kind === "distance"
      ? Math.floor(walked.distanceMeters / 1000) + 1
      : Math.max(
          MIN_DURATION_PRESET_MINUTES,
          (Math.floor(
            walked.durationSeconds / 60 / DURATION_PRESET_STEP_MINUTES
          ) +
            1) *
            DURATION_PRESET_STEP_MINUTES
        )
  const step = kind === "distance" ? 1 : DURATION_PRESET_STEP_MINUTES
  return Array.from(
    {length: GOAL_PRESET_COUNT},
    (_, index) => first + index * step
  )
}

export function isGoalAhead(goal: WalkGoal, walked: WalkedTotals): boolean {
  return goal.kind === "distance"
    ? goal.targetMeters > walked.distanceMeters
    : goal.targetSeconds > walked.durationSeconds
}

export function isValidGoal(goal: WalkGoal): boolean {
  if (goal.kind === "distance") {
    return (
      Number.isFinite(goal.targetMeters) &&
      goal.targetMeters > 0 &&
      goal.targetMeters <= MAX_GOAL_DISTANCE_METERS
    )
  }
  return (
    Number.isFinite(goal.targetSeconds) &&
    goal.targetSeconds > 0 &&
    goal.targetSeconds <= MAX_GOAL_DURATION_SECONDS
  )
}

export function goalCompletionRatio(progress: GoalProgress): number {
  const {goal} = progress
  const ratio =
    goal.kind === "distance"
      ? progress.walkedMeters / goal.targetMeters
      : progress.walkedSeconds / goal.targetSeconds
  return Math.min(1, ratio)
}
