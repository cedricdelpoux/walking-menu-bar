import type {DayKey} from "../../shared/day"
import type {
  Publication,
  PublicationKey,
  PublicationStatus,
  StravaErrorCode,
} from "../../shared/strava"
import type {AppDatabase} from "./database"

interface PublicationRow {
  key: string
  status: PublicationStatus
  activity_id: string | null
  published_at: number | null
  last_error: string | null
  last_error_code: StravaErrorCode | null
  attempts: number
  last_attempt_at: number | null
}

const toPublication = (row: PublicationRow): Publication => ({
  key: row.key,
  status: row.status,
  activityId: row.activity_id,
  publishedAt: row.published_at,
  lastError: row.last_error,
  lastErrorCode: row.last_error_code,
  attempts: row.attempts,
  lastAttemptAt: row.last_attempt_at,
})

export class PublicationRepository {
  constructor(private readonly database: AppDatabase) {}

  find(key: PublicationKey): Publication | undefined {
    const row = this.database
      .prepare("SELECT * FROM publications WHERE key = ?")
      .get(key) as PublicationRow | undefined
    return row && toPublication(row)
  }

  // Keys start with their day, so the day itself and the keys of its sessions sort from it.
  listFrom(fromDay: DayKey): Publication[] {
    const rows = this.database
      .prepare("SELECT * FROM publications WHERE key >= ? ORDER BY key")
      .all(fromDay) as PublicationRow[]
    return rows.map(toPublication)
  }

  listOfDay(day: DayKey): Publication[] {
    const rows = this.database
      .prepare(
        "SELECT * FROM publications WHERE key = ? OR key LIKE ? || '/%' ORDER BY key"
      )
      .all(day, day) as PublicationRow[]
    return rows.map(toPublication)
  }

  markPublished(
    key: PublicationKey,
    activityId: string,
    at: number
  ): Publication {
    this.database
      .prepare(
        `INSERT INTO publications (key, status, activity_id, published_at, attempts, last_attempt_at)
         VALUES (@key, 'published', @activityId, @at, 1, @at)
         ON CONFLICT(key) DO UPDATE SET status = 'published', activity_id = @activityId, published_at = @at,
           last_error = NULL, last_error_code = NULL, attempts = attempts + 1, last_attempt_at = @at`
      )
      .run({key, activityId, at})
    return this.find(key)!
  }

  markFailed(
    key: PublicationKey,
    errorCode: StravaErrorCode,
    message: string,
    at: number
  ): Publication {
    this.database
      .prepare(
        `INSERT INTO publications (key, status, last_error, last_error_code, attempts, last_attempt_at)
         VALUES (@key, 'failed', @message, @errorCode, 1, @at)
         ON CONFLICT(key) DO UPDATE SET status = 'failed', last_error = @message, last_error_code = @errorCode,
           attempts = attempts + 1, last_attempt_at = @at`
      )
      .run({key, errorCode, message, at})
    return this.find(key)!
  }

  markDismissed(key: PublicationKey, at: number): Publication {
    this.database
      .prepare(
        `INSERT INTO publications (key, status, last_attempt_at) VALUES (@key, 'dismissed', @at)
         ON CONFLICT(key) DO UPDATE SET status = 'dismissed', last_error = NULL, last_error_code = NULL`
      )
      .run({key, at})
    return this.find(key)!
  }

  forgetDeletedActivity(key: PublicationKey, activityId: string): void {
    this.database
      .prepare(
        "DELETE FROM publications WHERE key = ? AND status = 'published' AND activity_id = ?"
      )
      .run(key, activityId)
  }

  // Only a target that was not actually published can be reset, so an activity id is never lost.
  reset(key: PublicationKey): void {
    this.database
      .prepare(
        "DELETE FROM publications WHERE key = ? AND status != 'published'"
      )
      .run(key)
  }
}
