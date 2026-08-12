import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LeadershipRequestTimeoutError,
  createLogtoConvexTokenCoordinator,
  leadershipOperationTimedOut,
  logtoInitialSessionHasResolved,
  logtoIsLoadingForConvex,
  logtoSessionKeyFromIdToken,
  resolveLeadershipMembership,
  withLeadershipRequestTimeout,
  type LeadershipTokenExchangeResult,
} from '../src/features/decisions/logtoConvexAuth.ts'

const idToken = (issuer: string, subject: string) => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ iss: issuer, sub: subject })}.signature`
}

const success = (token: string): LeadershipTokenExchangeResult => ({
  ok: true,
  status: 200,
  token,
})

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve))

test('auth operation deadlines trigger only at the configured boundary', () => {
  assert.equal(leadershipOperationTimedOut(null, 10_000, 1_000), false)
  assert.equal(leadershipOperationTimedOut(9_001, 10_000, 1_000), false)
  assert.equal(leadershipOperationTimedOut(9_000, 10_000, 1_000), true)
})

test('reports loading while Logto resolves the initial signed-out session', () => {
  assert.equal(logtoIsLoadingForConvex(true, false), true)
})

test('does not restart Convex auth for authenticated Logto token operations', () => {
  assert.equal(logtoIsLoadingForConvex(true, true), false)
})

test('reports settled state after Logto finishes loading', () => {
  assert.equal(logtoIsLoadingForConvex(false, false), false)
  assert.equal(logtoIsLoadingForConvex(false, true), false)
})

test('does not re-enter initial loading for a later failed sign-in operation', () => {
  const resolved = logtoInitialSessionHasResolved(false, false, false)
  assert.equal(resolved, true)
  assert.equal(logtoInitialSessionHasResolved(resolved, true, false), true)
  assert.equal(logtoIsLoadingForConvex(true, false, resolved), false)
})

test('uses issuer and subject together to isolate Logto identities', () => {
  assert.notEqual(
    logtoSessionKeyFromIdToken(idToken('https://tenant-a.example/oidc', 'member')),
    logtoSessionKeyFromIdToken(idToken('https://tenant-b.example/oidc', 'member')),
  )
  assert.equal(
    logtoSessionKeyFromIdToken(idToken('https://tenant-a.example/oidc', 'member')),
    'identity:["https://tenant-a.example/oidc","member"]',
  )
  const withoutIssuer = idToken('', 'member')
  assert.equal(logtoSessionKeyFromIdToken(withoutIssuer), `token:${withoutIssuer}`)
})

test('settles with null when reading the browser ID token rejects', async () => {
  const reported: unknown[] = []
  const coordinator = createLogtoConvexTokenCoordinator({
    getIdToken: async () => { throw new Error('storage blocked') },
    refreshLogtoSession: async () => true,
    exchange: async () => success('unused'),
    reportError: (error) => reported.push(error),
  })

  assert.equal(await coordinator.fetchAccessToken({ forceRefreshToken: false }), null)
  assert.equal(reported.length, 1)
})

test('settles with null when reading the browser ID token hangs', async () => {
  const reported: unknown[] = []
  const coordinator = createLogtoConvexTokenCoordinator({
    getIdToken: async () => await new Promise<string>(() => undefined),
    refreshLogtoSession: async () => true,
    exchange: async () => success('unused'),
    timeoutMs: 5,
    reportError: (error) => reported.push(error),
  })

  assert.equal(await coordinator.fetchAccessToken({ forceRefreshToken: false }), null)
  assert.equal(reported.length, 1)
  assert.ok(reported[0] instanceof LeadershipRequestTimeoutError)
})

test('settles a request even when the requester ignores AbortSignal', async () => {
  await assert.rejects(
    withLeadershipRequestTimeout(() => new Promise<never>(() => undefined), 5),
    LeadershipRequestTimeoutError,
  )
})

test('membership resolution times out instead of loading forever', async () => {
  const result = await resolveLeadershipMembership({
    claim: async () => await new Promise(() => undefined),
    bootstrap: async () => undefined,
    timeoutMs: 5,
  })
  assert.equal(result.status, 'error')
  assert.match('message' in result ? result.message : '', /timed out/i)
})

test('membership resolution distinguishes invitations from outages', async () => {
  let bootstrapCalls = 0
  const pendingInvite = await resolveLeadershipMembership({
    claim: async () => { throw { data: { code: 'IDENTITY_NOT_APPROVED' } } },
    bootstrap: async () => {
      bootstrapCalls += 1
      throw { data: { code: 'FORBIDDEN' } }
    },
  })
  assert.equal(pendingInvite.status, 'denied')
  assert.equal(bootstrapCalls, 1)

  const outage = await resolveLeadershipMembership({
    claim: async () => { throw new Error('network unavailable') },
    bootstrap: async () => {
      bootstrapCalls += 1
    },
  })
  assert.equal(outage.status, 'error')
  assert.equal(bootstrapCalls, 1)
})

test('membership bootstrap also has a deadline', async () => {
  const result = await resolveLeadershipMembership({
    claim: async () => { throw { data: { code: 'IDENTITY_NOT_APPROVED' } } },
    bootstrap: async () => await new Promise(() => undefined),
    timeoutMs: 5,
  })
  assert.equal(result.status, 'error')
  assert.match('message' in result ? result.message : '', /timed out/i)
})

test('settles when a forced Logto refresh hangs', async () => {
  const reported: unknown[] = []
  const coordinator = createLogtoConvexTokenCoordinator({
    getIdToken: async () => idToken('https://tenant.example/oidc', 'member'),
    refreshLogtoSession: async () => await new Promise<boolean>(() => undefined),
    exchange: async () => ({ ok: false, status: 401 }),
    timeoutMs: 5,
    reportError: (error) => reported.push(error),
  })

  assert.equal(await coordinator.fetchAccessToken({ forceRefreshToken: true }), null)
  assert.equal(reported.length, 1)
  assert.ok(reported[0] instanceof LeadershipRequestTimeoutError)
})

test('a valid forced Convex refresh does not rotate the Logto session', async () => {
  let refreshCalls = 0
  const coordinator = createLogtoConvexTokenCoordinator({
    getIdToken: async () => idToken('https://tenant.example/oidc', 'member'),
    refreshLogtoSession: async () => {
      refreshCalls += 1
      return true
    },
    exchange: async () => success('fresh-convex-token'),
  })

  assert.equal(await coordinator.fetchAccessToken({ forceRefreshToken: true }), 'fresh-convex-token')
  assert.equal(refreshCalls, 0)
})

test('settles when a rejected bridge token triggers a hanging Logto refresh', async () => {
  const reported: unknown[] = []
  const coordinator = createLogtoConvexTokenCoordinator({
    getIdToken: async () => idToken('https://tenant.example/oidc', 'member'),
    refreshLogtoSession: async () => await new Promise<boolean>(() => undefined),
    exchange: async () => ({ ok: false, status: 401 }),
    timeoutMs: 5,
    reportError: (error) => reported.push(error),
  })

  assert.equal(await coordinator.fetchAccessToken({ forceRefreshToken: false }), null)
  assert.equal(reported.length, 1)
  assert.ok(reported[0] instanceof LeadershipRequestTimeoutError)
})

test('a forced refresh never joins a weaker regular exchange', async () => {
  const token = idToken('https://tenant.example/oidc', 'member')
  let exchangeCalls = 0
  let refreshCalls = 0
  const coordinator = createLogtoConvexTokenCoordinator({
    getIdToken: async () => token,
    refreshLogtoSession: async () => {
      refreshCalls += 1
      return true
    },
    exchange: async () => {
      exchangeCalls += 1
      if (exchangeCalls === 1) return await new Promise<LeadershipTokenExchangeResult>(() => undefined)
      return success('fresh-convex-token')
    },
    timeoutMs: 100,
  })

  const regular = coordinator.fetchAccessToken({ forceRefreshToken: false })
  await nextTurn()
  const forced = coordinator.fetchAccessToken({ forceRefreshToken: true })

  assert.equal(await forced, 'fresh-convex-token')
  assert.equal(await regular, null)
  assert.equal(refreshCalls, 0)
  assert.equal(exchangeCalls, 2)
})

test('discards an in-flight token when another account becomes current', async () => {
  const first = idToken('https://tenant.example/oidc', 'member-a')
  const second = idToken('https://tenant.example/oidc', 'member-b')
  let browserToken = first
  let firstExchangeStarted = false
  const coordinator = createLogtoConvexTokenCoordinator({
    getIdToken: async () => browserToken,
    refreshLogtoSession: async () => true,
    exchange: async (token) => {
      if (token === first) {
        firstExchangeStarted = true
        return await new Promise<LeadershipTokenExchangeResult>(() => undefined)
      }
      return success('member-b-convex-token')
    },
    timeoutMs: 100,
  })

  const accountA = coordinator.fetchAccessToken({ forceRefreshToken: false })
  await nextTurn()
  assert.equal(firstExchangeStarted, true)
  browserToken = second
  const accountB = coordinator.fetchAccessToken({ forceRefreshToken: false })

  assert.equal(await accountB, 'member-b-convex-token')
  assert.equal(await accountA, null)
})

test('a regular request never joins another account forced refresh', async () => {
  const first = idToken('https://tenant.example/oidc', 'member-a')
  const second = idToken('https://tenant.example/oidc', 'member-b')
  let browserToken = first
  const coordinator = createLogtoConvexTokenCoordinator({
    getIdToken: async () => browserToken,
    refreshLogtoSession: async () => true,
    exchange: async (token) => token === first
      ? await new Promise<LeadershipTokenExchangeResult>(() => undefined)
      : success('member-b-convex-token'),
    timeoutMs: 100,
  })

  const accountA = coordinator.fetchAccessToken({ forceRefreshToken: true })
  await nextTurn()
  browserToken = second
  const accountB = coordinator.fetchAccessToken({ forceRefreshToken: false })

  assert.equal(await accountB, 'member-b-convex-token')
  assert.equal(await accountA, null)
})

test('a forced request never joins another account forced refresh', async () => {
  const first = idToken('https://tenant.example/oidc', 'member-a')
  const second = idToken('https://tenant.example/oidc', 'member-b')
  let browserToken = first
  const coordinator = createLogtoConvexTokenCoordinator({
    getIdToken: async () => browserToken,
    refreshLogtoSession: async () => true,
    exchange: async (token) => token === first
      ? await new Promise<LeadershipTokenExchangeResult>(() => undefined)
      : success('member-b-forced-token'),
    timeoutMs: 100,
  })

  const accountA = coordinator.fetchAccessToken({ forceRefreshToken: true })
  await nextTurn()
  browserToken = second
  const accountB = coordinator.fetchAccessToken({ forceRefreshToken: true })

  assert.equal(await accountB, 'member-b-forced-token')
  assert.equal(await accountA, null)
})
