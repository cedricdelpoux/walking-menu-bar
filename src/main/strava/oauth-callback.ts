import {randomUUID} from "node:crypto"
import {createServer} from "node:http"
import type {AddressInfo} from "node:net"
import {StravaError} from "./strava-http"

export interface AuthorizationResult {
  code: string
  scope: string
}

export interface AuthorizationFlowOptions {
  buildAuthorizeUrl: (redirectUri: string, state: string) => string
  openBrowser: (url: string) => void
  pages: {success: string; failure: string}
  timeoutMs: number
  signal?: AbortSignal
}

const CALLBACK_PATH = "/strava/callback"

const page = (message: string) =>
  `<!doctype html><meta charset="utf-8"><title>WalkingBar</title>` +
  `<body style="font:16px -apple-system,system-ui;display:grid;place-items:center;height:90vh;margin:0">` +
  `<p>${message}</p></body>`

// Strava always accepts 127.0.0.1 as a redirect, whatever callback domain the app declares,
// so a one-shot local server can receive the authorization code.
export function runAuthorizationFlow(
  options: AuthorizationFlowOptions
): Promise<AuthorizationResult> {
  const state = randomUUID()

  return new Promise<AuthorizationResult>((resolve, reject) => {
    const timer = setTimeout(
      () => finish(new StravaError("authorizationTimeout")),
      options.timeoutMs
    )
    const onAbort = () =>
      finish(new StravaError("authorizationTimeout", "cancelled"))
    options.signal?.addEventListener("abort", onAbort)

    function finish(outcome: AuthorizationResult | StravaError) {
      clearTimeout(timer)
      options.signal?.removeEventListener("abort", onAbort)
      server.close()
      server.closeAllConnections()
      if (outcome instanceof StravaError) reject(outcome)
      else resolve(outcome)
    }

    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1")
      if (url.pathname !== CALLBACK_PATH) {
        response.writeHead(404).end()
        return
      }
      const code = url.searchParams.get("code")
      const succeeded = url.searchParams.get("state") === state && code !== null
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        Connection: "close",
      })
      response.end(
        page(succeeded ? options.pages.success : options.pages.failure)
      )

      if (url.searchParams.get("state") !== state)
        finish(new StravaError("authorizationDenied", "state mismatch"))
      else if (!code)
        finish(
          new StravaError(
            "authorizationDenied",
            url.searchParams.get("error") ?? "no code"
          )
        )
      else finish({code, scope: url.searchParams.get("scope") ?? ""})
    })

    server.on("error", (error) =>
      finish(new StravaError("network", error.message))
    )
    server.listen(0, "127.0.0.1", () => {
      const {port} = server.address() as AddressInfo
      const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`
      options.openBrowser(options.buildAuthorizeUrl(redirectUri, state))
    })
  })
}
