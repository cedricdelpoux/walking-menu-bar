import {writeFileSync} from "node:fs"
import {join} from "node:path"
import {
  app,
  dialog,
  globalShortcut,
  powerMonitor,
  safeStorage,
  shell,
} from "electron"
import {dayKeyOf} from "../shared/day"
import {formatDuration, formatKilometers} from "../shared/format"
import {buildHistoryCsv} from "../shared/history-csv"
import {createTranslator, resolveLocale, type Locale} from "../shared/i18n"
import {IpcChannel, type LiveState} from "../shared/ipc"
import {
  SHORTCUT_ACTIONS,
  type Settings,
  type SettingsSnapshot,
  type ShortcutAction,
} from "../shared/settings"
import type {StravaCredentials} from "../shared/strava"
import {DiagnosticLog} from "./diagnostics/diagnostic-log"
import {broadcast, registerIpcHandlers} from "./ipc"
import {MenuBar} from "./menubar"
import {PadConnection} from "./pad/pad-connection"
import {PadService, PERIPHERAL_ID_KEY} from "./pad/pad-service"
import {SessionRecorder} from "./session/session-recorder"
import {SettingsStore} from "./settings-store"
import {AppStateRepository} from "./storage/app-state-repository"
import {openDatabase} from "./storage/database"
import {PublicationRepository} from "./storage/publication-repository"
import {SessionRepository} from "./storage/session-repository"
import {ActivityPublisher} from "./strava/activity-publisher"
import {PublicationScheduler} from "./strava/publication-scheduler"
import {StravaAccount, type SecretBox} from "./strava/strava-account"
import {StravaCredentialStore} from "./strava/strava-credentials"
import {StravaHttp} from "./strava/strava-http"

const CAPTURE_DELAY_MS = 4000
const SHUTDOWN_TIMEOUT_MS = 3000

function trayTitle(state: LiveState, locale: Locale): string {
  const session = state.currentSession
  if (!session) return ""
  return `${formatKilometers(session.distanceMeters, locale, 1)} · ${formatDuration(session.durationSeconds)}`
}

const keychainSecretBox: SecretBox = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plainText) =>
    safeStorage.encryptString(plainText).toString("base64"),
  decrypt: (cipherText) =>
    safeStorage.decryptString(Buffer.from(cipherText, "base64")),
}

function getBuiltInCredentials(): StravaCredentials | null {
  const clientId = import.meta.env.MAIN_VITE_STRAVA_CLIENT_ID
  const clientSecret = import.meta.env.MAIN_VITE_STRAVA_CLIENT_SECRET
  return clientId && clientSecret ? {clientId, clientSecret} : null
}

function registerShortcut(accelerator: string, action: () => void): boolean {
  try {
    return globalShortcut.register(accelerator, action)
  } catch {
    return false
  }
}

function bootstrap(): void {
  app.dock?.hide()

  const database = openDatabase(join(app.getPath("userData"), "walkingbar.db"))
  const appState = new AppStateRepository(database)
  const sessions = new SessionRepository(database)
  const settingsStore = new SettingsStore(appState)

  const currentLocale = () =>
    resolveLocale(
      settingsStore.get().language,
      app.getPreferredSystemLanguages()
    )
  let unavailableShortcuts: ShortcutAction[] = []
  const settingsSnapshot = (): SettingsSnapshot => ({
    settings: settingsStore.get(),
    locale: currentLocale(),
    unavailableShortcuts,
  })

  const recorder = new SessionRecorder(sessions, appState, {
    pauseTimeoutMs: settingsStore.get().pauseTimeoutMinutes * 60_000,
  })
  const connection = new PadConnection({
    preferredPeripheralId: appState.get<string>(PERIPHERAL_ID_KEY),
  })
  const diagnostics = new DiagnosticLog(
    join(app.getPath("logs"), "diagnostics.log")
  )
  diagnostics.write(`app started, version ${app.getVersion()}`)
  const padService = new PadService(
    connection,
    recorder,
    sessions,
    appState,
    diagnostics
  )

  const stravaCredentials = new StravaCredentialStore(
    appState,
    keychainSecretBox,
    getBuiltInCredentials()
  )
  const stravaHttp = new StravaHttp(() => stravaCredentials.get())
  const stravaAccount = new StravaAccount({
    http: stravaHttp,
    credentials: stravaCredentials,
    appState,
    secretBox: keychainSecretBox,
    openBrowser: (url) => void shell.openExternal(url),
    callbackPages: () => {
      const t = createTranslator(currentLocale())
      return {
        success: t("strava.oauthPage.success"),
        failure: t("strava.oauthPage.failure"),
      }
    },
  })
  const publisher = new ActivityPublisher({
    sessions,
    publications: new PublicationRepository(database),
    http: stravaHttp,
    getAccessToken: () => stravaAccount.getAccessToken(),
    settings: () => settingsStore.get().strava,
    locale: currentLocale,
  })
  const scheduler = new PublicationScheduler({
    publisher,
    sessions,
    settings: () => settingsStore.get().strava,
    stravaState: () => stravaAccount.getState(),
  })

  let isQuitting = false
  const quit = () => {
    if (isQuitting) return
    isQuitting = true
    diagnostics.write("app quitting")
    scheduler.stop()
    const shutdownTimeout = new Promise((resolve) =>
      setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)
    )
    void Promise.race([padService.shutdown(), shutdownTimeout]).finally(() => {
      database.close()
      app.exit(0)
    })
  }
  // Cmd+Q, logout and shutdown all go through before-quit; SIGTERM does not on its own.
  app.on("before-quit", (event) => {
    event.preventDefault()
    quit()
  })
  process.on("SIGTERM", quit)

  const menuLabels = () => {
    const t = createTranslator(currentLocale())
    return {
      tooltip: t("app.name"),
      contextMenuLabels: {open: t("app.open"), quit: t("app.quit")},
    }
  }
  const menuBar = new MenuBar({...menuLabels(), onQuit: quit})
  const {webContents} = menuBar.window

  const applyLoginItem = (settings: Settings) => {
    if (app.isPackaged)
      app.setLoginItemSettings({openAtLogin: settings.launchAtLogin})
  }
  applyLoginItem(settingsStore.get())

  const shortcutActions: Record<ShortcutAction, () => Promise<void>> = {
    toggleBelt: () => padService.toggleBelt(),
    faster: () => padService.changeSpeed(1),
    slower: () => padService.changeSpeed(-1),
  }
  const applyShortcuts = ({shortcuts}: Settings) => {
    globalShortcut.unregisterAll()
    unavailableShortcuts = SHORTCUT_ACTIONS.filter(
      (action) =>
        shortcuts[action] !== "" &&
        !registerShortcut(
          shortcuts[action],
          () => void shortcutActions[action]()
        )
    )
  }
  applyShortcuts(settingsStore.get())

  settingsStore.on("change", (settings) => {
    padService.setPauseTimeout(settings.pauseTimeoutMinutes)
    applyLoginItem(settings)
    applyShortcuts(settings)
    menuBar.updateLabels(menuLabels())
    menuBar.setTitle(trayTitle(padService.getLiveState(), currentLocale()))
    broadcast(webContents, IpcChannel.settingsChanged, settingsSnapshot())
    void scheduler.check()
  })

  padService.on("liveState", (state) => {
    menuBar.setTitle(trayTitle(state, currentLocale()))
    broadcast(webContents, IpcChannel.liveStateChanged, state)
  })
  padService.on("historyChanged", () =>
    broadcast(webContents, IpcChannel.historyChanged)
  )
  padService.on("sessionEnded", () => void scheduler.check())
  stravaAccount.on("change", (state) => {
    broadcast(webContents, IpcChannel.stravaChanged, state)
    void scheduler.check()
  })
  publisher.on("change", (key) =>
    broadcast(webContents, IpcChannel.publicationChanged, key)
  )

  registerIpcHandlers({
    appInfo: {version: app.getVersion(), isPackaged: app.isPackaged},
    padService,
    sessions,
    getSettings: settingsSnapshot,
    updateSettings: (patch) => {
      settingsStore.update(patch)
      return settingsSnapshot()
    },
    stravaAccount,
    publisher,
    exportHistory: async () => {
      const {canceled, filePath} = await dialog.showSaveDialog({
        defaultPath: join(
          app.getPath("downloads"),
          `walkingbar-${dayKeyOf(Date.now())}.csv`
        ),
        filters: [{name: "CSV", extensions: ["csv"]}],
      })
      if (canceled || !filePath) return
      const allSessions = sessions.listSessionsStartedBetween(
        0,
        Number.MAX_SAFE_INTEGER
      )
      writeFileSync(
        filePath,
        buildHistoryCsv(allSessions, settingsStore.get().weightKg)
      )
      shell.showItemInFolder(filePath)
    },
    revealDiagnosticsLog: () => shell.showItemInFolder(diagnostics.filePath),
    quit,
    fitWindowHeight: (contentHeight) => menuBar.fitHeight(contentHeight),
  })

  powerMonitor.on("suspend", () => void padService.suspend())
  powerMonitor.on("resume", () => {
    padService.resume()
    void scheduler.check()
  })

  padService.start()
  scheduler.start()

  // Development helpers: open the popover on start, and optionally save a screenshot of it.
  const capturePath = process.env.WALKING_BAR_CAPTURE
  if (process.env.WALKING_BAR_SHOW_ON_START || capturePath) {
    webContents.once("did-finish-load", () => {
      menuBar.show()
      if (capturePath) {
        setTimeout(
          async () =>
            writeFileSync(
              capturePath,
              (await webContents.capturePage()).toPNG()
            ),
          CAPTURE_DELAY_MS
        )
      }
    })
  }
}

// Development runs keep their own data and logs, apart from those of the installed app.
if (!app.isPackaged) {
  app.setPath("userData", join(app.getPath("appData"), "WalkingBar Dev"))
  app.setAppLogsPath(
    join(app.getPath("home"), "Library", "Logs", "WalkingBar Dev")
  )
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("window-all-closed", () => {
    // A menu bar app keeps running without windows.
  })
  void app.whenReady().then(bootstrap)
}
