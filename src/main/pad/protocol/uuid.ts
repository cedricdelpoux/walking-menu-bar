const BLUETOOTH_BASE_UUID_SUFFIX = "00001000800000805f9b34fb"

export function normalizeUuid(uuid: string): string {
  const compact = uuid.replace(/-/g, "").toLowerCase()
  if (
    compact.length === 32 &&
    compact.startsWith("0000") &&
    compact.endsWith(BLUETOOTH_BASE_UUID_SUFFIX)
  ) {
    return compact.slice(4, 8)
  }
  return compact
}

export function uuidEquals(left: string, right: string): boolean {
  return normalizeUuid(left) === normalizeUuid(right)
}
