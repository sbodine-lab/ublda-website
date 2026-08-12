/**
 * Convex only needs Logto's initial session-resolution state. Logto also flips
 * `isLoading` while reading or refreshing tokens after authentication; passing
 * that transient state to Convex tears down and restarts Convex auth, creating
 * an endless token-exchange loop.
 */
export const logtoIsLoadingForConvex = (
  isLoading: boolean,
  isAuthenticated: boolean,
  initialSessionResolved = false,
) => isLoading && !isAuthenticated && !initialSessionResolved

export const logtoInitialSessionHasResolved = (
  initialSessionResolved: boolean,
  isLoading: boolean,
  isAuthenticated: boolean,
) => initialSessionResolved || isAuthenticated || !isLoading

export const LEADERSHIP_AUTH_REQUEST_TIMEOUT_MS = 10_000

export const leadershipOperationTimedOut = (
  startedAt: number | null,
  now: number,
  timeoutMs = LEADERSHIP_AUTH_REQUEST_TIMEOUT_MS,
) => startedAt !== null && now - startedAt >= timeoutMs

export class LeadershipRequestTimeoutError extends Error {
  constructor() {
    super('The secure session request timed out. Check your connection and try again.')
    this.name = 'LeadershipRequestTimeoutError'
  }
}

/**
 * Settle even when a mocked or broken requester ignores AbortSignal. The
 * controller still cancels a real fetch so it cannot consume resources after
 * the caller has moved on.
 */
export async function withLeadershipRequestTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs = LEADERSHIP_AUTH_REQUEST_TIMEOUT_MS,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()

  const abortFromParent = () => controller.abort(parentSignal?.reason)
  if (parentSignal?.aborted) abortFromParent()
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true })

  const aborted = new Promise<never>((_resolve, reject) => {
    const rejectForAbort = () => {
      const reason = controller.signal.reason
      reject(reason instanceof Error ? reason : new Error('The secure session request was cancelled.'))
    }
    if (controller.signal.aborted) rejectForAbort()
    else controller.signal.addEventListener('abort', rejectForAbort, { once: true })
  })

  const timeout = setTimeout(() => controller.abort(new LeadershipRequestTimeoutError()), timeoutMs)
  try {
    return await Promise.race([request(controller.signal), aborted])
  } finally {
    clearTimeout(timeout)
    parentSignal?.removeEventListener('abort', abortFromParent)
  }
}

const decodeBase64UrlJson = (value: string): unknown => {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = globalThis.atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

/**
 * This key is used only to isolate in-memory work. The bridge still performs
 * all trust decisions. Falling back to the opaque token keeps malformed tokens
 * separated without treating unverified browser claims as authorization.
 */
export function logtoSessionKeyFromIdToken(idToken: string): string {
  try {
    const payload = decodeBase64UrlJson(idToken.split('.')[1] ?? '')
    if (payload && typeof payload === 'object' && 'sub' in payload && typeof payload.sub === 'string' && payload.sub) {
      const issuer = 'iss' in payload && typeof payload.iss === 'string' && payload.iss ? payload.iss : null
      if (issuer) return `identity:${JSON.stringify([issuer, payload.sub])}`
    }
  } catch {
    // The server will reject malformed tokens. Keep them isolated in memory.
  }
  return `token:${idToken}`
}

export type LeadershipTokenExchangeResult = {
  ok: boolean
  status: number
  token?: unknown
  error?: unknown
}

type TokenCoordinatorDependencies = {
  getIdToken: () => Promise<string | null | undefined>
  refreshLogtoSession: () => Promise<boolean>
  exchange: (idToken: string, signal: AbortSignal) => Promise<LeadershipTokenExchangeResult>
  timeoutMs?: number
  reportError?: (error: unknown) => void
}

type ObservedSession = {
  generation: number
  key: string
}

type TokenFlight = {
  controller: AbortController
  generation: number
  promise: Promise<string | null>
}

export type LogtoConvexTokenCoordinator = {
  fetchAccessToken: (options: { forceRefreshToken: boolean }) => Promise<string | null>
  invalidate: () => void
}

export type LeadershipMembershipResult =
  | { status: 'ready' }
  | { status: 'denied'; message: string }
  | { status: 'error'; message: string }

const convexErrorDetails = (caught: unknown): { code?: string; message?: string } => {
  if (caught && typeof caught === 'object' && 'data' in caught) {
    const data = (caught as { data?: unknown }).data
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>
      return {
        code: typeof record.code === 'string' ? record.code : undefined,
        message: typeof record.message === 'string' ? record.message : undefined,
      }
    }
  }
  if (caught instanceof Error) {
    const encoded = caught.message.match(/\{"code":"([^"]+)","message":"((?:\\.|[^"])*)"\}/)
    if (encoded) {
      try {
        return { code: encoded[1], message: JSON.parse(`"${encoded[2]}"`) as string }
      } catch {
        return { code: encoded[1] }
      }
    }
  }
  return {}
}

/**
 * Resolve roster membership without converting network outages into access
 * denials or leaving a signed-in browser in an endless loading state.
 */
export async function resolveLeadershipMembership({
  claim,
  bootstrap,
  timeoutMs = LEADERSHIP_AUTH_REQUEST_TIMEOUT_MS,
}: {
  claim: () => Promise<unknown>
  bootstrap: () => Promise<unknown>
  timeoutMs?: number
}): Promise<LeadershipMembershipResult> {
  try {
    await withLeadershipRequestTimeout(() => claim(), timeoutMs)
    return { status: 'ready' }
  } catch (caught) {
    const details = convexErrorDetails(caught)
    if (details.code === 'FORBIDDEN') {
      return { status: 'denied', message: details.message || 'This member account is inactive.' }
    }
    if (details.code !== 'IDENTITY_NOT_APPROVED') {
      return {
        status: 'error',
        message: caught instanceof LeadershipRequestTimeoutError
          ? caught.message
          : 'Leadership membership could not be verified. Try again.',
      }
    }
  }

  try {
    await withLeadershipRequestTimeout(() => bootstrap(), timeoutMs)
    return { status: 'ready' }
  } catch (caught) {
    const details = convexErrorDetails(caught)
    if (details.code === 'FORBIDDEN' || details.code === 'IDENTITY_NOT_APPROVED') {
      return {
        status: 'denied',
        message: 'Use an email that an administrator has added to your roster profile, or ask an administrator to approve this account.',
      }
    }
    return {
      status: 'error',
      message: caught instanceof LeadershipRequestTimeoutError
        ? caught.message
        : 'Leadership membership could not be verified. Try again.',
    }
  }
}

/**
 * Coordinates Convex token requests without sharing work across Logto users.
 * A forced refresh can never join a weaker regular request, and results from a
 * previous subject/session generation are discarded.
 */
export function createLogtoConvexTokenCoordinator({
  getIdToken,
  refreshLogtoSession,
  exchange,
  timeoutMs = LEADERSHIP_AUTH_REQUEST_TIMEOUT_MS,
  reportError = () => undefined,
}: TokenCoordinatorDependencies): LogtoConvexTokenCoordinator {
  let currentSessionKey: string | null = null
  let generation = 0
  let requestSequence = 0
  let latestObservedRequest = 0
  const regularFlights = new Map<string, TokenFlight>()
  const forcedFlights = new Map<string, TokenFlight>()

  const abortRegularFlightsExcept = (keep?: AbortController) => {
    for (const flight of regularFlights.values()) {
      if (flight.controller !== keep) flight.controller.abort(new Error('The signed-in account changed.'))
    }
    for (const [key, flight] of regularFlights) {
      if (flight.controller !== keep) regularFlights.delete(key)
    }
  }

  const abortForcedFlightsExcept = (keep?: AbortController) => {
    for (const flight of forcedFlights.values()) {
      if (flight.controller !== keep) flight.controller.abort(new Error('The signed-in account changed.'))
    }
    for (const [key, flight] of forcedFlights) {
      if (flight.controller !== keep) forcedFlights.delete(key)
    }
  }

  const abortFlightsExcept = (keep?: AbortController) => {
    abortRegularFlightsExcept(keep)
    abortForcedFlightsExcept(keep)
  }

  const observe = (idToken: string, requestId: number, controller?: AbortController): ObservedSession | null => {
    const key = logtoSessionKeyFromIdToken(idToken)
    if (requestId < latestObservedRequest && currentSessionKey !== key) return null
    latestObservedRequest = Math.max(latestObservedRequest, requestId)
    if (currentSessionKey !== null && currentSessionKey !== key) {
      generation += 1
      abortFlightsExcept(controller)
    }
    currentSessionKey = key
    return { generation, key }
  }

  const stillCurrent = ({ generation: observedGeneration, key }: ObservedSession) => (
    generation === observedGeneration && currentSessionKey === key
  )

  const exchangeToken = async (
    idToken: string,
    observed: ObservedSession,
    controller: AbortController,
  ) => {
    const result = await withLeadershipRequestTimeout(
      (signal) => exchange(idToken, signal),
      timeoutMs,
      controller.signal,
    )
    if (!stillCurrent(observed)) return null
    if (!result.ok || typeof result.token !== 'string') {
      const message = typeof result.error === 'string'
        ? result.error
        : 'The leadership sign-in session could not be verified.'
      return { error: new Error(message), status: result.status, token: null }
    }
    return { status: result.status, token: result.token }
  }

  const fetchRegular = async () => {
    const requestId = ++requestSequence
    const idToken = await withLeadershipRequestTimeout(
      () => getIdToken(),
      timeoutMs,
    )
    if (!idToken) return null
    const observed = observe(idToken, requestId)
    if (!observed) return null

    const existing = regularFlights.get(observed.key)
    if (existing && existing.generation === observed.generation) return await existing.promise
    const forced = forcedFlights.get(observed.key)
    if (forced && forced.generation === observed.generation) return await forced.promise

    const controller = new AbortController()
    const pending = (async () => {
      let result = await exchangeToken(idToken, observed, controller)
      if (result && 'error' in result && result.status === 401) {
        const refreshed = await withLeadershipRequestTimeout(
          () => refreshLogtoSession(),
          timeoutMs,
          controller.signal,
        )
        if (!refreshed || controller.signal.aborted) return null
        const refreshedIdToken = await withLeadershipRequestTimeout(
          () => getIdToken(),
          timeoutMs,
          controller.signal,
        )
        if (!refreshedIdToken) return null
        const refreshedSession = observe(refreshedIdToken, requestId, controller)
        if (!refreshedSession) return null
        result = await exchangeToken(refreshedIdToken, refreshedSession, controller)
      }
      if (!result) return null
      if ('error' in result) throw result.error
      return result.token
    })().catch((error) => {
      if (!controller.signal.aborted) reportError(error)
      return null
    }).finally(() => {
      if (regularFlights.get(observed.key)?.promise === pending) regularFlights.delete(observed.key)
    })

    regularFlights.set(observed.key, { controller, generation: observed.generation, promise: pending })
    return await pending
  }

  const fetchForced = async () => {
    const requestId = ++requestSequence
    // Observe the current account before refreshing. Shared forced work must be
    // keyed to one OIDC identity; a global promise could otherwise return
    // account A's Convex token after the browser has switched to account B.
    const currentIdToken = await withLeadershipRequestTimeout(
      () => getIdToken(),
      timeoutMs,
    )
    if (!currentIdToken) return null
    const initialSession = observe(currentIdToken, requestId)
    if (!initialSession) return null

    const existing = forcedFlights.get(initialSession.key)
    if (existing && existing.generation === initialSession.generation) return await existing.promise

    const controller = new AbortController()
    abortRegularFlightsExcept()
    const pending = (async () => {
      // Convex's forced refresh asks for a new short-lived Convex JWT, not an
      // unconditional Logto refresh-token rotation. Exchange the current ID
      // token first; only a verified 401 justifies touching the provider
      // session, which also avoids multi-tab refresh-token races.
      let result = await exchangeToken(currentIdToken, initialSession, controller)
      if (result && 'error' in result && result.status === 401) {
        const refreshed = await withLeadershipRequestTimeout(
          () => refreshLogtoSession(),
          timeoutMs,
          controller.signal,
        )
        if (!refreshed || controller.signal.aborted) return null
        const idToken = await withLeadershipRequestTimeout(
          () => getIdToken(),
          timeoutMs,
          controller.signal,
        )
        if (!idToken) return null
        const observed = observe(idToken, requestId, controller)
        if (!observed) return null
        if (
          observed.key !== initialSession.key
          || observed.generation !== initialSession.generation
        ) return null
        result = await exchangeToken(idToken, observed, controller)
      }
      if (!result) return null
      if ('error' in result) throw result.error
      return result.token
    })().catch((error) => {
      if (!controller.signal.aborted) reportError(error)
      return null
    }).finally(() => {
      if (forcedFlights.get(initialSession.key)?.promise === pending) {
        forcedFlights.delete(initialSession.key)
      }
    })
    forcedFlights.set(initialSession.key, {
      controller,
      generation: initialSession.generation,
      promise: pending,
    })
    return await pending
  }

  return {
    async fetchAccessToken({ forceRefreshToken }) {
      try {
        if (forceRefreshToken) return await fetchForced()
        return await fetchRegular()
      } catch (error) {
        reportError(error)
        return null
      }
    },
    invalidate() {
      generation += 1
      currentSessionKey = null
      latestObservedRequest = ++requestSequence
      abortFlightsExcept()
    },
  }
}
