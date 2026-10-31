import {appendFileSync, mkdirSync, renameSync, statSync} from "node:fs"
import {dirname} from "node:path"

export const MAX_DIAGNOSTIC_LOG_BYTES = 1_000_000

export interface DiagnosticSink {
  write(message: string): void
}

export const silentDiagnostics: DiagnosticSink = {write: () => undefined}

const formatLocalTimestamp = (date: Date) => {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0")
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  )
}

export class DiagnosticLog implements DiagnosticSink {
  constructor(
    readonly filePath: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  write(message: string): void {
    try {
      mkdirSync(dirname(this.filePath), {recursive: true})
      this.rotateWhenFull()
      appendFileSync(
        this.filePath,
        `${formatLocalTimestamp(this.now())} ${message}\n`
      )
    } catch {
      // A diagnostic log that cannot be written must never break the app.
    }
  }

  private rotateWhenFull(): void {
    const sizeBytes =
      statSync(this.filePath, {throwIfNoEntry: false})?.size ?? 0
    if (sizeBytes >= MAX_DIAGNOSTIC_LOG_BYTES)
      renameSync(this.filePath, `${this.filePath}.1`)
  }
}
