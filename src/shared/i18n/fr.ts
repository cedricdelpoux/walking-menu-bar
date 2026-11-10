import type {Dictionary} from "./en"

const fr: Dictionary = {
  app: {
    name: "WalkingBar",
    quit: "Quitter WalkingBar",
    open: "Ouvrir WalkingBar",
  },
  nav: {
    history: "Historique",
    stats: "Stats",
    settings: "Réglages",
    back: "Retour",
  },
  connection: {
    connected: (params) => `Connecté à ${params.name}`,
    connecting: (params) => `Connexion à ${params.name}…`,
    scanning: "Recherche de ton WalkingPad…",
    stopped: "Déconnecté",
    bluetoothUnavailable: "Bluetooth désactivé ou non autorisé",
    bluetoothUnavailableHint:
      "Active le Bluetooth et autorise WalkingBar dans Réglages Système › Confidentialité et sécurité › Bluetooth.",
    retrying: (params) => `Nouvel essai dans ${params.seconds} s`,
    failure: {
      padNotFound: "WalkingPad introuvable",
      connectFailed: "Connexion au WalkingPad impossible",
      unsupportedProtocol: "Ce tapis n'est pas encore pris en charge",
      disconnected: "Connexion perdue",
    },
    failureHint: {
      padNotFound:
        "Vérifie que le tapis est allumé et que l'app KS Fit n'y est pas connectée : le tapis n'accepte qu'une connexion à la fois.",
      connectFailed:
        "Ferme l'app KS Fit sur ton téléphone si elle est connectée : le tapis n'accepte qu'une connexion à la fois.",
      unsupportedProtocol:
        "Il n'expose pas le protocole KingSmith. Ouvre une issue en précisant son modèle.",
      disconnected: "Reconnexion automatique en cours.",
    },
  },
  belt: {
    idle: "Arrêté",
    standby: "En veille",
    starting: "Démarrage…",
    unknown: "État inconnu",
  },
  controls: {
    wakeUpFailed: "Le tapis ne s'est pas réveillé. Réessaie.",
    padStoppedNoSteps: "Arrêté par le tapis : aucun pas détecté.",
    padStoppedByPad: "Arrêté par le tapis ou sa télécommande.",
    start: "Démarrer",
    pause: "Pause",
    resume: "Reprendre",
    endSession: "Terminer",
    slower: "Moins vite",
    faster: "Plus vite",
    manual: "Manuel",
    automatic: "Automatique",
    speedRange: (params) => `De ${params.min} à ${params.max} km/h`,
    commandFailed: "La commande n'a pas pu être envoyée au tapis.",
    plateau: (params) => `Palier ${params.speed} · ${params.time}`,
    plateauReady: (params) =>
      `Palier ${params.speed} · ${params.time} · visible sur Strava`,
  },
  goal: {
    title: "Objectif",
    distance: "Distance",
    duration: "Durée",
    set: "Définir",
    hintSession:
      "Le tapis s'arrête tout seul une fois l'objectif de la séance atteint.",
    hintDay: "Le tapis s'arrête tout seul une fois l'objectif du jour atteint.",
    remaining: (params) => `Encore ${params.value}`,
    reached: "Objectif atteint",
    dismiss: "OK",
    invalid: "Saisis un nombre positif.",
    alreadyWalked: "Choisis plus que ce que tu as déjà marché.",
  },
  stats: {
    duration: "Durée",
    distance: "Distance",
    steps: "Pas",
    averageSpeed: "Vitesse moy.",
    maxSpeed: "Vitesse max",
    sessions: "Séances",
    calories: "Calories",
    activeDays: "Jours",
    bestDay: (params) => `Record : ${params.distance}`,
    period: {
      week: "7 jours",
      month: "30 jours",
      year: "12 mois",
      all: "Tout",
    },
  },
  session: {
    endsIn: (params) => `Se termine dans ${params.time} sans reprise`,
    title: "Séance en cours",
    paused: "En pause",
  },
  today: {
    title: "Aujourd'hui",
    empty: "Pas encore de marche aujourd'hui.",
  },
  history: {
    title: "Historique",
    empty: "Aucune séance enregistrée pour le moment.",
    today: "Aujourd'hui",
    date: "Date",
    timeOfDay: "Heure",
    yesterday: "Hier",
    inProgress: "en cours",
    edited: "modifiée",
    delete: "Supprimer",
    confirmDelete: "Supprimer de l'app (pas de Strava) ?",
    export: "Exporter en CSV",
    cancel: "Annuler",
  },
  strava: {
    title: "Strava",
    defaultTitle: "Marche sur tapis",
    connect: "Connecter Strava",
    connecting: "En attente de l'autorisation dans ton navigateur…",
    disconnect: "Déconnecter",
    connectedAs: (params) => `Connecté : ${params.name}`,
    connectHint: "Pour publier tes marches.",
    status: {
      published: "Publiée sur Strava",
      failed: "Échec de la publication",
      dismissed: "Non publiée, marquée comme déjà sur Strava",
      notPublished: "Pas encore publiée",
    },
    publish: "Publier",
    allowAgain: "Autoriser à nouveau la publication",
    preview: {
      title: (params) => `Publier ${params.day}`,
      sessionTitle: (params) => `Publier la séance de ${params.time}`,
      name: "Titre",
      descriptionPlaceholder:
        "Ajoute une note (facultatif). Strava affiche déjà la distance, le temps, les pas et chaque séance.",
      description: "Description",
      publishing: "Publication…",
      dismiss: "Elle est déjà sur Strava, ne pas publier",
      walksAlreadyOnStrava: (params) =>
        `Strava a déjà une marche ce jour-là : ${params.walks}. Publier ajoutera une autre activité.`,
      activeSessionWarning:
        "Une séance est en cours. Les séances enregistrées après la publication ne seront pas ajoutées sur Strava.",
      sessionInProgressWarning:
        "Cette séance est en cours. La suite ne sera pas ajoutée sur Strava.",
      noSessions: "Aucune séance à publier ce jour-là.",
    },
    settings: {
      application: "Application Strava",
      applicationHint: "Domaine de rappel : localhost",
      clientId: "Client ID",
      clientSecret: "Client secret",
      saveCredentials: "Enregistrer",
      autoPublish: "Publier automatiquement",
      autoPublishSessionHint: "Chaque séance part dès qu'elle se termine.",
      grouping: "Une activité par",
      groupingDay: "Jour",
      groupingSession: "Séance",
      publishTime: "Publier chaque jour à",
      titleTemplate: "Titre de l'activité",
      titleTemplateHint:
        "Variables : {distance} {duration} {sessions} {steps} {date}",
      hideFromHome: "Masquer du fil d'actualité",
      hideFromHomeHint: "La visibilité suit tes réglages Strava.",
    },
    errors: {
      notConfigured: "Ajoute ton application Strava dans les réglages.",
      invalidCredentials: "Strava a refusé ce Client ID ou ce secret.",
      notConnected: "Connecte d'abord Strava.",
      encryptionUnavailable:
        "Le trousseau macOS n'est pas disponible pour stocker les tokens Strava.",
      authorizationDenied: "L'autorisation Strava a été refusée.",
      missingScope:
        "Strava n'a pas accordé la permission de publier des activités. Reconnecte-toi en laissant cette permission cochée.",
      authorizationTimeout:
        "L'autorisation Strava a pris trop de temps. Réessaie.",
      rateLimited:
        "Limite de requêtes Strava atteinte. Réessaie dans 15 minutes.",
      network: "Strava est injoignable. Vérifie ta connexion.",
      api: "Strava a renvoyé une erreur.",
    },
    oauthPage: {
      success: "WalkingBar est connecté à Strava. Tu peux fermer cet onglet.",
      failure:
        "La connexion à Strava a échoué. Tu peux fermer cet onglet et réessayer depuis WalkingBar.",
    },
  },
  settings: {
    title: "Réglages",
    language: "Langue",
    systemLanguage: "Système",
    languageNames: {
      en: "English",
      fr: "Français",
      es: "Español",
      it: "Italiano",
      de: "Deutsch",
      nl: "Nederlands",
    },
    pauseTimeout: "Fin de séance après",
    pauseTimeoutHint: "Pause qui termine la séance.",
    minutes: "min",
    accentColor: "Couleur",
    weight: "Poids",
    weightHint: "Sert à estimer les calories dépensées.",
    customColor: "Couleur personnalisée",
    launchAtLogin: "Ouvrir à la connexion",
    launchAtLoginDevHint: "Ne s'applique que dans l'app packagée.",
    pad: "WalkingPad",
    speedShortcuts: "Raccourcis de vitesse",
    plateauIndicator: "Indicateur de palier",
    plateauIndicatorHint: "Montre quand une vitesse a assez duré pour Strava.",
    speedShortcutsHint: (params) =>
      `Jusqu'à ${params.max}, affichés sous la vitesse.`,
    showDiagnosticsLog: "Afficher le journal de diagnostic",
    forgetPad: "Oublier ce tapis",
    version: (params) => `Version ${params.version}`,
  },
}

export default fr
