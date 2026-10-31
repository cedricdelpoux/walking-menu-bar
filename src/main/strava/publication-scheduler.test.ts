import {describe, expect, it, vi} from "vitest"
import {DEFAULT_SETTINGS, type StravaSettings} from "../../shared/settings"
import type {
  PublicationState,
  PublicationTarget,
  StravaState,
} from "../../shared/strava"
import type {SessionRepository} from "../storage/session-repository"
import type {ActivityPublisher} from "./activity-publisher"
import {PublicationScheduler} from "./publication-scheduler"

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime()

const draft = {
  name: "Walk",
  description: "",
  sportType: "Walk" as const,
  startDateLocal: "",
  elapsedTimeSeconds: 3600,
  distanceMeters: 3000,
  trainer: true as const,
}

function setup(
  {
    settings = {},
    strava = {},
    daysWithSessions = ["2026-10-15", "2026-10-16"],
    now = at(16, 20),
  } = {} as {
    settings?: Partial<StravaSettings>
    strava?: Partial<StravaState>
    daysWithSessions?: string[]
    now?: number
  }
) {
  const publisher = {
    getState: vi.fn((target: PublicationTarget): PublicationState => ({
      target,
      draft: daysWithSessions.includes(target.day) ? draft : null,
      hasActiveSession: false,
      publication: null,
    })),
    publish: vi.fn(async () => ({ok: true}) as never),
  }
  const sessions = {
    listSessionsStartedBetween: (from: number) =>
      daysWithSessions.some(
        (day) => new Date(`${day}T00:00:00`).getTime() === from
      )
        ? [{id: new Date(from).getDate()}]
        : [],
  }
  const scheduler = new PublicationScheduler({
    publisher: publisher as unknown as ActivityPublisher,
    sessions: sessions as unknown as SessionRepository,
    settings: () => ({...DEFAULT_SETTINGS.strava, ...settings}),
    stravaState: () => ({
      configured: true,
      clientId: "1",
      connected: true,
      connecting: false,
      athlete: null,
      connectedAt: at(14, 9),
      ...strava,
    }),
    now: () => now,
  })
  return {scheduler, publisher}
}

describe("PublicationScheduler", () => {
  it("publishes every due day since Strava was connected, oldest first", async () => {
    const {scheduler, publisher} = setup()
    await scheduler.check()
    expect(publisher.publish.mock.calls).toEqual([
      [{day: "2026-10-15", sessionId: null}],
      [{day: "2026-10-16", sessionId: null}],
    ])
  })

  it("leaves today alone before the publish time", async () => {
    const {scheduler, publisher} = setup({now: at(16, 18)})
    await scheduler.check()
    expect(publisher.publish.mock.calls).toEqual([
      [{day: "2026-10-15", sessionId: null}],
    ])
  })

  it("publishes each ended session on its own when grouping by session", async () => {
    const {scheduler, publisher} = setup({
      settings: {grouping: "session"},
      now: at(16, 10),
    })
    await scheduler.check()
    expect(publisher.publish.mock.calls).toEqual([
      [{day: "2026-10-15", sessionId: 15}],
      [{day: "2026-10-16", sessionId: 16}],
    ])
  })

  it("does nothing when automatic publishing is off or Strava is not connected", async () => {
    for (const options of [
      {settings: {autoPublish: false}},
      {strava: {connected: false}},
    ]) {
      const {scheduler, publisher} = setup(options)
      await scheduler.check()
      expect(publisher.publish).not.toHaveBeenCalled()
    }
  })

  it("runs one check at a time", async () => {
    const {scheduler, publisher} = setup()
    await Promise.all([scheduler.check(), scheduler.check()])
    expect(publisher.publish).toHaveBeenCalledTimes(2)
  })
})
