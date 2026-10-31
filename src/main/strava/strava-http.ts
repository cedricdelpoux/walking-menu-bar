import type {
  StravaAthlete,
  StravaCredentials,
  StravaErrorCode,
} from "../../shared/strava"

const API_URL = "https://www.strava.com/api/v3"
const OAUTH_URL = "https://www.strava.com/oauth"

// activity:read_all also covers private activities when looking for one already published.
export const STRAVA_SCOPE = "activity:read_all,activity:write"
export const REQUIRED_SCOPE = "activity:write"
export const ACTIVITIES_PER_PAGE = 100

export class StravaError extends Error {
  constructor(
    readonly code: StravaErrorCode,
    message: string = code,
    readonly status?: number
  ) {
    super(message)
  }
}

export interface StravaTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  athlete: StravaAthlete
  connectedAt?: number
}

export interface ActivityFileUpload {
  fitFile: Uint8Array
  name: string
  description: string
  externalId: string
}

export interface StravaUpload {
  id: number
  status: string
  error: string | null
  activity_id: number | null
}

export interface StravaSummaryActivity {
  id: number
  name: string
  sport_type: string
  start_date_local: string
  distance: number
  trainer: boolean
}

type FetchFunction = typeof fetch

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
}

// Strava sometimes answers with HTML fragments, which are unreadable in the popover.
export function toPlainText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(amp|lt|gt|quot|#39);/g,
      (match, name: string) => ENTITIES[name] ?? match
    )
    .trim()
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  try {
    const body = JSON.parse(text) as {
      message?: string
      errors?: Array<{field?: string; code?: string}>
    }
    const details = body.errors
      ?.map((error) => [error.field, error.code].filter(Boolean).join(" "))
      .join(", ")
    return (
      [body.message, details].filter(Boolean).join(": ") ||
      `HTTP ${response.status}`
    )
  } catch {
    return toPlainText(text).slice(0, 300) || `HTTP ${response.status}`
  }
}

export class StravaHttp {
  constructor(
    private readonly getCredentials: () => StravaCredentials | null,
    private readonly fetchFunction: FetchFunction = fetch
  ) {}

  private get credentials(): StravaCredentials {
    const credentials = this.getCredentials()
    if (!credentials) throw new StravaError("notConfigured")
    return credentials
  }

  authorizeUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      approval_prompt: "auto",
      scope: STRAVA_SCOPE,
      state,
    })
    return `${OAUTH_URL}/authorize?${params}`
  }

  async exchangeCode(code: string): Promise<StravaTokens> {
    const body = await this.tokenRequest({
      grant_type: "authorization_code",
      code,
    })
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: body.expires_at,
      athlete: {
        id: body.athlete.id,
        firstname: body.athlete.firstname,
        lastname: body.athlete.lastname,
      },
    }
  }

  async refresh(refreshToken: string): Promise<Omit<StravaTokens, "athlete">> {
    const body = await this.tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: body.expires_at,
    }
  }

  async deauthorize(accessToken: string): Promise<void> {
    await this.send(`${OAUTH_URL}/deauthorize`, {
      method: "POST",
      body: new URLSearchParams({access_token: accessToken}),
    })
  }

  uploadActivityFile(
    accessToken: string,
    upload: ActivityFileUpload
  ): Promise<StravaUpload> {
    const form = new FormData()
    form.append("data_type", "fit")
    form.append("external_id", upload.externalId)
    form.append("name", upload.name)
    form.append("description", upload.description)
    form.append("trainer", "1")
    form.append(
      "file",
      new Blob([new Uint8Array(upload.fitFile)], {
        type: "application/octet-stream",
      }),
      `${upload.externalId}.fit`
    )
    return this.send<StravaUpload>(`${API_URL}/uploads`, {
      method: "POST",
      headers: {Authorization: `Bearer ${accessToken}`},
      body: form,
    })
  }

  getUpload(accessToken: string, uploadId: number): Promise<StravaUpload> {
    return this.api<StravaUpload>(accessToken, "GET", `/uploads/${uploadId}`)
  }

  updateActivity(
    accessToken: string,
    id: string,
    fields: {hide_from_home?: boolean}
  ): Promise<unknown> {
    return this.api(accessToken, "PUT", `/activities/${id}`, fields)
  }

  listActivities(
    accessToken: string,
    afterEpochSeconds: number,
    beforeEpochSeconds: number,
    page = 1
  ) {
    const query = new URLSearchParams({
      after: String(Math.floor(afterEpochSeconds)),
      before: String(Math.ceil(beforeEpochSeconds)),
      per_page: String(ACTIVITIES_PER_PAGE),
      page: String(page),
    })
    return this.api<StravaSummaryActivity[]>(
      accessToken,
      "GET",
      `/athlete/activities?${query}`
    )
  }

  private tokenRequest(fields: Record<string, string>) {
    return this.send<{
      access_token: string
      refresh_token: string
      expires_at: number
      athlete: StravaAthlete
    }>(`${OAUTH_URL}/token`, {
      method: "POST",
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        ...fields,
      }),
    })
  }

  private api<T>(
    accessToken: string,
    method: string,
    path: string,
    body?: object
  ): Promise<T> {
    return this.send<T>(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? {"Content-Type": "application/json"} : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  private async send<T>(url: string, init: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await this.fetchFunction(url, init)
    } catch (error) {
      throw new StravaError("network", (error as Error).message)
    }
    if (response.ok) return (await response.json()) as T

    const message = await readErrorMessage(response)
    if (response.status === 429)
      throw new StravaError("rateLimited", message, response.status)
    if (response.status === 401)
      throw new StravaError("notConnected", message, response.status)
    throw new StravaError("api", message, response.status)
  }
}
