import type {StravaCredentials} from "../../shared/strava"
import type {AppStateRepository} from "../storage/app-state-repository"
import type {SecretBox} from "./strava-account"

const CREDENTIALS_KEY = "stravaCredentials"

// Credentials typed in the settings win over the ones built in from .env.
export class StravaCredentialStore {
  private saved: StravaCredentials | null

  constructor(
    private readonly appState: AppStateRepository,
    private readonly secretBox: SecretBox,
    private readonly builtIn: StravaCredentials | null
  ) {
    this.saved = this.load()
  }

  get(): StravaCredentials | null {
    return this.saved ?? this.builtIn
  }

  save(credentials: StravaCredentials): void {
    this.appState.set(
      CREDENTIALS_KEY,
      this.secretBox.encrypt(JSON.stringify(credentials))
    )
    this.saved = credentials
  }

  private load(): StravaCredentials | null {
    const stored = this.appState.get<string>(CREDENTIALS_KEY)
    if (!stored || !this.secretBox.isAvailable()) return null
    try {
      return JSON.parse(this.secretBox.decrypt(stored)) as StravaCredentials
    } catch {
      return null
    }
  }
}
