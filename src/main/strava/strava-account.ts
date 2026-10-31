import {EventEmitter} from "node:events"
import type {
  StravaCredentials,
  StravaErrorCode,
  StravaResult,
  StravaState,
} from "../../shared/strava"
import type {AppStateRepository} from "../storage/app-state-repository"
import {runAuthorizationFlow} from "./oauth-callback"
import type {StravaCredentialStore} from "./strava-credentials"
import {
  REQUIRED_SCOPE,
  StravaError,
  type StravaHttp,
  type StravaTokens,
} from "./strava-http"

const TOKENS_KEY = "stravaTokens"
const AUTHORIZATION_TIMEOUT_MS = 5 * 60_000
const TOKEN_REFRESH_MARGIN_SECONDS = 60

// Abstracts Electron's safeStorage, which encrypts with a key kept in the macOS Keychain.
export interface SecretBox {
  isAvailable(): boolean
  encrypt(plainText: string): string
  decrypt(cipherText: string): string
}

export interface StravaAccountOptions {
  http: StravaHttp
  credentials: StravaCredentialStore
  appState: AppStateRepository
  secretBox: SecretBox
  openBrowser: (url: string) => void
  callbackPages: () => {success: string; failure: string}
  now?: () => number
}

export function toStravaResult<T>(error: unknown): StravaResult<T> {
  if (error instanceof StravaError)
    return {ok: false, error: error.code, message: error.message}
  return {
    ok: false,
    error: "api" satisfies StravaErrorCode,
    message: (error as Error).message,
  }
}

export class StravaAccount extends EventEmitter<{change: [StravaState]}> {
  private tokens: StravaTokens | null = null
  private pendingAuthorization: AbortController | null = null
  private pendingRefresh: Promise<string> | null = null
  private readonly now: () => number

  constructor(private readonly options: StravaAccountOptions) {
    super()
    this.now = options.now ?? Date.now
    this.tokens = this.loadTokens()
  }

  getState(): StravaState {
    const credentials = this.options.credentials.get()
    return {
      configured: credentials !== null,
      clientId: credentials?.clientId ?? null,
      connected: this.tokens !== null,
      connecting: this.pendingAuthorization !== null,
      athlete: this.tokens?.athlete ?? null,
      connectedAt: this.tokens?.connectedAt ?? null,
    }
  }

  async connect(): Promise<StravaResult<StravaState>> {
    const {credentials, http, secretBox} = this.options
    if (!credentials.get())
      return toStravaResult(new StravaError("notConfigured"))
    if (!secretBox.isAvailable())
      return toStravaResult(new StravaError("encryptionUnavailable"))

    this.pendingAuthorization?.abort()
    const controller = new AbortController()
    this.pendingAuthorization = controller
    this.emitChange()
    try {
      const {code, scope} = await runAuthorizationFlow({
        buildAuthorizeUrl: (redirectUri, state) =>
          http.authorizeUrl(redirectUri, state),
        openBrowser: this.options.openBrowser,
        pages: this.options.callbackPages(),
        timeoutMs: AUTHORIZATION_TIMEOUT_MS,
        signal: controller.signal,
      })
      if (!scope.split(",").includes(REQUIRED_SCOPE))
        throw new StravaError("missingScope", scope)
      this.saveTokens({
        ...(await this.exchangeCode(code)),
        connectedAt: this.now(),
      })
      return {ok: true, value: this.getState()}
    } catch (error) {
      return toStravaResult(error)
    } finally {
      if (this.pendingAuthorization === controller)
        this.pendingAuthorization = null
      this.emitChange()
    }
  }

  // Tokens belong to the Strava application that issued them, so a new one starts disconnected.
  async saveCredentials(
    credentials: StravaCredentials
  ): Promise<StravaResult<StravaState>> {
    if (!this.options.secretBox.isAvailable())
      return toStravaResult(new StravaError("encryptionUnavailable"))
    await this.disconnect()
    this.options.credentials.save(credentials)
    this.emitChange()
    return {ok: true, value: this.getState()}
  }

  async disconnect(): Promise<void> {
    this.pendingAuthorization?.abort()
    const accessToken = this.tokens?.accessToken
    this.saveTokens(null)
    if (accessToken)
      await this.options.http.deauthorize(accessToken).catch(() => undefined)
  }

  getAccessToken(): Promise<string> {
    const tokens = this.tokens
    if (!this.options.credentials.get())
      return Promise.reject(new StravaError("notConfigured"))
    if (!tokens) return Promise.reject(new StravaError("notConnected"))
    if (tokens.expiresAt > this.now() / 1000 + TOKEN_REFRESH_MARGIN_SECONDS)
      return Promise.resolve(tokens.accessToken)

    this.pendingRefresh ??= this.refresh(this.options.http, tokens).finally(
      () => {
        this.pendingRefresh = null
      }
    )
    return this.pendingRefresh
  }

  private async exchangeCode(code: string) {
    try {
      return await this.options.http.exchangeCode(code)
    } catch (error) {
      const isRefused =
        error instanceof StravaError &&
        (error.status === 400 || error.status === 401)
      throw isRefused
        ? new StravaError("invalidCredentials", error.message, error.status)
        : error
    }
  }

  private async refresh(
    http: StravaHttp,
    tokens: StravaTokens
  ): Promise<string> {
    try {
      // Strava rotates the refresh token: the previous one stops working right away.
      const refreshed = await http.refresh(tokens.refreshToken)
      this.saveTokens({...tokens, ...refreshed})
      return refreshed.accessToken
    } catch (error) {
      const refreshTokenRevoked =
        error instanceof StravaError &&
        (error.status === 400 || error.status === 401)
      if (refreshTokenRevoked) {
        this.saveTokens(null)
        throw new StravaError("notConnected", (error as Error).message)
      }
      throw error
    }
  }

  private loadTokens(): StravaTokens | null {
    const stored = this.options.appState.get<string>(TOKENS_KEY)
    if (!stored || !this.options.secretBox.isAvailable()) return null
    try {
      const tokens = JSON.parse(
        this.options.secretBox.decrypt(stored)
      ) as StravaTokens
      if (tokens.connectedAt !== undefined) return tokens
      // Tokens saved before connectedAt existed: automatic publishing starts from now.
      const migrated = {...tokens, connectedAt: this.now()}
      this.options.appState.set(
        TOKENS_KEY,
        this.options.secretBox.encrypt(JSON.stringify(migrated))
      )
      return migrated
    } catch {
      return null
    }
  }

  private saveTokens(tokens: StravaTokens | null): void {
    this.tokens = tokens
    if (tokens)
      this.options.appState.set(
        TOKENS_KEY,
        this.options.secretBox.encrypt(JSON.stringify(tokens))
      )
    else this.options.appState.delete(TOKENS_KEY)
    this.emitChange()
  }

  private emitChange(): void {
    this.emit("change", this.getState())
  }
}
