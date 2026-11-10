const failureMessages = {
  padNotFound: "WalkingPad not found",
  connectFailed: "Could not connect to the WalkingPad",
  unsupportedProtocol: "This treadmill is not supported yet",
  disconnected: "Connection lost",
}

const en = {
  app: {
    name: "WalkingBar",
    quit: "Quit WalkingBar",
    open: "Open WalkingBar",
  },
  nav: {
    history: "History",
    stats: "Stats",
    settings: "Settings",
    back: "Back",
  },
  connection: {
    connected: (params: {name: string}) => `Connected to ${params.name}`,
    connecting: (params: {name: string}) => `Connecting to ${params.name}…`,
    scanning: "Looking for your WalkingPad…",
    stopped: "Disconnected",
    bluetoothUnavailable: "Bluetooth is off or not allowed",
    bluetoothUnavailableHint:
      "Turn Bluetooth on and allow WalkingBar in System Settings › Privacy & Security › Bluetooth.",
    retrying: (params: {seconds: number}) => `Retrying in ${params.seconds} s`,
    failure: failureMessages,
    failureHint: {
      padNotFound:
        "Make sure the pad is on and that the KS Fit app is not connected to it: the pad accepts only one connection at a time.",
      connectFailed:
        "Close the KS Fit app on your phone if it is connected: the pad accepts only one connection at a time.",
      unsupportedProtocol:
        "It does not expose the KingSmith protocol. Please open an issue with its model name.",
      disconnected: "Reconnecting automatically.",
    } satisfies Record<keyof typeof failureMessages, string>,
  },
  belt: {
    idle: "Stopped",
    standby: "Standby",
    starting: "Starting…",
    unknown: "Unknown state",
  },
  controls: {
    wakeUpFailed: "The pad did not wake up. Try again.",
    padStoppedNoSteps: "Stopped by the pad: no step sensed.",
    padStoppedByPad: "Stopped by the pad or its remote.",
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    endSession: "End",
    slower: "Slower",
    faster: "Faster",
    manual: "Manual",
    automatic: "Automatic",
    speedRange: (params: {min: string; max: string}) =>
      `${params.min} to ${params.max} km/h`,
    commandFailed: "The command could not be sent to the pad.",
    plateau: (params: {speed: string; time: string}) =>
      `Plateau ${params.speed} · ${params.time}`,
    plateauReady: (params: {speed: string; time: string}) =>
      `Plateau ${params.speed} · ${params.time} · visible on Strava`,
  },
  goal: {
    title: "Goal",
    distance: "Distance",
    duration: "Time",
    set: "Set",
    hintSession:
      "The belt stops on its own once this session reaches the goal.",
    hintDay:
      "The belt stops on its own once the total of the day reaches the goal.",
    remaining: (params: {value: string}) => `${params.value} to go`,
    reached: "Goal reached",
    dismiss: "OK",
    invalid: "Enter a positive number.",
    alreadyWalked: "Choose more than you already walked.",
  },
  stats: {
    duration: "Duration",
    distance: "Distance",
    steps: "Steps",
    averageSpeed: "Avg speed",
    maxSpeed: "Max speed",
    sessions: "Sessions",
    calories: "Calories",
    activeDays: "Days",
    bestDay: (params: {distance: string}) => `Best day: ${params.distance}`,
    lastMonths: "Last 6 months",
    period: {
      week: "7 days",
      month: "30 days",
      year: "12 months",
      all: "All",
    },
  },
  session: {
    endsIn: (params: {time: string}) =>
      `Ends in ${params.time} unless you resume`,
    title: "Current session",
    paused: "Paused",
  },
  today: {
    title: "Today",
    empty: "No walk yet today.",
  },
  history: {
    title: "History",
    empty: "No sessions recorded yet.",
    today: "Today",
    date: "Date",
    timeOfDay: "Time",
    yesterday: "Yesterday",
    inProgress: "in progress",
    edited: "edited",
    delete: "Delete",
    confirmDelete: "Delete from the app (not from Strava)?",
    export: "Export as CSV",
    cancel: "Cancel",
  },
  strava: {
    title: "Strava",
    defaultTitle: "Treadmill walk",
    connect: "Connect Strava",
    connecting: "Waiting for the authorization in your browser…",
    disconnect: "Disconnect",
    connectedAs: (params: {name: string}) => `Connected: ${params.name}`,
    connectHint: "To publish your walks.",
    status: {
      published: "Published on Strava",
      failed: "Publishing failed",
      dismissed: "Not published, marked as already on Strava",
      notPublished: "Not published yet",
    },
    publish: "Publish",
    allowAgain: "Allow publishing again",
    preview: {
      title: (params: {day: string}) => `Publish ${params.day}`,
      sessionTitle: (params: {time: string}) =>
        `Publish the ${params.time} session`,
      name: "Title",
      descriptionPlaceholder:
        "Add a note (optional). Strava already shows the distance, time, steps and each session.",
      description: "Description",
      publishing: "Publishing…",
      dismiss: "It is already on Strava, do not publish",
      walksAlreadyOnStrava: (params: {walks: string}) =>
        `Strava already has a walk this day: ${params.walks}. Publishing will add another activity.`,
      activeSessionWarning:
        "A session is in progress. Sessions recorded after publishing will not be added to Strava.",
      sessionInProgressWarning:
        "This session is in progress. What you walk after publishing will not be added to Strava.",
      noSessions: "No session to publish on this day.",
    },
    settings: {
      application: "Strava application",
      applicationHint: "Callback domain: localhost",
      clientId: "Client ID",
      clientSecret: "Client secret",
      saveCredentials: "Save",
      autoPublish: "Publish automatically",
      autoPublishSessionHint: "Each session leaves as soon as it ends.",
      grouping: "One activity per",
      groupingDay: "Day",
      groupingSession: "Session",
      publishTime: "Publish every day at",
      titleTemplate: "Activity title",
      titleTemplateHint:
        "Variables: {distance} {duration} {sessions} {steps} {date}",
      hideFromHome: "Hide from the home feed",
      hideFromHomeHint: "Visibility follows your Strava settings.",
    },
    errors: {
      notConfigured: "Add your Strava application in the settings.",
      invalidCredentials: "Strava refused this client ID or secret.",
      notConnected: "Connect Strava first.",
      encryptionUnavailable:
        "The macOS Keychain is not available to store the Strava tokens.",
      authorizationDenied: "The Strava authorization was declined.",
      missingScope:
        "Strava did not grant the permission to upload activities. Connect again and keep that permission checked.",
      authorizationTimeout:
        "The Strava authorization took too long. Try again.",
      rateLimited: "Strava rate limit reached. Try again in 15 minutes.",
      network: "Strava could not be reached. Check your connection.",
      api: "Strava returned an error.",
    },
    oauthPage: {
      success: "WalkingBar is connected to Strava. You can close this tab.",
      failure:
        "The Strava connection failed. You can close this tab and try again from WalkingBar.",
    },
  },
  settings: {
    title: "Settings",
    language: "Language",
    systemLanguage: "System",
    languageNames: {
      en: "English",
      fr: "Français",
      es: "Español",
      it: "Italiano",
      de: "Deutsch",
      nl: "Nederlands",
    },
    pauseTimeout: "End session after",
    pauseTimeoutHint: "Pause that ends the session.",
    minutes: "min",
    accentColor: "Accent color",
    weight: "Weight",
    weightHint: "Used to estimate the calories burned.",
    customColor: "Custom color",
    launchAtLogin: "Open at login",
    launchAtLoginDevHint: "Only takes effect in the packaged app.",
    pad: "WalkingPad",
    speedShortcuts: "Speed shortcuts",
    plateauIndicator: "Plateau indicator",
    plateauIndicatorHint: "Shows when a speed is held long enough for Strava.",
    speedShortcutsHint: (params: {max: number}) =>
      `Up to ${params.max}, shown under the speed.`,
    showDiagnosticsLog: "Show the diagnostics log",
    forgetPad: "Forget this pad",
    version: (params: {version: string}) => `Version ${params.version}`,
  },
}

export type Dictionary = typeof en

export default en
