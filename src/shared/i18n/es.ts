import type {Dictionary} from "./en"

const es: Dictionary = {
  app: {
    name: "WalkingBar",
    quit: "Salir de WalkingBar",
    open: "Abrir WalkingBar",
  },
  nav: {
    history: "Historial",
    stats: "Estadísticas",
    settings: "Ajustes",
    back: "Atrás",
  },
  connection: {
    connected: (params) => `Conectado a ${params.name}`,
    connecting: (params) => `Conectando a ${params.name}…`,
    scanning: "Buscando tu WalkingPad…",
    stopped: "Desconectado",
    bluetoothUnavailable: "Bluetooth desactivado o sin permiso",
    bluetoothUnavailableHint:
      "Activa el Bluetooth y permite WalkingBar en Ajustes del Sistema › Privacidad y seguridad › Bluetooth.",
    retrying: (params) => `Reintentando en ${params.seconds} s`,
    failure: {
      padNotFound: "WalkingPad no encontrado",
      connectFailed: "No se pudo conectar con el WalkingPad",
      unsupportedProtocol: "Esta cinta aún no es compatible",
      disconnected: "Conexión perdida",
    },
    failureHint: {
      padNotFound:
        "Comprueba que la cinta está encendida y que la app KS Fit no está conectada: la cinta solo acepta una conexión a la vez.",
      connectFailed:
        "Cierra la app KS Fit en tu teléfono si está conectada: la cinta solo acepta una conexión a la vez.",
      unsupportedProtocol:
        "No expone el protocolo KingSmith. Abre una issue indicando su modelo.",
      disconnected: "Reconectando automáticamente.",
    },
  },
  belt: {
    idle: "Parada",
    standby: "En espera",
    starting: "Arrancando…",
    unknown: "Estado desconocido",
  },
  controls: {
    wakeUpFailed: "La cinta no se ha activado. Inténtalo de nuevo.",
    padStoppedNoSteps: "Parada por la cinta: no se detectan pasos.",
    padStoppedByPad: "Parada por la cinta o su mando.",
    start: "Iniciar",
    pause: "Pausa",
    resume: "Reanudar",
    endSession: "Terminar",
    slower: "Más lento",
    faster: "Más rápido",
    manual: "Manual",
    automatic: "Automático",
    speedRange: (params) => `De ${params.min} a ${params.max} km/h`,
    commandFailed: "No se pudo enviar el comando a la cinta.",
    plateau: (params) => `Nivel ${params.speed} · ${params.time}`,
    plateauReady: (params) =>
      `Nivel ${params.speed} · ${params.time} · visible en Strava`,
  },
  goal: {
    title: "Objetivo",
    distance: "Distancia",
    duration: "Tiempo",
    set: "Fijar",
    hintSession:
      "La cinta se detiene sola cuando esta sesión alcanza el objetivo.",
    hintDay:
      "La cinta se detiene sola cuando el total del día alcanza el objetivo.",
    remaining: (params) => `Faltan ${params.value}`,
    reached: "Objetivo alcanzado",
    dismiss: "OK",
    invalid: "Introduce un número positivo.",
    alreadyWalked: "Elige más de lo que ya has caminado.",
  },
  stats: {
    duration: "Duración",
    distance: "Distancia",
    steps: "Pasos",
    averageSpeed: "Vel. media",
    maxSpeed: "Vel. máxima",
    sessions: "Sesiones",
    calories: "Calorías",
    activeDays: "Días",
    bestDay: (params) => `Mejor día: ${params.distance}`,
    period: {
      week: "7 días",
      month: "30 días",
      year: "12 meses",
      all: "Todo",
    },
  },
  session: {
    endsIn: (params) => `Termina en ${params.time} si no reanudas`,
    title: "Sesión en curso",
    paused: "En pausa",
  },
  today: {
    title: "Hoy",
    empty: "Aún no has caminado hoy.",
  },
  history: {
    title: "Historial",
    empty: "Aún no hay sesiones registradas.",
    today: "Hoy",
    date: "Fecha",
    timeOfDay: "Hora",
    yesterday: "Ayer",
    inProgress: "en curso",
    edited: "editada",
    delete: "Eliminar",
    confirmDelete: "¿Eliminar de la app (no de Strava)?",
    cancel: "Cancelar",
  },
  strava: {
    title: "Strava",
    defaultTitle: "Caminata en cinta",
    connect: "Conectar Strava",
    connecting: "Esperando la autorización en tu navegador…",
    disconnect: "Desconectar",
    connectedAs: (params) => `Conectado: ${params.name}`,
    connectHint: "Para publicar tus caminatas.",
    status: {
      published: "Publicada en Strava",
      failed: "Error al publicar",
      dismissed: "No publicada, marcada como ya en Strava",
      notPublished: "Aún sin publicar",
    },
    publish: "Publicar",
    allowAgain: "Permitir publicar de nuevo",
    preview: {
      title: (params) => `Publicar ${params.day}`,
      sessionTitle: (params) => `Publicar la sesión de las ${params.time}`,
      name: "Título",
      descriptionPlaceholder:
        "Añade una nota (opcional). Strava ya muestra la distancia, el tiempo, los pasos y cada sesión.",
      description: "Descripción",
      publishing: "Publicando…",
      dismiss: "Ya está en Strava, no publicar",
      walksAlreadyOnStrava: (params) =>
        `Strava ya tiene una caminata ese día: ${params.walks}. Publicar añadirá otra actividad.`,
      activeSessionWarning:
        "Hay una sesión en curso. Las sesiones registradas después de publicar no se añadirán a Strava.",
      sessionInProgressWarning:
        "Esta sesión está en curso. Lo que camines después de publicar no se añadirá a Strava.",
      noSessions: "No hay ninguna sesión que publicar ese día.",
    },
    settings: {
      application: "Aplicación de Strava",
      applicationHint: "Dominio de retorno: localhost",
      clientId: "Client ID",
      clientSecret: "Client secret",
      saveCredentials: "Guardar",
      autoPublish: "Publicar automáticamente",
      autoPublishSessionHint: "Cada sesión se publica al terminar.",
      grouping: "Una actividad por",
      groupingDay: "Día",
      groupingSession: "Sesión",
      publishTime: "Publicar cada día a las",
      titleTemplate: "Título de la actividad",
      titleTemplateHint:
        "Variables: {distance} {duration} {sessions} {steps} {date}",
      hideFromHome: "Ocultar del feed de inicio",
      hideFromHomeHint: "La visibilidad sigue tus ajustes de Strava.",
    },
    errors: {
      notConfigured: "Añade tu aplicación de Strava en los ajustes.",
      invalidCredentials: "Strava ha rechazado este Client ID o secret.",
      notConnected: "Conecta Strava primero.",
      encryptionUnavailable:
        "El llavero de macOS no está disponible para guardar los tokens de Strava.",
      authorizationDenied: "Se ha rechazado la autorización de Strava.",
      missingScope:
        "Strava no ha concedido el permiso para subir actividades. Conéctate de nuevo y deja ese permiso marcado.",
      authorizationTimeout:
        "La autorización de Strava ha tardado demasiado. Inténtalo de nuevo.",
      rateLimited:
        "Límite de peticiones de Strava alcanzado. Inténtalo de nuevo en 15 minutos.",
      network: "No se puede acceder a Strava. Comprueba tu conexión.",
      api: "Strava ha devuelto un error.",
    },
    oauthPage: {
      success:
        "WalkingBar está conectado a Strava. Puedes cerrar esta pestaña.",
      failure:
        "La conexión con Strava ha fallado. Puedes cerrar esta pestaña e intentarlo de nuevo desde WalkingBar.",
    },
  },
  settings: {
    title: "Ajustes",
    language: "Idioma",
    systemLanguage: "Sistema",
    languageNames: {
      en: "English",
      fr: "Français",
      es: "Español",
      it: "Italiano",
      de: "Deutsch",
      nl: "Nederlands",
    },
    pauseTimeout: "Fin de sesión tras",
    pauseTimeoutHint: "Pausa que termina la sesión.",
    minutes: "min",
    accentColor: "Color",
    weight: "Peso",
    weightHint: "Sirve para estimar las calorías quemadas.",
    customColor: "Color personalizado",
    launchAtLogin: "Abrir al iniciar sesión",
    launchAtLoginDevHint: "Solo funciona en la app empaquetada.",
    pad: "WalkingPad",
    speedShortcuts: "Atajos de velocidad",
    plateauIndicator: "Indicador de nivel",
    plateauIndicatorHint:
      "Indica si una velocidad duró lo bastante para Strava.",
    speedShortcutsHint: (params) => `Hasta ${params.max}, bajo la velocidad.`,
    showDiagnosticsLog: "Ver el diagnóstico",
    forgetPad: "Olvidar esta cinta",
    version: (params) => `Versión ${params.version}`,
  },
}

export default es
