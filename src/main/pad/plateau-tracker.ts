import type {PadStatus, Plateau} from "../../shared/pad"

// A speed held this long is a walking speed, not a step of a speed change, a start or a stop.
const STEADY_SPEED_HOLD_MS = 3000

// Strava never shows the pauses, the starts or the stops, so only walking at the plateau speed
// counts: the plateau freezes during them and carries on afterwards.
export class PlateauTracker {
  private plateau: Plateau | null = null
  private newSpeed: {speedKmh: number; since: number} | null = null

  get current(): Plateau | null {
    return this.plateau && {...this.plateau}
  }

  update(status: PadStatus, now: number): void {
    const isRunning = status.beltState === "running" && status.speedKmh > 0
    if (isRunning && status.speedKmh === this.plateau?.speedKmh) {
      this.plateau.walkingSince ??= now
      this.newSpeed = null
      return
    }
    this.freeze(now)
    if (!isRunning) {
      this.newSpeed = null
    } else if (this.newSpeed?.speedKmh !== status.speedKmh) {
      this.newSpeed = {speedKmh: status.speedKmh, since: now}
    } else if (now - this.newSpeed.since >= STEADY_SPEED_HOLD_MS) {
      this.plateau = {
        speedKmh: status.speedKmh,
        walkedMs: now - this.newSpeed.since,
        walkingSince: now,
      }
      this.newSpeed = null
    }
  }

  reset(): void {
    this.plateau = null
    this.newSpeed = null
  }

  private freeze(now: number): void {
    if (this.plateau?.walkingSince == null) return
    this.plateau.walkedMs += now - this.plateau.walkingSince
    this.plateau.walkingSince = null
  }
}
