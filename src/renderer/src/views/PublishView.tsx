import {useEffect, useState} from "react"
import {TriangleAlert} from "lucide-react"
import {formatDuration, formatKilometers} from "@shared/format"
import type {PublicationTarget, StravaWalk} from "@shared/strava"
import {usePublication, useStravaState} from "../hooks"
import {useI18n} from "../i18n"
import {stravaErrorMessage} from "../labels"
import {ConnectStravaButton} from "../components/StravaControls"
import {Button, Card} from "../components/ui"

const api = window.walkingBar

const fieldClassName =
  "mt-0.5 w-full rounded-md border border-black/10 bg-white px-2 py-1 text-sm text-black outline-none focus:border-accent dark:border-white/15 dark:bg-white/10 dark:text-white"

function Warning({children}: {children: string}) {
  return (
    <p className="flex gap-2 rounded-lg bg-amber-500/10 p-2 text-xs">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
      {children}
    </p>
  )
}

export function PublishView({
  target,
  walksOnStrava,
  onDone,
}: {
  target: PublicationTarget
  walksOnStrava: StravaWalk[]
  onDone: () => void
}) {
  const {t, locale} = useI18n()
  const strava = useStravaState()
  const state = usePublication(target)
  const [name, setName] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const draft = state?.draft
  useEffect(() => {
    if (!draft) return
    setName((current) => current ?? draft.name)
    setDescription((current) => current ?? draft.description)
  }, [draft])

  if (!strava || !state) return null

  if (!strava.connected) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">{t("strava.connectHint")}</p>
          <ConnectStravaButton />
        </div>
      </Card>
    )
  }
  if (!draft)
    return (
      <p className="p-1 text-sm text-black/50 dark:text-white/50">
        {t("strava.preview.noSessions")}
      </p>
    )

  if (state.publication?.status === "dismissed") {
    return (
      <Card>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">{t("strava.status.dismissed")}</p>
          <Button
            className="px-2 py-1 text-xs"
            onClick={() => void api.resetPublication(target)}
          >
            {t("strava.allowAgain")}
          </Button>
        </div>
      </Card>
    )
  }

  const publish = async () => {
    setIsPublishing(true)
    setError(null)
    const result = await api.publish(target, {
      name: name ?? undefined,
      description: description ?? undefined,
    })
    setIsPublishing(false)
    if (result.ok) onDone()
    else setError(stravaErrorMessage(t, result.error, result.message))
  }

  const dismiss = async () => {
    await api.dismissPublication(target)
    onDone()
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-black/50 tabular-nums dark:text-white/50">
        {formatKilometers(draft.distanceMeters, locale)} ·{" "}
        {formatDuration(draft.elapsedTimeSeconds)}
      </p>
      {walksOnStrava.length > 0 && (
        <Warning>
          {t("strava.preview.walksAlreadyOnStrava", {
            walks: walksOnStrava
              .map(
                (walk) =>
                  `${walk.name} (${formatKilometers(walk.distanceMeters, locale)})`
              )
              .join(", "),
          })}
        </Warning>
      )}
      {state.hasActiveSession && (
        <Warning>
          {target.sessionId === null
            ? t("strava.preview.activeSessionWarning")
            : t("strava.preview.sessionInProgressWarning")}
        </Warning>
      )}

      <label className="block text-xs text-black/50 dark:text-white/50">
        {t("strava.preview.name")}
        <input
          value={name ?? ""}
          onChange={(event) => setName(event.target.value)}
          className={fieldClassName}
        />
      </label>
      <label className="block text-xs text-black/50 dark:text-white/50">
        {t("strava.preview.description")}
        <textarea
          value={description ?? ""}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("strava.preview.descriptionPlaceholder")}
          rows={4}
          className={`${fieldClassName} resize-none`}
        />
      </label>

      {error && <p className="text-xs text-rose-500">{error}</p>}

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          className="px-1 text-xs text-black/50 dark:text-white/50"
          onClick={() => void dismiss()}
        >
          {t("strava.preview.dismiss")}
        </Button>
        <span className="flex-1" />
        <Button className="px-2 py-1 text-xs" onClick={onDone}>
          {t("history.cancel")}
        </Button>
        <Button
          variant="primary"
          className="px-2 py-1 text-xs"
          disabled={isPublishing}
          onClick={() => void publish()}
        >
          {isPublishing ? t("strava.preview.publishing") : t("strava.publish")}
        </Button>
      </div>
    </div>
  )
}
