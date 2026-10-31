import {Bluetooth, BluetoothOff, Loader2, TriangleAlert} from "lucide-react"
import type {PadConnectionState} from "@shared/pad"
import {useNow} from "../hooks"
import {useI18n} from "../i18n"

export function ConnectionBadge({
  connection,
}: {
  connection: PadConnectionState
}) {
  const {t} = useI18n()
  const isConnected = connection.kind === "connected"
  return (
    <span
      className="flex items-center gap-1 text-[11px] text-black/50 dark:text-white/50"
      title={
        isConnected
          ? t("connection.connected", {name: connection.padName})
          : undefined
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-accent" : "bg-amber-500"}`}
      />
      {isConnected ? connection.padName : null}
    </span>
  )
}

export function ConnectionNotice({
  connection,
}: {
  connection: PadConnectionState
}) {
  const {t} = useI18n()
  const now = useNow(1000)

  if (connection.kind === "connected") return null

  let icon = <Loader2 className="h-4 w-4 animate-spin" />
  let title: string
  let hint: string | null = null

  switch (connection.kind) {
    case "bluetoothUnavailable":
      icon = <BluetoothOff className="h-4 w-4" />
      title = t("connection.bluetoothUnavailable")
      hint = t("connection.bluetoothUnavailableHint")
      break
    case "connecting":
      title = t("connection.connecting", {name: connection.padName})
      break
    case "retrying": {
      icon = <TriangleAlert className="h-4 w-4 text-amber-500" />
      const seconds = Math.max(0, Math.ceil((connection.retryAt - now) / 1000))
      title = t(`connection.failure.${connection.failure}`)
      hint = `${t(`connection.failureHint.${connection.failure}`)} ${t("connection.retrying", {seconds})}`
      break
    }
    case "stopped":
      icon = <Bluetooth className="h-4 w-4" />
      title = t("connection.stopped")
      break
    default:
      title = t("connection.scanning")
  }

  return (
    <div className="flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        {hint && (
          <p className="mt-0.5 text-xs text-black/60 dark:text-white/60">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
