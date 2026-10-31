import {ph4Protocol} from "./ph4"
import type {PadProtocol} from "./types"
import {normalizeUuid} from "./uuid"

export const FTMS_SERVICE_UUID = "1826"

export type DetectedProtocol =
  {kind: "supported"; protocol: PadProtocol} | {kind: "ftms"} | {kind: "none"}

const SUPPORTED_PROTOCOLS: PadProtocol[] = [ph4Protocol]

export function detectProtocol(serviceUuids: string[]): DetectedProtocol {
  const services = new Set(serviceUuids.map(normalizeUuid))
  const protocol = SUPPORTED_PROTOCOLS.find((candidate) =>
    services.has(candidate.serviceUuid)
  )
  if (protocol) return {kind: "supported", protocol}
  if (services.has(FTMS_SERVICE_UUID)) return {kind: "ftms"}
  return {kind: "none"}
}

const PAD_NAME_PATTERN = /walkingpad|^ks[-_ ]/i

export function looksLikeWalkingPad(
  name: string | undefined,
  advertisedServiceUuids: string[]
): boolean {
  if (name && PAD_NAME_PATTERN.test(name)) return true
  return detectProtocol(advertisedServiceUuids).kind !== "none"
}
