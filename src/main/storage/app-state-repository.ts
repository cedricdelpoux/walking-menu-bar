import type {AppDatabase} from "./database"

export class AppStateRepository {
  constructor(private readonly database: AppDatabase) {}

  get<T>(key: string): T | undefined {
    const row = this.database
      .prepare("SELECT value FROM app_state WHERE key = ?")
      .get(key) as {value: string} | undefined
    return row ? (JSON.parse(row.value) as T) : undefined
  }

  set<T>(key: string, value: T): void {
    this.database
      .prepare(
        "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(key, JSON.stringify(value))
  }

  delete(key: string): void {
    this.database.prepare("DELETE FROM app_state WHERE key = ?").run(key)
  }
}
