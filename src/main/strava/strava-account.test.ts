import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"
import {AppStateRepository} from "../storage/app-state-repository"
import {openDatabase, type AppDatabase} from "../storage/database"
import {StravaAccount, type SecretBox} from "./strava-account"
import {StravaCredentialStore} from "./strava-credentials"
import {StravaError, StravaHttp, type StravaTokens} from "./strava-http"
import type {StravaCredentials} from "../../shared/strava"

const NOW = Date.UTC(2026, 9, 16, 20, 0)
const reversingSecretBox: SecretBox = {
  isAvailable: () => true,
  encrypt: (text) =>
    Buffer.from([...text].reverse().join("")).toString("base64"),
  decrypt: (cipher) =>
    [...Buffer.from(cipher, "base64").toString()].reverse().join(""),
}

const BUILT_IN_CREDENTIALS = {clientId: "1", clientSecret: "built-in-secret"}

const tokens = (expiresAt: number): StravaTokens => ({
  accessToken: "old-access",
  refreshToken: "old-refresh",
  expiresAt,
  athlete: {id: 1, firstname: "Cédric", lastname: "D"},
})

describe("StravaAccount", () => {
  let database: AppDatabase
  let appState: AppStateRepository

  const createCredentials = (builtIn: StravaCredentials | null) =>
    new StravaCredentialStore(appState, reversingSecretBox, builtIn)

  const createAccount = (http: Partial<StravaHttp>) =>
    new StravaAccount({
      http: http as StravaHttp,
      credentials: createCredentials(BUILT_IN_CREDENTIALS),
      appState,
      secretBox: reversingSecretBox,
      openBrowser: () => undefined,
      callbackPages: () => ({success: "", failure: ""}),
      now: () => NOW,
    })

  beforeEach(() => {
    database = openDatabase(":memory:")
    appState = new AppStateRepository(database)
  })

  afterEach(() => database.close())

  it("never stores the tokens in clear", () => {
    appState.set(
      "stravaTokens",
      reversingSecretBox.encrypt(JSON.stringify(tokens(NOW / 1000 + 3600)))
    )
    expect(appState.get<string>("stravaTokens")).not.toContain("old-access")
    expect(createAccount({}).getState()).toMatchObject({
      connected: true,
      athlete: {firstname: "Cédric"},
    })
  })

  it("prefers the saved credentials, keeps them encrypted and never exposes the secret", async () => {
    const account = createAccount({})
    expect(account.getState()).toMatchObject({configured: true, clientId: "1"})

    await account.saveCredentials({clientId: "2", clientSecret: "typed-secret"})

    expect(appState.get<string>("stravaCredentials")).not.toContain(
      "typed-secret"
    )
    expect(JSON.stringify(account.getState())).not.toContain("secret")
    expect(createCredentials(BUILT_IN_CREDENTIALS).get()).toEqual({
      clientId: "2",
      clientSecret: "typed-secret",
    })
  })

  it("is not configured without any credentials", async () => {
    const account = new StravaAccount({
      http: {} as StravaHttp,
      credentials: createCredentials(null),
      appState,
      secretBox: reversingSecretBox,
      openBrowser: () => undefined,
      callbackPages: () => ({success: "", failure: ""}),
    })
    expect(account.getState()).toMatchObject({
      configured: false,
      clientId: null,
    })
    expect(await account.connect()).toMatchObject({
      ok: false,
      error: "notConfigured",
    })
    await expect(account.getAccessToken()).rejects.toMatchObject({
      code: "notConfigured",
    })
  })

  it("disconnects when the credentials change, since the tokens belong to the old application", async () => {
    appState.set(
      "stravaTokens",
      reversingSecretBox.encrypt(JSON.stringify(tokens(NOW / 1000 + 3600)))
    )
    const deauthorize = vi.fn(async () => undefined)
    const account = createAccount({deauthorize})

    await account.saveCredentials({clientId: "2", clientSecret: "typed-secret"})

    expect(deauthorize).toHaveBeenCalledWith("old-access")
    expect(account.getState()).toMatchObject({connected: false, clientId: "2"})
  })

  it("reads the credentials at each request, so saved ones work without a restart", () => {
    const credentials = createCredentials(null)
    const http = new StravaHttp(() => credentials.get())
    expect(() =>
      http.authorizeUrl("http://127.0.0.1/callback", "state")
    ).toThrow("notConfigured")

    credentials.save({clientId: "2", clientSecret: "typed-secret"})

    expect(http.authorizeUrl("http://127.0.0.1/callback", "state")).toContain(
      "client_id=2"
    )
  })

  it("returns the current token while it is valid", async () => {
    appState.set(
      "stravaTokens",
      reversingSecretBox.encrypt(JSON.stringify(tokens(NOW / 1000 + 3600)))
    )
    const refresh = vi.fn()
    expect(await createAccount({refresh}).getAccessToken()).toBe("old-access")
    expect(refresh).not.toHaveBeenCalled()
  })

  it("refreshes an expiring token once and keeps the rotated refresh token", async () => {
    appState.set(
      "stravaTokens",
      reversingSecretBox.encrypt(JSON.stringify(tokens(NOW / 1000 + 30)))
    )
    const refresh = vi.fn(async () => ({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: NOW / 1000 + 21600,
    }))
    const account = createAccount({refresh})

    const [first, second] = await Promise.all([
      account.getAccessToken(),
      account.getAccessToken(),
    ])

    expect([first, second]).toEqual(["new-access", "new-access"])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith("old-refresh")
    const stored = JSON.parse(
      reversingSecretBox.decrypt(appState.get<string>("stravaTokens")!)
    ) as StravaTokens
    expect(stored).toMatchObject({
      refreshToken: "new-refresh",
      athlete: {id: 1},
    })
  })

  it("disconnects when Strava revokes the refresh token, but not on an outage", async () => {
    appState.set(
      "stravaTokens",
      reversingSecretBox.encrypt(JSON.stringify(tokens(NOW / 1000)))
    )
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new StravaError("api", "Service Unavailable", 503))
      .mockRejectedValueOnce(new StravaError("api", "Bad Request", 400))
    const account = createAccount({refresh})

    await expect(account.getAccessToken()).rejects.toMatchObject({code: "api"})
    expect(account.getState().connected).toBe(true)

    await expect(account.getAccessToken()).rejects.toMatchObject({
      code: "notConnected",
    })
    expect(account.getState().connected).toBe(false)
    expect(appState.get("stravaTokens")).toBeUndefined()
  })
})

describe("StravaHttp", () => {
  const response = (status: number, body: string) =>
    new Response(body, {status})

  it("maps HTTP errors to error codes with a readable message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429, '{"message":"Rate Limit Exceeded"}'))
      .mockResolvedValueOnce(
        response(
          400,
          '{"message":"Bad Request","errors":[{"resource":"Upload","field":"file","code":"invalid"}]}'
        )
      )
      .mockRejectedValueOnce(new TypeError("fetch failed"))
    const http = new StravaHttp(
      () => ({clientId: "1", clientSecret: "s"}),
      fetchMock
    )

    await expect(http.getUpload("t", 1)).rejects.toMatchObject({
      code: "rateLimited",
      status: 429,
    })
    await expect(http.getUpload("t", 1)).rejects.toMatchObject({
      code: "api",
      message: "Bad Request: file invalid",
    })
    await expect(http.getUpload("t", 1)).rejects.toMatchObject({
      code: "network",
    })
  })

  it("uploads the FIT file with the fields Strava expects", async () => {
    const fetchMock = vi.fn(async () =>
      response(
        201,
        '{"id":5,"status":"Your activity is still being processed.","error":null,"activity_id":null}'
      )
    )
    const http = new StravaHttp(
      () => ({clientId: "1", clientSecret: "s"}),
      fetchMock
    )
    const upload = await http.uploadActivityFile("token", {
      fitFile: Uint8Array.from([1, 2, 3]),
      name: "Walk",
      description: "Desc",
      externalId: "walkingbar-2026-10-20-abcd1234",
    })

    expect(upload).toMatchObject({id: 5, activity_id: null})
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe("https://www.strava.com/api/v3/uploads")
    const form = init.body as FormData
    expect(
      Object.fromEntries([...form.entries()].filter(([key]) => key !== "file"))
    ).toEqual({
      data_type: "fit",
      external_id: "walkingbar-2026-10-20-abcd1234",
      name: "Walk",
      description: "Desc",
      trainer: "1",
    })
    expect((form.get("file") as File).name).toBe(
      "walkingbar-2026-10-20-abcd1234.fit"
    )
  })
})
