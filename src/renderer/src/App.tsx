import {useEffect, useLayoutEffect, useRef, useState} from "react"
import {
  ChartColumn,
  ChevronLeft,
  Footprints,
  History,
  Settings as SettingsIcon,
} from "lucide-react"
import type {LiveState} from "@shared/ipc"
import {formatTimeOfDay} from "@shared/format"
import {ConnectionBadge, ConnectionNotice} from "./components/ConnectionNotice"
import {PadControls} from "./components/PadControls"
import {CurrentSessionCard, TodayCard} from "./components/SessionCards"
import {IconButton} from "./components/ui"
import {useLiveState, useSettings} from "./hooks"
import {WeightContext} from "./calories"
import {I18nProvider, useI18n} from "./i18n"
import {dayLabel} from "./labels"
import {HistoryView, type PublishRequest} from "./views/HistoryView"
import {PublishView} from "./views/PublishView"
import {SettingsView} from "./views/SettingsView"
import {StatsView} from "./views/StatsView"

type View = "home" | "history" | "stats" | "settings" | "publish"

const initialView =
  (new URLSearchParams(window.location.search).get("view") as View | null) ??
  "home"

export function App() {
  const [snapshot, updateSettings] = useSettings()
  const accentColor = snapshot?.settings.accentColor
  useEffect(() => {
    if (accentColor)
      document.documentElement.style.setProperty("--color-accent", accentColor)
  }, [accentColor])
  const live = useLiveState()
  const [view, setView] = useState<View>(initialView)
  const [publishRequest, setPublishRequest] = useState<
    (PublishRequest & {returnTo: View}) | null
  >(null)
  const {headerRef, mainRef, contentRef} = useWindowFittedToContent(
    snapshot !== null
  )

  if (!snapshot) return null

  const openPublish = (request: PublishRequest) => {
    setPublishRequest({...request, returnTo: view})
    setView("publish")
  }
  const closePublish = () => setView(publishRequest?.returnTo ?? "home")

  return (
    <I18nProvider locale={snapshot.locale}>
      <WeightContext.Provider value={snapshot.settings.weightKg}>
        <div className="flex max-h-full flex-col">
          <Header
            headerRef={headerRef}
            view={view}
            onNavigate={(next) =>
              view === "publish" && next === "home"
                ? closePublish()
                : setView(next)
            }
            live={live}
            publishRequest={publishRequest}
          />
          <main
            ref={mainRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
          >
            <div ref={contentRef} className="space-y-3">
              {view === "home" && live && (
                <HomeView
                  live={live}
                  speedShortcutsKmh={snapshot.settings.speedShortcutsKmh}
                  showPlateauIndicator={snapshot.settings.showPlateauIndicator}
                />
              )}
              {view === "history" && <HistoryView onPublish={openPublish} />}
              {view === "stats" && <StatsView />}
              {view === "publish" && publishRequest && (
                <PublishView
                  target={publishRequest.target}
                  walksOnStrava={publishRequest.walks}
                  onDone={closePublish}
                />
              )}
              {view === "settings" && (
                <SettingsView
                  settings={snapshot.settings}
                  onChange={updateSettings}
                  live={live}
                />
              )}
            </div>
          </main>
        </div>
      </WeightContext.Provider>
    </I18nProvider>
  )
}

// The window takes the height of the header plus the whole content, so nothing scrolls while the
// screen has room for it.
function useWindowFittedToContent(isRendered: boolean) {
  const headerRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const header = headerRef.current
    const main = mainRef.current
    const content = contentRef.current
    if (!header || !main || !content) return
    const fitWindow = () =>
      void window.walkingBar.fitWindowHeight(
        Math.ceil(header.offsetHeight + main.scrollHeight)
      )
    const observer = new ResizeObserver(fitWindow)
    observer.observe(header)
    observer.observe(content)
    return () => observer.disconnect()
  }, [isRendered])
  return {headerRef, mainRef, contentRef}
}

function Header({
  headerRef,
  view,
  onNavigate,
  live,
  publishRequest,
}: {
  headerRef: React.RefObject<HTMLElement | null>
  view: View
  onNavigate: (view: View) => void
  live: LiveState | null
  publishRequest: PublishRequest | null
}) {
  const {t, locale} = useI18n()
  const publishTitle = ({target, sessionStartedAt}: PublishRequest) =>
    sessionStartedAt === null
      ? t("strava.preview.title", {
          day: dayLabel(target.day, t, locale).toLowerCase(),
        })
      : t("strava.preview.sessionTitle", {
          time: formatTimeOfDay(sessionStartedAt, locale),
        })
  const titles: Record<Exclude<View, "home">, string> = {
    history: t("history.title"),
    stats: t("nav.stats"),
    settings: t("settings.title"),
    publish: publishRequest ? publishTitle(publishRequest) : "",
  }
  return (
    <header
      ref={headerRef}
      className="flex h-11 shrink-0 items-center gap-2 px-3"
    >
      {view === "home" ? (
        <>
          <Footprints className="h-4 w-4 text-accent" />
          <h1 className="text-sm font-semibold">{t("app.name")}</h1>
          {live && <ConnectionBadge connection={live.connection} />}
          <div className="ml-auto flex">
            <IconButton
              label={t("nav.history")}
              onClick={() => onNavigate("history")}
            >
              <History className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={t("nav.stats")}
              onClick={() => onNavigate("stats")}
            >
              <ChartColumn className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={t("nav.settings")}
              onClick={() => onNavigate("settings")}
            >
              <SettingsIcon className="h-4 w-4" />
            </IconButton>
          </div>
        </>
      ) : (
        <>
          <IconButton
            label={t("nav.back")}
            onClick={() => onNavigate("home")}
            className="-ml-1"
          >
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <h1 className="text-sm font-semibold">{titles[view]}</h1>
        </>
      )}
    </header>
  )
}

function HomeView({
  live,
  speedShortcutsKmh,
  showPlateauIndicator,
}: {
  live: LiveState
  speedShortcutsKmh: number[]
  showPlateauIndicator: boolean
}) {
  return (
    <>
      <ConnectionNotice connection={live.connection} />
      <PadControls
        live={live}
        speedShortcutsKmh={speedShortcutsKmh}
        showPlateauIndicator={showPlateauIndicator}
      />
      <CurrentSessionCard live={live} />
      <TodayCard live={live} />
    </>
  )
}
