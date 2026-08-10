import type {
  DecisionCenterAdapter,
  DecisionCenterSnapshot,
} from "./types"

type LiveOperations = Pick<
  DecisionCenterAdapter,
  | "signInWithGoogle"
  | "signIn"
  | "verifySignInCode"
  | "signOut"
  | "submitResponse"
  | "createDecision"
  | "closeDecision"
  | "reopenDecision"
  | "finalizeDecision"
  | "upsertMember"
  | "createAgentKey"
  | "revokeAgentKey"
>

export interface MutableLiveDecisionAdapter extends DecisionCenterAdapter {
  replaceSnapshot(snapshot: DecisionCenterSnapshot): void
  replaceOperations(operations: LiveOperations): void
}

const initialSnapshot: DecisionCenterSnapshot = {
  auth: { status: "loading" },
  decisions: [],
  members: [],
  responses: [],
  activity: [],
  agentKeys: [],
}

function notReady(): Promise<never> {
  return Promise.reject(new Error("The Decision Center is still loading."))
}

const unavailableOperations: LiveOperations = {
  signInWithGoogle: notReady,
  signIn: notReady,
  verifySignInCode: notReady,
  signOut: notReady,
  submitResponse: notReady,
  createDecision: notReady,
  closeDecision: notReady,
  reopenDecision: notReady,
  finalizeDecision: notReady,
  upsertMember: notReady,
  createAgentKey: notReady,
  revokeAgentKey: notReady,
}

export function createLiveDecisionAdapter(): MutableLiveDecisionAdapter {
  let snapshot = initialSnapshot
  let operations = unavailableOperations
  const listeners = new Set<() => void>()

  return {
    mode: "live",
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
    replaceSnapshot(nextSnapshot) {
      snapshot = nextSnapshot
      listeners.forEach((listener) => listener())
    },
    replaceOperations(nextOperations) {
      operations = nextOperations
    },
    signInWithGoogle: (...args) => operations.signInWithGoogle(...args),
    signIn: (...args) => operations.signIn(...args),
    verifySignInCode: (...args) => operations.verifySignInCode(...args),
    signOut: (...args) => operations.signOut(...args),
    submitResponse: (...args) => operations.submitResponse(...args),
    createDecision: (...args) => operations.createDecision(...args),
    closeDecision: (...args) => operations.closeDecision(...args),
    reopenDecision: (...args) => operations.reopenDecision(...args),
    finalizeDecision: (...args) => operations.finalizeDecision(...args),
    upsertMember: (...args) => operations.upsertMember(...args),
    createAgentKey: (...args) => operations.createAgentKey(...args),
    revokeAgentKey: (...args) => operations.revokeAgentKey(...args),
  }
}
