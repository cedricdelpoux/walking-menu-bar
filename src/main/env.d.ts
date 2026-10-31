// Values come from .env at build time (see .env.example).
interface ImportMetaEnv {
  readonly MAIN_VITE_STRAVA_CLIENT_ID?: string
  readonly MAIN_VITE_STRAVA_CLIENT_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
