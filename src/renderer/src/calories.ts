import {createContext, useContext} from "react"
import {estimateCalories} from "@shared/calories"
import type {SessionTotals} from "@shared/session"

export const WeightContext = createContext<number | null>(null)

export function useCalories(
  totals: Pick<SessionTotals, "durationSeconds" | "distanceMeters">
): number | null {
  const weightKg = useContext(WeightContext)
  return weightKg === null ? null : estimateCalories(totals, weightKg)
}
