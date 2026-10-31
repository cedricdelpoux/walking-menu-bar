import {useState} from "react"
import {stravaActivityUrl, type PublicationTarget} from "@shared/strava"
import {usePublication, useStravaState} from "../hooks"
import {useI18n} from "../i18n"
import {stravaErrorMessage} from "../labels"
import {Button, cn} from "./ui"

const api = window.walkingBar

const STRAVA_ORANGE = "#fc4c02"

// The Strava mark, from Simple Icons (CC0).
export function StravaLogo({className}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-3.5 w-3.5 fill-current", className)}
    >
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  )
}

export function ConnectStravaButton() {
  const {t} = useI18n()
  const strava = useStravaState()
  const [error, setError] = useState<string | null>(null)

  if (!strava) return null
  if (strava.connecting)
    return (
      <span className="text-xs text-black/50 dark:text-white/50">
        {t("strava.connecting")}
      </span>
    )

  const connect = async () => {
    setError(null)
    const result = await api.connectStrava()
    if (!result.ok)
      setError(stravaErrorMessage(t, result.error, result.message))
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        className="px-2 py-1 text-xs whitespace-nowrap"
        onClick={() => void connect()}
      >
        {t("strava.connect")}
      </Button>
      {error && (
        <span className="max-w-56 text-right text-[11px] text-rose-500">
          {error}
        </span>
      )}
    </span>
  )
}

export function StravaPublicationIcon({
  target,
  onPublish,
}: {
  target: PublicationTarget
  onPublish: () => void
}) {
  const {t} = useI18n()
  const state = usePublication(target)
  const publication = state?.publication

  if (publication?.status === "published" && publication.activityId) {
    return (
      <a
        href={stravaActivityUrl(publication.activityId)}
        target="_blank"
        rel="noreferrer"
        title={t("strava.status.published")}
        style={{color: STRAVA_ORANGE}}
      >
        <StravaLogo />
      </a>
    )
  }
  if (!state?.draft) return null

  const title =
    publication?.status === "failed"
      ? `${t("strava.status.failed")} · ${stravaErrorMessage(t, publication.lastErrorCode, publication.lastError)}`
      : publication?.status === "dismissed"
        ? t("strava.status.dismissed")
        : t("strava.status.notPublished")
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onPublish}
      className="relative text-black/25 transition hover:text-black/50 dark:text-white/25 dark:hover:text-white/50"
    >
      <StravaLogo />
      {publication?.status === "failed" && (
        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
    </button>
  )
}
