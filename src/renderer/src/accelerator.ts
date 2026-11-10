const MODIFIERS = [
  ["ctrlKey", "Control"],
  ["altKey", "Alt"],
  ["shiftKey", "Shift"],
  ["metaKey", "Command"],
] as const

const SYMBOLS: Record<string, string> = {
  Control: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Command: "⌘",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
}

function toAcceleratorKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^F\d{1,2}$/.test(code) || code === "Space") return code
  if (code.startsWith("Arrow")) return code.slice(5)
  return null
}

// A global shortcut needs a modifier, or it would take the key away from every app.
export function toAccelerator(event: KeyboardEvent): string | null {
  const key = toAcceleratorKey(event.code)
  const modifiers = MODIFIERS.filter(([flag]) => event[flag]).map(
    ([, name]) => name
  )
  if (!key || modifiers.length === 0) return null
  return [...modifiers, key].join("+")
}

export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split("+")
    .map((part) => SYMBOLS[part] ?? part)
    .join("")
}
