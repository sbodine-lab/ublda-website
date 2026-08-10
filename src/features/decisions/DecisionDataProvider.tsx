import {
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react"
import { demoDecisionAdapter } from "./demoAdapter"
import { DecisionDataContext, type DecisionDataContextValue } from "./decisionDataContext"
import type { DecisionCenterAdapter } from "./types"

export function DecisionDataProvider({
  adapter = demoDecisionAdapter,
  children,
}: PropsWithChildren<{ adapter?: DecisionCenterAdapter }>) {
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  )

  const value = useMemo<DecisionDataContextValue>(() => ({
    adapter,
    snapshot,
    decisionBySlug(slug) {
      return snapshot.decisions.find((decision) => decision.slug === slug)
    },
    responseFor(decisionId, memberId) {
      const resolvedMemberId = memberId ?? (snapshot.auth.status === "signed-in"
        ? snapshot.auth.viewer.memberId
        : undefined)
      if (!resolvedMemberId) return undefined
      return snapshot.responses.find(
        (response) => response.decisionId === decisionId && response.memberId === resolvedMemberId,
      )
    },
  }), [adapter, snapshot])

  return <DecisionDataContext.Provider value={value}>{children}</DecisionDataContext.Provider>
}
