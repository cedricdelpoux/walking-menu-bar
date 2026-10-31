import {describe, expect, it} from "vitest"
import type {ActivityDraft} from "../../shared/strava"
import {
  findWalkCoveringDay,
  groupWalksByDay,
  toStravaWalks,
} from "./strava-walks"
import type {StravaSummaryActivity} from "./strava-http"

const activity = (
  overrides: Partial<StravaSummaryActivity>
): StravaSummaryActivity => ({
  id: 1,
  name: "Walk",
  sport_type: "Walk",
  start_date_local: "2026-10-20T10:08:54Z",
  distance: 3810,
  trainer: false,
  ...overrides,
})

const draft: ActivityDraft = {
  name: "Treadmill walk",
  description: "",
  sportType: "Walk",
  startDateLocal: "2026-10-20T10:08:54+02:00",
  elapsedTimeSeconds: 6869,
  distanceMeters: 3810,
  trainer: true,
}

describe("Strava walks", () => {
  it("keeps walks only and groups them by local day", () => {
    const walksByDay = groupWalksByDay(
      toStravaWalks([
        activity({
          id: 1,
          start_date_local: "2026-10-16T10:00:00Z",
          name: "Tapis",
        }),
        activity({id: 2, sport_type: "Run"}),
        activity({id: 3, start_date_local: "2026-10-20T23:30:00Z"}),
      ])
    )
    expect(Object.keys(walksByDay)).toEqual(["2026-10-16", "2026-10-20"])
    expect(walksByDay["2026-10-16"][0]).toMatchObject({
      id: "1",
      name: "Tapis",
      isTrainer: false,
    })
  })

  it("finds the walk the app published for the day", () => {
    const walks = toStravaWalks([activity({id: 9, distance: 3810})])
    expect(findWalkCoveringDay(walks, draft)?.id).toBe("9")
  })

  it("counts any treadmill walk of the day as covering it", () => {
    const walks = toStravaWalks([
      activity({
        id: 4,
        start_date_local: "2026-10-20T08:00:00Z",
        distance: 2000,
        trainer: true,
      }),
    ])
    expect(findWalkCoveringDay(walks, draft)?.id).toBe("4")
  })

  it("leaves an outdoor walk of the same day aside", () => {
    const walks = toStravaWalks([
      activity({
        id: 5,
        start_date_local: "2026-10-20T17:00:00Z",
        distance: 5000,
      }),
    ])
    expect(findWalkCoveringDay(walks, draft)).toBeUndefined()
  })
})
