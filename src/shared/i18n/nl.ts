import type {Dictionary} from "./en"

const nl: Dictionary = {
  app: {
    name: "WalkingBar",
    quit: "WalkingBar afsluiten",
    open: "WalkingBar openen",
  },
  nav: {
    history: "Geschiedenis",
    stats: "Statistieken",
    settings: "Instellingen",
    back: "Terug",
  },
  connection: {
    connected: (params) => `Verbonden met ${params.name}`,
    connecting: (params) => `Verbinden met ${params.name}…`,
    scanning: "Je WalkingPad zoeken…",
    stopped: "Niet verbonden",
    bluetoothUnavailable: "Bluetooth staat uit of is niet toegestaan",
    bluetoothUnavailableHint:
      "Zet Bluetooth aan en sta WalkingBar toe in Systeeminstellingen › Privacy en beveiliging › Bluetooth.",
    retrying: (params) => `Nieuwe poging over ${params.seconds} s`,
    failure: {
      padNotFound: "WalkingPad niet gevonden",
      connectFailed: "Kan geen verbinding maken met de WalkingPad",
      unsupportedProtocol: "Deze loopband wordt nog niet ondersteund",
      disconnected: "Verbinding verbroken",
    },
    failureHint: {
      padNotFound:
        "Controleer of de loopband aanstaat en de KS Fit-app niet verbonden is: de loopband accepteert maar één verbinding tegelijk.",
      connectFailed:
        "Sluit de KS Fit-app op je telefoon als die verbonden is: de loopband accepteert maar één verbinding tegelijk.",
      unsupportedProtocol:
        "Hij biedt het KingSmith-protocol niet aan. Open een issue met de modelnaam.",
      disconnected: "Automatisch opnieuw verbinden.",
    },
  },
  belt: {
    idle: "Gestopt",
    standby: "Stand-by",
    starting: "Starten…",
    unknown: "Onbekende status",
  },
  controls: {
    wakeUpFailed: "De loopband werd niet wakker. Probeer het opnieuw.",
    padStoppedNoSteps: "Gestopt door de loopband: geen stappen gedetecteerd.",
    padStoppedByPad: "Gestopt door de loopband of de afstandsbediening.",
    start: "Starten",
    pause: "Pauze",
    resume: "Hervatten",
    endSession: "Beëindigen",
    slower: "Langzamer",
    faster: "Sneller",
    manual: "Handmatig",
    automatic: "Automatisch",
    speedRange: (params) => `${params.min} tot ${params.max} km/u`,
    commandFailed: "De opdracht kon niet naar de loopband worden gestuurd.",
    plateau: (params) => `Niveau ${params.speed} · ${params.time}`,
    plateauReady: (params) =>
      `Niveau ${params.speed} · ${params.time} · zichtbaar op Strava`,
  },
  goal: {
    title: "Doel",
    distance: "Afstand",
    duration: "Tijd",
    set: "Instellen",
    hintSession:
      "De loopband stopt vanzelf zodra deze sessie het doel bereikt.",
    hintDay: "De loopband stopt vanzelf zodra het dagtotaal het doel bereikt.",
    remaining: (params) => `Nog ${params.value}`,
    reached: "Doel bereikt",
    dismiss: "OK",
    invalid: "Voer een positief getal in.",
    alreadyWalked: "Kies meer dan je al hebt gelopen.",
  },
  stats: {
    duration: "Duur",
    distance: "Afstand",
    steps: "Stappen",
    averageSpeed: "Gem. snelheid",
    maxSpeed: "Max. snelheid",
    sessions: "Sessies",
    calories: "Calorieën",
    activeDays: "Dagen",
    bestDay: (params) => `Beste dag: ${params.distance}`,
    lastMonths: "Laatste 6 maanden",
    period: {
      week: "7 dagen",
      month: "30 dagen",
      year: "12 mnd.",
      all: "Alles",
    },
  },
  session: {
    endsIn: (params) => `Eindigt over ${params.time} tenzij je hervat`,
    title: "Huidige sessie",
    paused: "Gepauzeerd",
  },
  today: {
    title: "Vandaag",
    empty: "Vandaag nog niet gewandeld.",
  },
  history: {
    title: "Geschiedenis",
    empty: "Nog geen sessies opgenomen.",
    today: "Vandaag",
    date: "Datum",
    timeOfDay: "Tijd",
    yesterday: "Gisteren",
    inProgress: "bezig",
    edited: "bewerkt",
    delete: "Verwijderen",
    confirmDelete: "Uit de app verwijderen (niet uit Strava)?",
    export: "Exporteren als CSV",
    cancel: "Annuleren",
  },
  strava: {
    title: "Strava",
    defaultTitle: "Wandelen op de loopband",
    connect: "Strava verbinden",
    connecting: "Wachten op de autorisatie in je browser…",
    disconnect: "Loskoppelen",
    connectedAs: (params) => `Verbonden: ${params.name}`,
    connectHint: "Om te publiceren.",
    status: {
      published: "Gepubliceerd op Strava",
      failed: "Publiceren mislukt",
      dismissed: "Niet gepubliceerd, gemarkeerd als al op Strava",
      notPublished: "Nog niet gepubliceerd",
    },
    publish: "Publiceren",
    allowAgain: "Publiceren weer toestaan",
    preview: {
      title: (params) => `${params.day} publiceren`,
      sessionTitle: (params) => `Sessie van ${params.time} publiceren`,
      name: "Titel",
      descriptionPlaceholder:
        "Voeg een notitie toe (optioneel). Strava toont al de afstand, tijd, stappen en elke sessie.",
      description: "Beschrijving",
      publishing: "Publiceren…",
      dismiss: "Staat al op Strava, niet publiceren",
      walksAlreadyOnStrava: (params) =>
        `Strava heeft die dag al een wandeling: ${params.walks}. Publiceren voegt nog een activiteit toe.`,
      activeSessionWarning:
        "Er loopt een sessie. Sessies die na het publiceren worden opgenomen, komen niet op Strava.",
      sessionInProgressWarning:
        "Deze sessie loopt nog. Wat je na het publiceren loopt, komt niet op Strava.",
      noSessions: "Geen sessie om te publiceren op deze dag.",
    },
    settings: {
      application: "Strava-applicatie",
      applicationHint: "Callback-domein: localhost",
      clientId: "Client ID",
      clientSecret: "Client secret",
      saveCredentials: "Opslaan",
      autoPublish: "Automatisch publiceren",
      autoPublishSessionHint: "Elke sessie gaat weg zodra die eindigt.",
      grouping: "Eén activiteit per",
      groupingDay: "Dag",
      groupingSession: "Sessie",
      publishTime: "Elke dag publiceren om",
      titleTemplate: "Activiteitstitel",
      titleTemplateHint:
        "Variabelen: {distance} {duration} {sessions} {steps} {date}",
      hideFromHome: "Verbergen in de feed",
      hideFromHomeHint: "De zichtbaarheid volgt je Strava-instellingen.",
    },
    errors: {
      notConfigured: "Voeg je Strava-applicatie toe in de instellingen.",
      invalidCredentials: "Strava heeft deze Client ID of secret geweigerd.",
      notConnected: "Verbind eerst Strava.",
      encryptionUnavailable:
        "De macOS-sleutelhanger is niet beschikbaar om de Strava-tokens op te slaan.",
      authorizationDenied: "De Strava-autorisatie is geweigerd.",
      missingScope:
        "Strava heeft geen toestemming gegeven om activiteiten te uploaden. Verbind opnieuw en laat die toestemming aangevinkt.",
      authorizationTimeout:
        "De Strava-autorisatie duurde te lang. Probeer het opnieuw.",
      rateLimited:
        "Strava-limiet bereikt. Probeer het over 15 minuten opnieuw.",
      network: "Strava is niet bereikbaar. Controleer je verbinding.",
      api: "Strava gaf een fout terug.",
    },
    oauthPage: {
      success:
        "WalkingBar is verbonden met Strava. Je kunt dit tabblad sluiten.",
      failure:
        "De verbinding met Strava is mislukt. Je kunt dit tabblad sluiten en het opnieuw proberen vanuit WalkingBar.",
    },
  },
  settings: {
    title: "Instellingen",
    language: "Taal",
    systemLanguage: "Systeem",
    languageNames: {
      en: "English",
      fr: "Français",
      es: "Español",
      it: "Italiano",
      de: "Deutsch",
      nl: "Nederlands",
    },
    pauseTimeout: "Sessie eindigt na",
    pauseTimeoutHint: "Pauze die de sessie beëindigt.",
    minutes: "min",
    accentColor: "Accentkleur",
    weight: "Gewicht",
    weightHint: "Wordt gebruikt om de verbrande calorieën te schatten.",
    customColor: "Eigen kleur",
    launchAtLogin: "Openen bij inloggen",
    launchAtLoginDevHint: "Werkt alleen in de verpakte app.",
    pad: "WalkingPad",
    speedShortcuts: "Snelheidssnelkoppelingen",
    plateauIndicator: "Niveau-indicator",
    plateauIndicatorHint: "Toont of een snelheid lang genoeg duurde.",
    speedShortcutsHint: (params) =>
      `Maximaal ${params.max}, onder de snelheid.`,
    showDiagnosticsLog: "Diagnoselogboek tonen",
    forgetPad: "Deze loopband vergeten",
    version: (params) => `Versie ${params.version}`,
  },
}

export default nl
