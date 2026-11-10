import {createFtmsProtocol, FTMS_SERVICE_UUID} from "./ftms"
import {PH4_SERVICE_UUID, ph4Protocol} from "./ph4"
import type {PadProfile, PadProtocol} from "./types"
import {normalizeUuid} from "./uuid"

// The KingSmith protocol comes first: it is the one tested, and it has the modes.
const SUPPORTED_PROTOCOLS: Array<{
  serviceUuid: string
  create: (profile: PadProfile) => PadProtocol
}> = [
  {serviceUuid: PH4_SERVICE_UUID, create: () => ph4Protocol},
  {serviceUuid: FTMS_SERVICE_UUID, create: createFtmsProtocol},
]

export function detectProtocol(
  serviceUuids: string[],
  profile: PadProfile
): PadProtocol | null {
  const services = new Set(serviceUuids.map(normalizeUuid))
  const supported = SUPPORTED_PROTOCOLS.find(({serviceUuid}) =>
    services.has(serviceUuid)
  )
  return supported?.create(profile) ?? null
}

// ZP-ZEALR1 is a MC-21 sold under another brand.
const PAD_NAME_PATTERN = /walkingpad|^ks[-_ ]|^zp-zealr1/i

// Bikes and rowers advertise FTMS too, so only the KingSmith service is enough without the name.
export function looksLikeWalkingPad(
  name: string | undefined,
  advertisedServiceUuids: string[]
): boolean {
  if (name && PAD_NAME_PATTERN.test(name)) return true
  return advertisedServiceUuids.map(normalizeUuid).includes(PH4_SERVICE_UUID)
}
