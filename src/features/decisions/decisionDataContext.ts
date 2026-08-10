import { createContext, useContext } from "react"
import type {
  DecisionCenterAdapter,
  DecisionCenterSnapshot,
  DecisionRecord,
  DecisionResponse,
} from "./types"

export interface DecisionDataContextValue {
  adapter: DecisionCenterAdapter
  snapshot: DecisionCenterSnapshot
  decisionBySlug(slug: string | undefined): DecisionRecord | undefined
  responseFor(decisionId: string, memberId?: string): DecisionResponse | undefined
}

export const DecisionDataContext = createContext<DecisionDataContextValue | null>(null)

export function useDecisionData() {
  const value = useContext(DecisionDataContext)
  if (!value) {
    throw new Error("useDecisionData must be used inside DecisionDataProvider.")
  }
  return value
}
