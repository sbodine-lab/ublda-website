import { useMemo, useSyncExternalStore, type PropsWithChildren } from "react"
import { AvailabilityDataContext } from "./availabilityDataContext"
import { demoAvailabilityAdapter } from "./demoAdapter"
import type { AvailabilityAdapter } from "./types"

export function AvailabilityDataProvider({
  adapter = demoAvailabilityAdapter,
  children,
}: PropsWithChildren<{ adapter?: AvailabilityAdapter }>) {
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  )
  const value = useMemo(() => ({
    adapter,
    snapshot,
    pollBySlug(slug?: string) {
      if (!slug || snapshot.activePoll?.slug === slug) return snapshot.activePoll
      return undefined
    },
  }), [adapter, snapshot])
  return <AvailabilityDataContext.Provider value={value}>{children}</AvailabilityDataContext.Provider>
}
