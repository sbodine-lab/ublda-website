import type {
  AvailabilityAdapter,
  AvailabilitySnapshot,
  CreateAvailabilityPollInput,
} from "./types"

type AvailabilityOperations = Pick<
  AvailabilityAdapter,
  "createPoll" | "saveResponse" | "finalizePoll"
>

export interface MutableLiveAvailabilityAdapter extends AvailabilityAdapter {
  replaceSnapshot(snapshot: AvailabilitySnapshot): void
  replaceOperations(operations: AvailabilityOperations): void
}

const unavailable = async (): Promise<never> => {
  throw new Error("Scheduling is not ready yet.")
}

export function createLiveAvailabilityAdapter(): MutableLiveAvailabilityAdapter {
  let snapshot: AvailabilitySnapshot = { polls: [], loading: true }
  let operations: AvailabilityOperations = {
    createPoll: unavailable,
    saveResponse: unavailable,
    finalizePoll: unavailable,
  }
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  return {
    mode: "live",
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    replaceSnapshot(next) {
      snapshot = next
      emit()
    },
    replaceOperations(next) {
      operations = next
    },
    createPoll(input: CreateAvailabilityPollInput) {
      return operations.createPoll(input)
    },
    saveResponse(pollId, slotKeys) {
      return operations.saveResponse(pollId, slotKeys)
    },
    finalizePoll(pollId, dateKey, startMinutes) {
      return operations.finalizePoll(pollId, dateKey, startMinutes)
    },
  }
}

export function createUnavailableAvailabilityAdapter(message: string): AvailabilityAdapter {
  const snapshot: AvailabilitySnapshot = { polls: [], loading: false, error: message }
  const fail = async (): Promise<never> => { throw new Error(message) }
  return {
    mode: "live",
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    createPoll: fail,
    saveResponse: fail,
    finalizePoll: fail,
  }
}
