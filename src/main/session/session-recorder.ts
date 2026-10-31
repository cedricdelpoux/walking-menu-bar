import type {PadStatus} from "../pad/protocol/types"
import type {AppStateRepository} from "../storage/app-state-repository"
import type {SessionRepository} from "../storage/session-repository"
import type {CounterReading} from "./counter-delta"
import {SessionTracker, type TrackerEvent} from "./session-tracker"

const PAD_COUNTERS_KEY = "padCounters"

export interface SessionRecorderOptions {
  pauseTimeoutMs: number
}

// Persists every tracker event as it happens, so a crash or a sleeping Mac loses at most
// the last status. On startup it resumes the active session and the last pad counters.
export class SessionRecorder {
  private readonly tracker: SessionTracker
  private activeSessionId: number | undefined

  constructor(
    private readonly sessions: SessionRepository,
    private readonly appState: AppStateRepository,
    options: SessionRecorderOptions
  ) {
    const activeSession = sessions.findActiveSession()
    this.activeSessionId = activeSession?.id
    this.tracker = new SessionTracker(options, {
      counters: appState.get<CounterReading>(PAD_COUNTERS_KEY),
      session: activeSession,
    })
  }

  get currentSession() {
    return this.tracker.currentSession
  }

  get pauseTimeoutMs(): number {
    return this.tracker.pauseTimeoutMs
  }

  setPauseTimeout(pauseTimeoutMs: number): void {
    this.tracker.setPauseTimeout(pauseTimeoutMs)
  }

  handleStatus(status: PadStatus, at = Date.now()): TrackerEvent[] {
    const events = this.tracker.handleStatus(status, at)
    this.sessions.transaction(() => {
      this.persist(events)
      this.appState.set(PAD_COUNTERS_KEY, this.tracker.lastCounters)
    })
    return events
  }

  tick(now = Date.now()): TrackerEvent[] {
    const events = this.tracker.tick(now)
    this.persist(events)
    return events
  }

  endSession(): TrackerEvent[] {
    const events = this.tracker.endSession()
    this.persist(events)
    return events
  }

  private persist(events: TrackerEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "sessionStarted":
          this.activeSessionId = this.sessions.createActiveSession(
            event.session
          )
          break
        case "sessionProgressed":
          if (this.activeSessionId !== undefined) {
            this.sessions.saveProgress(
              this.activeSessionId,
              event.session,
              event.sample
            )
          }
          break
        case "sessionEnded":
          if (this.activeSessionId !== undefined)
            this.sessions.completeSession(this.activeSessionId, event.session)
          this.activeSessionId = undefined
          break
      }
    }
  }
}
