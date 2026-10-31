// Connects to the pad and records sessions into a local SQLite database, without any UI.
//
// Usage: npm run record -- [--db walkingbar.dev.db] [--pause-minutes 5] [--verbose]
import {averageSpeedKmh, type SessionValues} from "../src/shared/session"
import {
  PadConnection,
  type PadConnectionState,
} from "../src/main/pad/pad-connection"
import {SessionRecorder} from "../src/main/session/session-recorder"
import type {TrackerEvent} from "../src/main/session/session-tracker"
import {AppStateRepository} from "../src/main/storage/app-state-repository"
import {openDatabase} from "../src/main/storage/database"
import {SessionRepository} from "../src/main/storage/session-repository"

const PERIPHERAL_ID_KEY = "padPeripheralId"
const TICK_INTERVAL_MS = 15000
const LIVE_LOG_INTERVAL_MS = 10000

const argv = process.argv.slice(2)
const valueAfter = (flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] : undefined
}
const databasePath = valueAfter("--db") ?? "walkingbar.dev.db"
const pauseTimeoutMs = Number(valueAfter("--pause-minutes") ?? 5) * 60_000
const verbose = argv.includes("--verbose")

const time = (epochMs: number) =>
  new Date(epochMs).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
const now = () => new Date().toLocaleTimeString("fr-FR")

function describeSession(session: SessionValues): string {
  const minutes = Math.round(session.durationSeconds / 60)
  return [
    `${time(session.startedAt)}–${time(session.endedAt)}`,
    `${minutes} min`,
    `${(session.distanceMeters / 1000).toFixed(2)} km`,
    `${session.steps} steps`,
    `avg ${averageSpeedKmh(session).toFixed(1)} km/h`,
    `max ${session.maxSpeedKmh.toFixed(1)} km/h`,
  ].join("  ")
}

function describeState(state: PadConnectionState): string {
  switch (state.kind) {
    case "connected":
      return `connected to ${state.padName} (${state.protocolId})`
    case "connecting":
      return `connecting to ${state.padName}...`
    case "retrying":
      return `${state.failure}, retrying in ${Math.round((state.retryAt - Date.now()) / 1000)}s`
    case "bluetoothUnavailable":
      return `Bluetooth unavailable (${state.adapterState})`
    default:
      return state.kind
  }
}

const database = openDatabase(databasePath)
const sessions = new SessionRepository(database)
const appState = new AppStateRepository(database)
const recorder = new SessionRecorder(sessions, appState, {pauseTimeoutMs})

function printToday() {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const today = sessions.listSessionsStartedBetween(
    startOfDay.getTime(),
    startOfDay.getTime() + 86_400_000
  )
  console.log(`\nToday's sessions in ${databasePath}:`)
  if (today.length === 0) console.log("  (none)")
  for (const session of today)
    console.log(
      `  #${session.id}${session.isActive ? " (active)" : ""}  ${describeSession(session)}`
    )
  console.log()
}

function logEvents(events: TrackerEvent[]) {
  for (const event of events) {
    if (event.type === "sessionStarted")
      console.log(`${now()}  ▶ session started`)
    if (event.type === "sessionEnded") {
      console.log(
        `${now()}  ■ session ended: ${describeSession(event.session)}`
      )
      printToday()
    }
  }
}

printToday()

const connection = new PadConnection({
  preferredPeripheralId: appState.get<string>(PERIPHERAL_ID_KEY),
})
connection.on("state", (state) => {
  console.log(`${now()}  ${describeState(state)}`)
  if (state.kind === "connected")
    appState.set(PERIPHERAL_ID_KEY, state.peripheralId)
})
connection.on("status", (status) => {
  if (verbose) {
    console.log(
      `${now()}  · belt=${status.beltState} speed=${status.speedKmh.toFixed(1)} time=${status.elapsedSeconds}s dist=${status.distanceMeters}m steps=${status.steps}`
    )
  }
  logEvents(recorder.handleStatus(status))
})
connection.start()

const tickTimer = setInterval(
  () => logEvents(recorder.tick()),
  TICK_INTERVAL_MS
)
const liveTimer = setInterval(() => {
  const session = recorder.currentSession
  if (session) console.log(`${now()}  … ${describeSession(session)}`)
}, LIVE_LOG_INTERVAL_MS)

process.on("SIGINT", async () => {
  clearInterval(tickTimer)
  clearInterval(liveTimer)
  await connection.release()
  database.close()
  process.exit(0)
})
