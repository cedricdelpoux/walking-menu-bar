// Scans for a WalkingPad, connects, dumps its GATT tree and prints live statuses.
// Read-only: it never sends a command that moves the belt.
//
// Usage: npm run probe -- [--id <peripheralId>] [--scan-seconds 15] [--list] [--raw] [--records]
import noble, {type Characteristic, type Peripheral} from "@stoprocent/noble"
import {
  detectProtocol,
  FTMS_SERVICE_UUID,
  looksLikeWalkingPad,
} from "../src/main/pad/protocol/detect"
import type {PadProtocol, PadStatus} from "../src/main/pad/protocol/types"
import {normalizeUuid} from "../src/main/pad/protocol/uuid"

const FTMS_TREADMILL_DATA_UUID = "2acd"
const STATUS_POLL_INTERVAL_MS = 1000
const CONNECT_TIMEOUT_MS = 15000

interface ProbeOptions {
  peripheralId?: string
  scanSeconds: number
  listOnly: boolean
  showRaw: boolean
  requestRecords: boolean
}

function parseOptions(argv: string[]): ProbeOptions {
  const valueAfter = (flag: string) => {
    const index = argv.indexOf(flag)
    return index >= 0 ? argv[index + 1] : undefined
  }
  return {
    peripheralId: valueAfter("--id"),
    scanSeconds: Number(valueAfter("--scan-seconds") ?? 15),
    listOnly: argv.includes("--list"),
    showRaw: argv.includes("--raw"),
    requestRecords: argv.includes("--records"),
  }
}

const toHex = (data: Uint8Array) =>
  Buffer.from(data).toString("hex").match(/../g)?.join(" ") ?? ""
const timestamp = () => new Date().toLocaleTimeString("fr-FR")

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeoutMs)
    ),
  ])
}

async function waitForBluetooth(): Promise<void> {
  try {
    await noble.waitForPoweredOnAsync(10000)
  } catch {
    const state = (noble as unknown as {state?: string}).state
    if (state === "unauthorized") {
      throw new Error(
        "Bluetooth access denied. Allow your terminal (or VS Code) in System Settings > Privacy & Security > Bluetooth, then restart it."
      )
    }
    throw new Error(
      `Bluetooth is not available (state: ${state ?? "unknown"}). Is it turned on?`
    )
  }
}

async function scanForPad(
  options: ProbeOptions
): Promise<Peripheral | undefined> {
  console.log(`Scanning for ${options.scanSeconds}s...`)
  const seen = new Set<string>()
  let found: Peripheral | undefined

  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      noble.removeListener("discover", onDiscover)
      resolve()
    }
    const timer = setTimeout(finish, options.scanSeconds * 1000)

    const onDiscover = (peripheral: Peripheral) => {
      if (seen.has(peripheral.id)) return
      seen.add(peripheral.id)

      const {localName, serviceUuids = []} = peripheral.advertisement
      const isCandidate = looksLikeWalkingPad(localName, serviceUuids)
      if (localName || isCandidate || options.listOnly) {
        const marker = isCandidate ? "★" : " "
        console.log(
          `  ${marker} ${peripheral.id}  ${localName ?? "(no name)"}  rssi=${peripheral.rssi}  services=[${serviceUuids.map(normalizeUuid).join(", ")}]`
        )
      }

      const matchesRequestedId = options.peripheralId === peripheral.id
      if (
        !options.listOnly &&
        (matchesRequestedId || (!options.peripheralId && isCandidate))
      ) {
        found = peripheral
        finish()
      }
    }
    noble.on("discover", onDiscover)
    noble.startScanningAsync([], false).catch((error) => {
      console.error("Unable to start scanning:", error)
      finish()
    })
  })

  await noble.stopScanningAsync()
  return found
}

async function printGattTree(peripheral: Peripheral): Promise<string[]> {
  const {services} =
    await peripheral.discoverAllServicesAndCharacteristicsAsync()
  console.log("\nGATT services:")
  for (const service of services) {
    console.log(
      `  [service] ${normalizeUuid(service.uuid)}${service.name ? ` (${service.name})` : ""}`
    )
    for (const characteristic of service.characteristics ?? []) {
      let value = ""
      // Device Information values help identify the model and firmware.
      if (
        normalizeUuid(service.uuid) === "180a" &&
        characteristic.properties.includes("read")
      ) {
        try {
          value = ` = "${(await characteristic.readAsync()).toString("utf8").replace(/\0/g, "")}"`
        } catch {
          value = " = (read failed)"
        }
      }
      console.log(
        `      ${normalizeUuid(characteristic.uuid)}  [${characteristic.properties.join(", ")}]${characteristic.name ? ` ${characteristic.name}` : ""}${value}`
      )
    }
  }
  return services.map((service) => service.uuid)
}

function findCharacteristic(
  peripheral: Peripheral,
  uuid: string
): Characteristic | undefined {
  return peripheral.services
    .flatMap((service) => service.characteristics ?? [])
    .find((characteristic) => normalizeUuid(characteristic.uuid) === uuid)
}

function formatStatus(status: PadStatus): string {
  const minutes = Math.floor(status.elapsedSeconds / 60)
  const seconds = String(status.elapsedSeconds % 60).padStart(2, "0")
  return [
    `belt=${status.beltState}(${status.rawBeltState})`,
    `mode=${status.mode}`,
    `speed=${status.speedKmh.toFixed(1)} km/h`,
    `time=${minutes}:${seconds}`,
    `dist=${(status.distanceMeters / 1000).toFixed(2)} km`,
    `steps=${status.steps}`,
  ].join("  ")
}

async function streamPh4Statuses(
  peripheral: Peripheral,
  protocol: PadProtocol,
  options: ProbeOptions
) {
  const notifyCharacteristic = findCharacteristic(
    peripheral,
    protocol.notifyCharacteristicUuid
  )
  const writeCharacteristic = findCharacteristic(
    peripheral,
    protocol.writeCharacteristicUuid
  )
  if (!notifyCharacteristic || !writeCharacteristic) {
    throw new Error(
      `Characteristics ${protocol.notifyCharacteristicUuid}/${protocol.writeCharacteristicUuid} not found`
    )
  }

  notifyCharacteristic.on("data", (data: Buffer) => {
    const notification = protocol.decodeNotification(data)
    const raw = options.showRaw ? `  <${toHex(data)}>` : ""
    if (notification.type === "status")
      console.log(`${timestamp()}  ${formatStatus(notification.status)}${raw}`)
    else if (notification.type === "lastRecord")
      console.log(
        `${timestamp()}  last record: ${JSON.stringify(notification.record)}${raw}`
      )
    else if (options.showRaw) console.log(`${timestamp()}  unknown frame${raw}`)
  })
  await notifyCharacteristic.subscribeAsync()

  const writeWithoutResponse = !writeCharacteristic.properties.includes("write")
  const statusRequest = Buffer.from(
    protocol.encodeCommand({type: "requestStatus"})
  )
  console.log(
    `\nProtocol ${protocol.id}: polling status every ${STATUS_POLL_INTERVAL_MS} ms. Ctrl+C to quit.\n`
  )
  const write = (frame: Uint8Array) =>
    writeCharacteristic
      .writeAsync(Buffer.from(frame), writeWithoutResponse)
      .catch((error) => console.error("Write failed:", error))
  const poll = () => write(statusRequest)
  if (options.requestRecords) {
    for (const mode of [0, 1] as const) {
      console.log(`${timestamp()}  requesting records (mode ${mode})`)
      await write(protocol.encodeCommand({type: "requestRecords", mode}))
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  await poll()
  return setInterval(poll, STATUS_POLL_INTERVAL_MS)
}

async function streamFtmsData(peripheral: Peripheral) {
  const treadmillData = findCharacteristic(peripheral, FTMS_TREADMILL_DATA_UUID)
  if (!treadmillData)
    throw new Error("FTMS treadmill data characteristic (2acd) not found")
  console.log(
    "\nFTMS only: dumping raw treadmill data frames (not decoded yet). Ctrl+C to quit.\n"
  )
  treadmillData.on("data", (data: Buffer) =>
    console.log(`${timestamp()}  ftms <${toHex(data)}>`)
  )
  await treadmillData.subscribeAsync()
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  await waitForBluetooth()

  const peripheral = await scanForPad(options)
  if (options.listOnly) return
  if (!peripheral) {
    throw new Error(
      "No WalkingPad found. Make sure it is powered on, close the KS Fit app (only one BLE connection is allowed), or pass --id from `npm run probe -- --list`."
    )
  }

  const name = peripheral.advertisement.localName ?? peripheral.id
  console.log(`\nConnecting to ${name}...`)
  try {
    await withTimeout(
      peripheral.connectAsync(),
      CONNECT_TIMEOUT_MS,
      "connection timed out"
    )
  } catch (error) {
    throw new Error(
      `Could not connect to ${name} (${(error as Error).message}). Is the KS Fit app connected to the pad? Close it on your phone and retry.`
    )
  }
  console.log("Connected.")

  let pollTimer: NodeJS.Timeout | undefined
  const shutdown = async (exitCode: number) => {
    clearInterval(pollTimer)
    await peripheral.disconnectAsync().catch(() => undefined)
    process.exit(exitCode)
  }
  process.on("SIGINT", () => void shutdown(0))
  peripheral.once("disconnect", () => {
    console.error(`\n${timestamp()}  Pad disconnected.`)
    void shutdown(1)
  })

  const serviceUuids = await printGattTree(peripheral)
  const detected = detectProtocol(serviceUuids)
  if (detected.kind === "supported")
    pollTimer = await streamPh4Statuses(peripheral, detected.protocol, options)
  else if (detected.kind === "ftms") await streamFtmsData(peripheral)
  else {
    console.error(
      `\nNo known protocol: neither fe00 (KingSmith) nor ${FTMS_SERVICE_UUID} (FTMS) is exposed.`
    )
    await shutdown(1)
  }
}

main().then(
  () => {
    if (parseOptions(process.argv.slice(2)).listOnly) process.exit(0)
  },
  (error) => {
    console.error(`\n✖ ${(error as Error).message}`)
    process.exit(1)
  }
)
