import Database from "better-sqlite3"

export type AppDatabase = Database.Database

const MIGRATIONS: string[] = [
  `
  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    distance_meters REAL NOT NULL,
    steps INTEGER NOT NULL,
    max_speed_kmh REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    edited_at INTEGER
  );
  CREATE INDEX sessions_by_start ON sessions(started_at);

  CREATE TABLE session_samples (
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    at INTEGER NOT NULL,
    speed_kmh REAL NOT NULL,
    distance_meters REAL NOT NULL,
    steps INTEGER NOT NULL
  );
  CREATE INDEX session_samples_by_session ON session_samples(session_id, at);

  CREATE TABLE app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE daily_publications (
    day TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    activity_id TEXT,
    published_at INTEGER,
    last_error TEXT,
    last_error_code TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER
  );
  `,
  `
  ALTER TABLE daily_publications RENAME TO publications;
  ALTER TABLE publications RENAME COLUMN day TO key;
  `,
]

export function openDatabase(filename: string): AppDatabase {
  const database = new Database(filename)
  database.pragma("journal_mode = WAL")
  database.pragma("foreign_keys = ON")
  migrate(database)
  return database
}

function migrate(database: AppDatabase): void {
  const currentVersion = database.pragma("user_version", {
    simple: true,
  }) as number
  for (let version = currentVersion; version < MIGRATIONS.length; version++) {
    database.transaction(() => {
      database.exec(MIGRATIONS[version])
      database.pragma(`user_version = ${version + 1}`)
    })()
  }
}
