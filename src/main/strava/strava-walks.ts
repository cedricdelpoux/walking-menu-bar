import type {
  ActivityDraft,
  StravaWalk,
  StravaWalksByDay,
} from "../../shared/strava"
import type {StravaSummaryActivity} from "./strava-http"

const WALK_SPORT_TYPE = "Walk"
const DISTANCE_MATCH_TOLERANCE_METERS = 1

export function toStravaWalks(
  activities: StravaSummaryActivity[]
): StravaWalk[] {
  return activities
    .filter((activity) => activity.sport_type === WALK_SPORT_TYPE)
    .map((activity) => ({
      id: String(activity.id),
      name: activity.name,
      distanceMeters: activity.distance,
      startDateLocal: activity.start_date_local,
      isTrainer: activity.trainer,
    }))
}

// Strava returns start_date_local as a wall-clock time, so its date is the local day.
export function groupWalksByDay(walks: StravaWalk[]): StravaWalksByDay {
  const walksByDay: StravaWalksByDay = {}
  for (const walk of walks) {
    const day = walk.startDateLocal.slice(0, 10)
    walksByDay[day] = [...(walksByDay[day] ?? []), walk]
  }
  return walksByDay
}

export function findWalkPublishedForDraft(
  walks: StravaWalk[],
  draft: ActivityDraft
): StravaWalk | undefined {
  const wallClockStart = draft.startDateLocal.slice(0, 19)
  return walks.find(
    (walk) =>
      walk.startDateLocal.slice(0, 19) === wallClockStart &&
      Math.abs(walk.distanceMeters - draft.distanceMeters) <
        DISTANCE_MATCH_TOLERANCE_METERS
  )
}

// A treadmill walk already on Strava for that day counts as published, so it is never sent twice.
export function findWalkCoveringDay(
  walks: StravaWalk[],
  draft: ActivityDraft
): StravaWalk | undefined {
  return (
    findWalkPublishedForDraft(walks, draft) ??
    walks.find((walk) => walk.isTrainer)
  )
}
