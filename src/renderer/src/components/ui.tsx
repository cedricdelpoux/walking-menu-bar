import type {ButtonHTMLAttributes, ReactNode} from "react"
import {Check} from "lucide-react"
import {clsx, type ClassValue} from "clsx"
import {twMerge} from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function Card({
  title,
  aside,
  children,
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-black/5 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
      {(title || aside) && (
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-black/50 uppercase dark:text-white/50">
            {title}
          </h2>
          {aside}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({label, value}: {label: string; value: ReactNode}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] text-black/50 dark:text-white/50">
        {label}
      </div>
      <div className="truncate text-base font-semibold tabular-nums">
        {value}
      </div>
    </div>
  )
}

type ButtonVariant = "primary" | "danger" | "secondary" | "ghost"

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:brightness-105 active:brightness-95",
  danger: "bg-rose-500 text-white hover:brightness-105 active:brightness-95",
  secondary:
    "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15",
  ghost: "hover:bg-black/5 dark:hover:bg-white/10",
}

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: ButtonVariant}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
        "disabled:pointer-events-none disabled:opacity-40",
        BUTTON_VARIANTS[variant],
        className
      )}
      {...props}
    />
  )
}

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {label: string}) {
  return (
    <Button
      variant="ghost"
      aria-label={label}
      title={label}
      className={cn(
        "h-7 w-7 px-0 py-0 text-black/60 dark:text-white/60",
        className
      )}
      {...props}
    />
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{value: T; label: string}>
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        "flex rounded-lg bg-black/5 p-0.5 dark:bg-white/10",
        disabled && "opacity-40"
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1 text-xs font-medium transition",
            option.value === value
              ? "bg-white shadow-sm dark:bg-white/20"
              : "text-black/60 dark:text-white/60"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// The native macOS checkbox changes shape between its states, so the box is drawn by hand.
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer h-4 w-4 cursor-pointer appearance-none disabled:cursor-default disabled:opacity-40 rounded border border-black/25 bg-white transition checked:border-accent checked:bg-accent dark:border-white/30 dark:bg-white/10"
      />
      <Check
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
      />
    </span>
  )
}
