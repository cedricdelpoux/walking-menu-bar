import type {Dictionary} from "./en"

const de: Dictionary = {
  app: {
    name: "WalkingBar",
    quit: "WalkingBar beenden",
    open: "WalkingBar öffnen",
  },
  nav: {
    history: "Verlauf",
    stats: "Statistik",
    settings: "Einstellungen",
    back: "Zurück",
  },
  connection: {
    connected: (params) => `Verbunden mit ${params.name}`,
    connecting: (params) => `Verbinden mit ${params.name}…`,
    scanning: "Suche nach deinem WalkingPad…",
    stopped: "Getrennt",
    bluetoothUnavailable: "Bluetooth aus oder nicht erlaubt",
    bluetoothUnavailableHint:
      "Schalte Bluetooth ein und erlaube WalkingBar unter Systemeinstellungen › Datenschutz & Sicherheit › Bluetooth.",
    retrying: (params) => `Neuer Versuch in ${params.seconds} s`,
    failure: {
      padNotFound: "WalkingPad nicht gefunden",
      connectFailed: "Verbindung zum WalkingPad fehlgeschlagen",
      unsupportedProtocol: "Dieses Laufband wird noch nicht unterstützt",
      disconnected: "Verbindung verloren",
    },
    failureHint: {
      padNotFound:
        "Prüfe, ob das Laufband eingeschaltet ist und die App KS Fit nicht verbunden ist: Das Laufband erlaubt nur eine Verbindung gleichzeitig.",
      connectFailed:
        "Schließe die App KS Fit auf deinem Telefon, falls sie verbunden ist: Das Laufband erlaubt nur eine Verbindung gleichzeitig.",
      unsupportedProtocol:
        "Es bietet das KingSmith-Protokoll nicht an. Öffne bitte ein Issue mit dem Modellnamen.",
      disconnected: "Automatische Wiederverbindung.",
    },
  },
  belt: {
    idle: "Gestoppt",
    standby: "Standby",
    starting: "Startet…",
    unknown: "Unbekannter Zustand",
  },
  controls: {
    wakeUpFailed: "Das Laufband ist nicht aufgewacht. Versuche es erneut.",
    padStoppedNoSteps: "Vom Laufband gestoppt: keine Schritte erkannt.",
    padStoppedByPad: "Vom Laufband oder der Fernbedienung gestoppt.",
    start: "Starten",
    pause: "Pause",
    resume: "Fortsetzen",
    endSession: "Beenden",
    slower: "Langsamer",
    faster: "Schneller",
    manual: "Manuell",
    automatic: "Automatisch",
    speedRange: (params) => `${params.min} bis ${params.max} km/h`,
    commandFailed: "Der Befehl konnte nicht an das Laufband gesendet werden.",
    plateau: (params) => `Stufe ${params.speed} · ${params.time}`,
    plateauReady: (params) =>
      `Stufe ${params.speed} · ${params.time} · sichtbar auf Strava`,
  },
  goal: {
    title: "Ziel",
    distance: "Distanz",
    duration: "Zeit",
    set: "Festlegen",
    hintSession:
      "Das Laufband stoppt von selbst, sobald diese Einheit das Ziel erreicht.",
    hintDay:
      "Das Laufband stoppt von selbst, sobald die Tagessumme das Ziel erreicht.",
    remaining: (params) => `Noch ${params.value}`,
    reached: "Ziel erreicht",
    dismiss: "OK",
    invalid: "Gib eine positive Zahl ein.",
    alreadyWalked: "Wähle mehr, als du schon gegangen bist.",
  },
  stats: {
    duration: "Dauer",
    distance: "Distanz",
    steps: "Schritte",
    averageSpeed: "Ø Tempo",
    maxSpeed: "Max. Tempo",
    sessions: "Einheiten",
    calories: "Kalorien",
    activeDays: "Tage",
    bestDay: (params) => `Bester Tag: ${params.distance}`,
    period: {
      week: "7 Tage",
      month: "30 Tage",
      year: "12 Monate",
      all: "Alle",
    },
  },
  session: {
    endsIn: (params) => `Endet in ${params.time}, wenn du nicht fortsetzt`,
    title: "Aktuelle Einheit",
    paused: "Pausiert",
  },
  today: {
    title: "Heute",
    empty: "Heute noch keine Einheit.",
  },
  history: {
    title: "Verlauf",
    empty: "Noch keine Einheiten aufgezeichnet.",
    today: "Heute",
    date: "Datum",
    timeOfDay: "Uhrzeit",
    yesterday: "Gestern",
    inProgress: "läuft",
    edited: "bearbeitet",
    delete: "Löschen",
    confirmDelete: "Aus der App löschen (nicht aus Strava)?",
    cancel: "Abbrechen",
  },
  strava: {
    title: "Strava",
    defaultTitle: "Gehen auf dem Laufband",
    connect: "Strava verbinden",
    connecting: "Warte auf die Autorisierung im Browser…",
    disconnect: "Trennen",
    connectedAs: (params) => `Verbunden: ${params.name}`,
    connectHint: "Zum Veröffentlichen.",
    status: {
      published: "Auf Strava veröffentlicht",
      failed: "Veröffentlichung fehlgeschlagen",
      dismissed: "Nicht veröffentlicht, als bereits auf Strava markiert",
      notPublished: "Noch nicht veröffentlicht",
    },
    publish: "Veröffentlichen",
    allowAgain: "Veröffentlichen wieder erlauben",
    preview: {
      title: (params) => `${params.day} veröffentlichen`,
      sessionTitle: (params) => `Einheit von ${params.time} veröffentlichen`,
      name: "Titel",
      descriptionPlaceholder:
        "Füge eine Notiz hinzu (optional). Strava zeigt bereits Distanz, Zeit, Schritte und jede Einheit.",
      description: "Beschreibung",
      publishing: "Wird veröffentlicht…",
      dismiss: "Ist schon auf Strava, nicht veröffentlichen",
      walksAlreadyOnStrava: (params) =>
        `Strava hat an diesem Tag bereits eine Einheit: ${params.walks}. Beim Veröffentlichen kommt eine weitere Aktivität hinzu.`,
      activeSessionWarning:
        "Eine Einheit läuft. Einheiten, die nach dem Veröffentlichen aufgezeichnet werden, kommen nicht zu Strava.",
      sessionInProgressWarning:
        "Diese Einheit läuft. Was du nach dem Veröffentlichen gehst, kommt nicht zu Strava.",
      noSessions: "An diesem Tag gibt es keine Einheit zu veröffentlichen.",
    },
    settings: {
      application: "Strava-Anwendung",
      applicationHint: "Callback-Domain: localhost",
      clientId: "Client ID",
      clientSecret: "Client Secret",
      saveCredentials: "Sichern",
      autoPublish: "Automatisch veröffentlichen",
      autoPublishSessionHint: "Jede Einheit geht direkt nach dem Ende raus.",
      grouping: "Eine Aktivität pro",
      groupingDay: "Tag",
      groupingSession: "Einheit",
      publishTime: "Täglich veröffentlichen um",
      titleTemplate: "Aktivitätstitel",
      titleTemplateHint:
        "Platzhalter: {distance} {duration} {sessions} {steps} {date}",
      hideFromHome: "Im Home-Feed ausblenden",
      hideFromHomeHint: "Die Sichtbarkeit folgt deinen Strava-Einstellungen.",
    },
    errors: {
      notConfigured: "Füge deine Strava-Anwendung in den Einstellungen hinzu.",
      invalidCredentials:
        "Strava hat diese Client ID oder dieses Secret abgelehnt.",
      notConnected: "Verbinde zuerst Strava.",
      encryptionUnavailable:
        "Der macOS-Schlüsselbund ist nicht verfügbar, um die Strava-Tokens zu speichern.",
      authorizationDenied: "Die Strava-Autorisierung wurde abgelehnt.",
      missingScope:
        "Strava hat die Berechtigung zum Hochladen von Aktivitäten nicht erteilt. Verbinde dich erneut und lasse diese Berechtigung aktiviert.",
      authorizationTimeout:
        "Die Strava-Autorisierung hat zu lange gedauert. Versuche es erneut.",
      rateLimited:
        "Strava-Anfragelimit erreicht. Versuche es in 15 Minuten erneut.",
      network: "Strava ist nicht erreichbar. Prüfe deine Verbindung.",
      api: "Strava hat einen Fehler gemeldet.",
    },
    oauthPage: {
      success:
        "WalkingBar ist mit Strava verbunden. Du kannst diesen Tab schließen.",
      failure:
        "Die Verbindung mit Strava ist fehlgeschlagen. Du kannst diesen Tab schließen und es in WalkingBar erneut versuchen.",
    },
  },
  settings: {
    title: "Einstellungen",
    language: "Sprache",
    systemLanguage: "System",
    languageNames: {
      en: "English",
      fr: "Français",
      es: "Español",
      it: "Italiano",
      de: "Deutsch",
      nl: "Nederlands",
    },
    pauseTimeout: "Einheit endet nach",
    pauseTimeoutHint: "Pause, die die Einheit beendet.",
    minutes: "Min.",
    accentColor: "Akzentfarbe",
    weight: "Gewicht",
    weightHint: "Dient zur Schätzung der verbrauchten Kalorien.",
    customColor: "Eigene Farbe",
    launchAtLogin: "Beim Anmelden öffnen",
    launchAtLoginDevHint: "Wirkt nur in der gepackten App.",
    pad: "WalkingPad",
    speedShortcuts: "Tempo-Kurzbefehle",
    plateauIndicator: "Stufenanzeige",
    plateauIndicatorHint: "Zeigt, ob ein Tempo lange genug für Strava lief.",
    speedShortcutsHint: (params) =>
      `Bis zu ${params.max}, unter dem Tempo angezeigt.`,
    showDiagnosticsLog: "Diagnoseprotokoll anzeigen",
    forgetPad: "Laufband vergessen",
    version: (params) => `Version ${params.version}`,
  },
}

export default de
