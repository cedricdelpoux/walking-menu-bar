import type {SessionRecord, SessionValues} from "../../shared/session"
import type {SessionSample} from "../session/session-tracker"
import type {AppDatabase} from "./database"

interface SessionRow {
  id: number
  started_at: number
  ended_at: number
  duration_seconds: number
  distance_meters: number
  steps: number
  max_speed_kmh: number
  is_active: number
  edited_at: number | null
}

const toRecord = (row: SessionRow): SessionRecord => ({
  id: row.id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  durationSeconds: row.duration_seconds,
  distanceMeters: row.distance_meters,
  steps: row.steps,
  maxSpeedKmh: row.max_speed_kmh,
  isActive: row.is_active === 1,
  editedAt: row.edited_at,
})

const toParameters = (session: SessionValues) => ({
  startedAt: session.startedAt,
  endedAt: session.endedAt,
  durationSeconds: session.durationSeconds,
  distanceMeters: session.distanceMeters,
  steps: session.steps,
  maxSpeedKmh: session.maxSpeedKmh,
})

export class SessionRepository {
  constructor(private readonly database: AppDatabase) {}

  transaction<T>(work: () => T): T {
    return this.database.transaction(work)()
  }

  createActiveSession(session: SessionValues): number {
    const result = this.database
      .prepare(
        `INSERT INTO sessions (started_at, ended_at, duration_seconds, distance_meters, steps, max_speed_kmh, is_active)
         VALUES (@startedAt, @endedAt, @durationSeconds, @distanceMeters, @steps, @maxSpeedKmh, 1)`
      )
      .run(toParameters(session))
    return Number(result.lastInsertRowid)
  }

  saveProgress(
    id: number,
    session: SessionValues,
    sample: SessionSample
  ): void {
    this.transaction(() => {
      this.writeValues(id, session)
      this.database
        .prepare(
          `INSERT INTO session_samples (session_id, at, speed_kmh, distance_meters, steps)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          id,
          sample.at,
          sample.speedKmh,
          sample.distanceMeters,
          sample.steps
        )
    })
  }

  completeSession(id: number, session: SessionValues): void {
    this.transaction(() => {
      this.writeValues(id, session)
      this.database
        .prepare("UPDATE sessions SET is_active = 0 WHERE id = ?")
        .run(id)
    })
  }

  deleteSession(id: number): void {
    this.database.prepare("DELETE FROM sessions WHERE id = ?").run(id)
  }

  findById(id: number): SessionRecord | undefined {
    const row = this.database
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as SessionRow | undefined
    return row && toRecord(row)
  }

  findActiveSession(): SessionRecord | undefined {
    const row = this.database
      .prepare(
        "SELECT * FROM sessions WHERE is_active = 1 ORDER BY started_at DESC LIMIT 1"
      )
      .get() as SessionRow | undefined
    return row && toRecord(row)
  }

  listSessionsStartedBetween(
    fromInclusive: number,
    toExclusive: number
  ): SessionRecord[] {
    const rows = this.database
      .prepare(
        "SELECT * FROM sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at"
      )
      .all(fromInclusive, toExclusive) as SessionRow[]
    return rows.map(toRecord)
  }

  listSamples(sessionId: number): SessionSample[] {
    return this.database
      .prepare(
        `SELECT at, speed_kmh AS speedKmh, distance_meters AS distanceMeters, steps
         FROM session_samples WHERE session_id = ? ORDER BY at`
      )
      .all(sessionId) as SessionSample[]
  }

  private writeValues(id: number, session: SessionValues): void {
    this.database
      .prepare(
        `UPDATE sessions SET started_at = @startedAt, ended_at = @endedAt, duration_seconds = @durationSeconds,
         distance_meters = @distanceMeters, steps = @steps, max_speed_kmh = @maxSpeedKmh WHERE id = @id`
      )
      .run({...toParameters(session), id})
  }
}
