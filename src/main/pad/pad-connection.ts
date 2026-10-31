import {EventEmitter} from "node:events"
import noble, {type Characteristic, type Peripheral} from "@stoprocent/noble"
import {detectProtocol, looksLikeWalkingPad} from "./protocol/detect"
import type {PadConnectionFailure, PadConnectionState} from "../../shared/pad"
import type {
  PadCommand,
  PadProtocol,
  PadRecord,
  PadStatus,
} from "./protocol/types"
import {normalizeUuid} from "./protocol/uuid"

export type {PadConnectionFailure, PadConnectionState} from "../../shared/pad"

interface PadConnectionEvents {
  state: [PadConnectionState]
  status: [PadStatus]
  record: [PadRecord]
}

export interface PadConnectionOptions {
  preferredPeripheralId?: string
  pollIntervalMs?: number
  scanTimeoutMs?: number
  connectTimeoutMs?: number
}

interface PadLink {
  peripheral: Peripheral
  protocol: PadProtocol
  writeCharacteristic: Characteristic
  writeWithoutResponse: boolean
}

class PadConnectionError extends Error {
  constructor(readonly failure: PadConnectionFailure) {
    super(failure)
  }
}

const MIN_RETRY_DELAY_MS = 2000
const MAX_RETRY_DELAY_MS = 30000
const ADAPTER_STARTUP_GRACE_MS = 3000

const adapterState = () => (noble as unknown as {state: string}).state

export class PadConnection extends EventEmitter<PadConnectionEvents> {
  private state: PadConnectionState = {kind: "stopped"}
  private generation = 0
  private running = false
  private interruptWait: (() => void) | undefined
  private link: PadLink | undefined
  private pollTimer: NodeJS.Timeout | undefined
  private commandQueue: Promise<void> = Promise.resolve()
  private pendingCommands = 0
  private lastWriteAt = 0
  private readonly pollIntervalMs: number
  private readonly scanTimeoutMs: number
  private readonly connectTimeoutMs: number

  constructor(private readonly options: PadConnectionOptions = {}) {
    super()
    this.pollIntervalMs = options.pollIntervalMs ?? 1000
    this.scanTimeoutMs = options.scanTimeoutMs ?? 15000
    this.connectTimeoutMs = options.connectTimeoutMs ?? 15000
  }

  getState(): PadConnectionState {
    return this.state
  }

  setPreferredPeripheralId(peripheralId: string | undefined): void {
    this.options.preferredPeripheralId = peripheralId
  }

  start(): void {
    if (this.running) return
    this.running = true
    void this.runLoop(++this.generation)
  }

  async stop(): Promise<void> {
    this.running = false
    this.generation++
    this.interruptWait?.()
    await this.dropLink()
    await noble.stopScanningAsync().catch(() => undefined)
    this.setState({kind: "stopped"})
  }

  // Must be called before the process exits: the macOS binding of noble deadlocks when its
  // native resources are only released during Node's environment teardown.
  async release(): Promise<void> {
    await this.stop()
    noble.stop()
  }

  // Unlike status polling, user commands are never dropped: they wait for their turn.
  sendCommand(command: PadCommand): Promise<void> {
    if (!this.link) return Promise.reject(new Error("Pad is not connected"))
    return this.enqueue(command)
  }

  private isCurrent(generation: number): boolean {
    return this.running && generation === this.generation
  }

  private setState(state: PadConnectionState): void {
    this.state = state
    this.emit("state", state)
  }

  private async runLoop(generation: number): Promise<void> {
    let failedAttempts = 0
    while (this.isCurrent(generation)) {
      let failure: PadConnectionFailure
      try {
        await this.waitForAdapter(generation)
        const peripheral = await this.scan(generation)
        await this.connectAndServe(peripheral, generation)
        failedAttempts = 0
        failure = "disconnected"
      } catch (error) {
        failure =
          error instanceof PadConnectionError ? error.failure : "connectFailed"
        failedAttempts++
      }
      if (!this.isCurrent(generation)) break

      const delayMs = Math.min(
        MAX_RETRY_DELAY_MS,
        MIN_RETRY_DELAY_MS * 2 ** Math.min(failedAttempts, 4)
      )
      this.setState({kind: "retrying", failure, retryAt: Date.now() + delayMs})
      await this.interruptibleDelay(delayMs)
    }
  }

  private async waitForAdapter(generation: number): Promise<void> {
    // The adapter reports "unknown" for a moment while noble initializes.
    if (adapterState() === "unknown")
      await noble
        .waitForPoweredOnAsync(ADAPTER_STARTUP_GRACE_MS)
        .catch(() => undefined)
    while (adapterState() !== "poweredOn") {
      this.setState({
        kind: "bluetoothUnavailable",
        adapterState: adapterState(),
      })
      await noble.waitForPoweredOnAsync(10000).catch(() => undefined)
      if (!this.isCurrent(generation))
        throw new PadConnectionError("disconnected")
    }
  }

  private scan(generation: number): Promise<Peripheral> {
    this.setState({kind: "scanning"})
    const {preferredPeripheralId} = this.options

    return new Promise<Peripheral>((resolve, reject) => {
      const finish = (peripheral?: Peripheral) => {
        clearTimeout(timer)
        noble.removeListener("discover", onDiscover)
        this.interruptWait = undefined
        void noble.stopScanningAsync().catch(() => undefined)
        if (peripheral && this.isCurrent(generation)) resolve(peripheral)
        else reject(new PadConnectionError("padNotFound"))
      }
      const onDiscover = (peripheral: Peripheral) => {
        const {localName, serviceUuids = []} = peripheral.advertisement
        const matches = preferredPeripheralId
          ? peripheral.id === preferredPeripheralId
          : looksLikeWalkingPad(localName, serviceUuids)
        if (matches) finish(peripheral)
      }
      const timer = setTimeout(() => finish(), this.scanTimeoutMs)
      this.interruptWait = () => finish()
      noble.on("discover", onDiscover)
      noble.startScanningAsync([], false).catch(() => finish())
    })
  }

  private async connectAndServe(
    peripheral: Peripheral,
    generation: number
  ): Promise<void> {
    const padName = peripheral.advertisement.localName || peripheral.id
    this.setState({kind: "connecting", padName})

    try {
      await withTimeout(peripheral.connectAsync(), this.connectTimeoutMs)
    } catch {
      await peripheral.disconnectAsync().catch(() => undefined)
      throw new PadConnectionError("connectFailed")
    }

    const disconnected = new Promise<void>((resolve) =>
      peripheral.once("disconnect", () => resolve())
    )
    let notifyCharacteristic: Characteristic | undefined
    const onNotification = (data: Buffer) => {
      const notification = this.link?.protocol.decodeNotification(data)
      if (notification?.type === "status")
        this.emit("status", notification.status)
      else if (notification?.type === "lastRecord")
        this.emit("record", notification.record)
    }
    try {
      const {services, characteristics} =
        await peripheral.discoverAllServicesAndCharacteristicsAsync()
      const detected = detectProtocol(services.map((service) => service.uuid))
      if (detected.kind !== "supported")
        throw new PadConnectionError("unsupportedProtocol")

      const {protocol} = detected
      const findCharacteristic = (uuid: string) =>
        characteristics.find(
          (characteristic) => normalizeUuid(characteristic.uuid) === uuid
        )
      notifyCharacteristic = findCharacteristic(
        protocol.notifyCharacteristicUuid
      )
      const writeCharacteristic = findCharacteristic(
        protocol.writeCharacteristicUuid
      )
      if (!notifyCharacteristic || !writeCharacteristic)
        throw new PadConnectionError("unsupportedProtocol")

      this.link = {
        peripheral,
        protocol,
        writeCharacteristic,
        writeWithoutResponse: !writeCharacteristic.properties.includes("write"),
      }
      notifyCharacteristic.on("data", onNotification)
      await notifyCharacteristic.subscribeAsync()
      if (!this.isCurrent(generation)) return

      this.options.preferredPeripheralId = peripheral.id
      this.setState({
        kind: "connected",
        padName,
        peripheralId: peripheral.id,
        protocolId: protocol.id,
      })
      this.startPolling()

      await new Promise<void>((resolve) => {
        this.interruptWait = resolve
        void disconnected.then(resolve)
      })
    } catch (error) {
      if (error instanceof PadConnectionError) throw error
      throw new PadConnectionError("connectFailed")
    } finally {
      this.interruptWait = undefined
      notifyCharacteristic?.removeListener("data", onNotification)
      await this.dropLink(peripheral)
    }
  }

  private startPolling(): void {
    clearInterval(this.pollTimer)
    const poll = () => {
      if (this.pendingCommands > 0) return
      this.enqueue({type: "requestStatus"}).catch(() => undefined)
    }
    poll()
    this.pollTimer = setInterval(poll, this.pollIntervalMs)
  }

  private enqueue(command: PadCommand): Promise<void> {
    this.pendingCommands++
    const write = async () => {
      const link = this.link
      if (!link) throw new Error("Pad is not connected")
      const waitMs =
        this.lastWriteAt + link.protocol.minCommandIntervalMs - Date.now()
      if (waitMs > 0) await delay(waitMs)
      const frame = Buffer.from(link.protocol.encodeCommand(command))
      await link.writeCharacteristic.writeAsync(
        frame,
        link.writeWithoutResponse
      )
      this.lastWriteAt = Date.now()
    }
    const result = this.commandQueue.then(write)
    this.commandQueue = result.catch(() => undefined)
    return result.finally(() => this.pendingCommands--)
  }

  private async dropLink(peripheral = this.link?.peripheral): Promise<void> {
    clearInterval(this.pollTimer)
    this.pollTimer = undefined
    this.link = undefined
    if (peripheral && peripheral.state === "connected") {
      await peripheral.disconnectAsync().catch(() => undefined)
    }
  }

  private interruptibleDelay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, ms)
      function done() {
        clearTimeout(timer)
        resolve()
      }
      this.interruptWait = done
    })
  }
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}
