import { createContext, useContext } from "react"
import type {
  AvailabilityAdapter,
  AvailabilityPollDetail,
  AvailabilitySnapshot,
} from "./types"

export interface AvailabilityDataContextValue {
  adapter: AvailabilityAdapter
  snapshot: AvailabilitySnapshot
  pollBySlug(slug?: string): AvailabilityPollDetail | undefined
}

export const AvailabilityDataContext = createContext<AvailabilityDataContextValue | null>(null)

export function useAvailabilityData() {
  const value = useContext(AvailabilityDataContext)
  if (!value) throw new Error("useAvailabilityData must be used inside AvailabilityDataProvider.")
  return value
}
