import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import portalHandler from '../api/portal.ts'
import { createLocalSuperAdminSessionToken } from '../server/adminSessions.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { handlePortalRequest } from '../server/portalApi.ts'
import {
  portalSessionFor,
  requireAdmin,
  requirePublisher,
  requireScope,
  requireSuperAdmin,
} from '../server/portalSession.ts'
import type { PortalSessionResult } from '../server/portalSession.ts'
import { ADMIN_SCOPES, PUBLISH_APPROVERS } from '../src/lib/dashboardAccess.ts'

const createResponse = () => {
  let statusCode = 0
  let payload: unknown = null

  return {
    res: {
      setHeader() {
        return this
      },
      status(code: number) {
        statusCode = code
        return this
      },
      json(body: unknown) {
        payload = body
        return this
      },
      send(body: unknown) {
        payload = body
        return this
      },
    },
    result() {
      return { statusCode, payload }
    },
  }
}

/**
 * Mandatory env discipline: without deleting BLOB_READ_WRITE_TOKEN the store talks to real
 * Vercel Blob, and without UBLDA_LOCAL_DATA_FILE it writes into the developer's own data.
 */
const withPortalEnv = async (
  run: (store: ReturnType<typeof createLocalRecruitingStore>) => Promise<void>,
  env: Record<string, string | undefined> = {},
) => {
  const keys = ['BLOB_READ_WRITE_TOKEN', 'UBLDA_LOCAL_DATA_FILE', ...Object.keys(env)]
  const original = new Map<string, string | undefined>(keys.map((key) => [key, process.env[key]]))

  delete process.env.BLOB_READ_WRITE_TOKEN
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-portal-session-'))
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')
  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  })

  try {
    await run(createLocalRecruitingStore(process.env.UBLDA_LOCAL_DATA_FILE))
  } finally {
    original.forEach((value, key) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    })
    await rm(dir, { recursive: true, force: true })
  }
}

const actorOf = (result: PortalSessionResult) => {
  assert.equal(result.authorized, true)
  if (!result.authorized) throw new Error('unreachable')
  return result.actor
}

const statusOf = (result: PortalSessionResult) => {
  assert.equal(result.authorized, false)
  if (result.authorized) throw new Error('unreachable')
  return result.status
}

test('rejects a session token too short to be a session token', async () => {
  await withPortalEnv(async () => {
    const result = await portalSessionFor('short-token')

    assert.equal(statusOf(result), 401)
    assert.match(String((result as { error: string }).error), /session/i)
  })
})

test('never authorizes the local preview session token', async () => {
  await withPortalEnv(async () => {
    // It is 27 characters, so it clears the length gate and has to be refused by the store.
    assert.ok('local-preview-session-token'.length >= 24)
    assert.equal(statusOf(await portalSessionFor('local-preview-session-token')), 401)

    const response = await handlePortalRequest({
      method: 'POST',
      body: { action: 'portal.bootstrap', sessionToken: 'local-preview-session-token', payload: {} },
    })

    assert.equal(response.status, 401)
    assert.equal(response.body.success, undefined)
  })
})

test('resolves the local super-admin HMAC token to a super-admin with every scope', async () => {
  await withPortalEnv(async () => {
    const actor = actorOf(await portalSessionFor(createLocalSuperAdminSessionToken()))

    assert.equal(actor.role, 'super-admin')
    assert.equal(actor.email, 'sbodine@umich.edu')
    assert.equal(actor.isAdmin, true)
    assert.equal(actor.isSuperAdmin, true)
    assert.equal(actor.canPublish, true)
    ADMIN_SCOPES.forEach((scope) => {
      assert.ok(actor.scopes.includes(scope), `missing scope ${scope}`)
      assert.equal(requireScope({ authorized: true, actor }, scope).authorized, true)
    })
  }, {
    UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK: 'true',
    UBLDA_SUPER_ADMIN_PASSWORD: 'local-portal-session-secret',
  })
})

test('resolves a real member session to a member with no admin powers', async () => {
  await withPortalEnv(async (store) => {
    const session = await store.upsertAccount({
      firstName: 'Tommy',
      lastName: 'Hartnett',
      uniqname: 'thartnet',
      email: 'thartnet@umich.edu',
    }, 'a-real-password')

    const actor = actorOf(await portalSessionFor(session.sessionToken))

    assert.equal(actor.role, 'member')
    assert.equal(actor.isAdmin, false)
    assert.equal(actor.isSuperAdmin, false)
    assert.equal(actor.canPublish, false)
    assert.deepEqual(actor.scopes, [])
    assert.equal(statusOf(requireAdmin({ authorized: true, actor })), 403)
    assert.equal(statusOf(requireScope({ authorized: true, actor }, 'members')), 403)
    assert.equal(statusOf(requireSuperAdmin({ authorized: true, actor })), 403)
  })
})

test('a password account on an officer email stays a member until a verified provider says otherwise', async () => {
  await withPortalEnv(async (store) => {
    const session = await store.upsertAccount({
      firstName: 'Not',
      lastName: 'Alexa',
      uniqname: 'atchiang',
      email: 'atchiang@umich.edu',
    }, 'anyone-can-register-this')

    assert.equal(actorOf(await portalSessionFor(session.sessionToken)).role, 'member')
  })
})

test('requireScope refuses an exec who does not hold the scope and passes the one who does', async () => {
  await withPortalEnv(async (store) => {
    // Andrew Sackett holds events and announcements, and nothing else.
    const session = await store.upsertAccount({
      firstName: 'Andrew',
      lastName: 'Sackett',
      uniqname: 'andsack',
      email: 'andsack@umich.edu',
      role: 'exec',
      verifiedVia: 'google',
    })

    const result = await portalSessionFor(session.sessionToken)
    const actor = actorOf(result)

    assert.equal(actor.role, 'exec')
    assert.equal(actor.isAdmin, true)
    assert.equal(requireAdmin(result).authorized, true)
    assert.equal(requireScope(result, 'events').authorized, true)
    assert.equal(requireScope(result, 'announcements').authorized, true)
    assert.equal(statusOf(requireScope(result, 'members')), 403)
    assert.equal(statusOf(requireScope(result, 'recruiting')), 403)
    assert.equal(statusOf(requireSuperAdmin(result)), 403)
  })
})

test('requirePublisher passes only for the two publish approvers', async () => {
  await withPortalEnv(async (store) => {
    assert.deepEqual(PUBLISH_APPROVERS, ['sbodine@umich.edu', 'atchiang@umich.edu'])

    const approver = await store.upsertAccount({
      firstName: 'Alexa',
      lastName: 'Chiang',
      uniqname: 'atchiang',
      email: 'atchiang@umich.edu',
      role: 'exec',
      verifiedVia: 'google',
    })
    const nonApprover = await store.upsertAccount({
      firstName: 'Cooper',
      lastName: 'Perry',
      uniqname: 'cooperry',
      email: 'cooperry@umich.edu',
      role: 'exec',
      verifiedVia: 'google',
    })

    const approverSession = await portalSessionFor(approver.sessionToken)
    const nonApproverSession = await portalSessionFor(nonApprover.sessionToken)

    assert.equal(actorOf(approverSession).canPublish, true)
    assert.equal(requirePublisher(approverSession).authorized, true)
    assert.equal(actorOf(nonApproverSession).canPublish, false)
    assert.equal(statusOf(requirePublisher(nonApproverSession)), 403)
  })
})

test('rejects everything but POST and refuses an action that does not exist', async () => {
  await withPortalEnv(async () => {
    const notAllowed = await handlePortalRequest({ method: 'GET', body: {} })
    assert.equal(notAllowed.status, 405)

    const unknown = await handlePortalRequest({
      method: 'POST',
      body: { action: 'admin.deleteEverything', sessionToken: 'x'.repeat(40) },
    })
    assert.equal(unknown.status, 400)

    // A Map-backed registry, so an inherited Object key is not an action.
    const inherited = await handlePortalRequest({
      method: 'POST',
      body: { action: 'constructor', sessionToken: 'x'.repeat(40) },
    })
    assert.equal(inherited.status, 400)
  })
})

test('a member bootstrap carries no admin key and no admin scopes', async () => {
  await withPortalEnv(async (store) => {
    const session = await store.upsertAccount({
      firstName: 'Tommy',
      lastName: 'Hartnett',
      uniqname: 'thartnet',
      email: 'thartnet@umich.edu',
    }, 'a-real-password')

    const response = await handlePortalRequest({
      method: 'POST',
      body: { action: 'portal.bootstrap', sessionToken: session.sessionToken, payload: {} },
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.action, 'portal.bootstrap')

    const data = response.body.data as Record<string, unknown>
    assert.equal(data.role, 'member')
    assert.equal('admin' in data, false)
    assert.equal('scopes' in data, false)
    assert.equal('canPublish' in data, false)
    assert.equal(JSON.stringify(response.body).includes('adminScopes'), false)

    // The member half is present and real, not an empty shell.
    assert.equal((data.profile as Record<string, unknown>).email, 'thartnet@umich.edu')
    assert.deepEqual(data.events, [])
    assert.deepEqual(data.announcements, [])
    assert.equal((data.officers as unknown[]).length, 9)
    assert.deepEqual(data.participation, { eventsAttended: 0, eventKindsAttended: [], firstEventAt: '' })
  })
})

test('an admin bootstrap carries the admin half and the actor scopes', async () => {
  await withPortalEnv(async (store) => {
    const session = await store.upsertAccount({
      firstName: 'Lindsey',
      lastName: 'Ye',
      uniqname: 'ylindsey',
      email: 'ylindsey@umich.edu',
      role: 'exec',
      verifiedVia: 'google',
    })

    const response = await handlePortalRequest({
      method: 'POST',
      body: { action: 'portal.bootstrap', sessionToken: session.sessionToken, payload: {} },
    })

    assert.equal(response.status, 200)
    const data = response.body.data as Record<string, unknown>
    assert.equal(data.role, 'exec')
    assert.deepEqual(data.scopes, ['members', 'events', 'resources'])
    assert.equal(data.canPublish, false)

    const admin = data.admin as Record<string, unknown>
    assert.ok(admin)
    assert.deepEqual(admin.members, [])
    assert.ok(Array.isArray(admin.unprocessedIntake))
    // withPreviewAdmin force-injects sbodine on every read; it is not a Festifall signup.
    assert.equal((admin.unprocessedIntake as { email: string }[]).some((row) => row.email === 'sbodine@umich.edu'), false)
    assert.equal((admin.unprocessedIntake as { email: string }[]).some((row) => row.email === 'ylindsey@umich.edu'), true)
    assert.ok(admin.backendStatus)
    assert.ok(admin.launchReadiness)
    assert.ok(admin.recruitingPulse)
  })
})

test('server-side gating stands even when the client would never send the request', async () => {
  await withPortalEnv(async (store) => {
    const member = await store.upsertAccount({
      firstName: 'Tommy',
      lastName: 'Hartnett',
      uniqname: 'thartnet',
      email: 'thartnet@umich.edu',
    }, 'a-real-password')

    const forbidden = await handlePortalRequest({
      method: 'POST',
      body: {
        action: 'admin.member.upsert',
        sessionToken: member.sessionToken,
        payload: { email: 'thartnet@umich.edu', status: 'active' },
      },
    })
    assert.equal(forbidden.status, 403)

    const signedOut = await handlePortalRequest({
      method: 'POST',
      body: { action: 'admin.member.upsert', sessionToken: '', payload: {} },
    })
    assert.equal(signedOut.status, 401)

    // An events-scope exec who is not a publisher cannot publish, button or no button.
    const exec = await store.upsertAccount({
      firstName: 'Andrew',
      lastName: 'Sackett',
      uniqname: 'andsack',
      email: 'andsack@umich.edu',
      role: 'exec',
      verifiedVia: 'google',
    })
    const publishAttempt = await handlePortalRequest({
      method: 'POST',
      body: {
        action: 'admin.event.publish',
        sessionToken: exec.sessionToken,
        payload: { eventId: 'event_does_not_matter' },
      },
    })
    assert.equal(publishAttempt.status, 403)
  })
})

test('the Vercel handler and the dev middleware return the same bootstrap', async () => {
  await withPortalEnv(async (store) => {
    const session = await store.upsertAccount({
      firstName: 'Tommy',
      lastName: 'Hartnett',
      uniqname: 'thartnet',
      email: 'thartnet@umich.edu',
    }, 'a-real-password')

    const body = { action: 'portal.bootstrap', sessionToken: session.sessionToken, payload: {} }
    const direct = await handlePortalRequest({ method: 'POST', body })

    const { res, result } = createResponse()
    await portalHandler({ method: 'POST', headers: {}, body }, res)

    assert.equal(result().statusCode, direct.status)

    const viaHandler = result().payload as Record<string, unknown>
    const directData = direct.body.data as Record<string, unknown>
    const handlerData = viaHandler.data as Record<string, unknown>

    assert.equal(viaHandler.success, true)
    assert.equal(viaHandler.action, direct.body.action)
    assert.deepEqual(Object.keys(handlerData).sort(), Object.keys(directData).sort())
    assert.deepEqual(handlerData.officers, directData.officers)
    assert.deepEqual(handlerData.participation, directData.participation)
    assert.equal('admin' in handlerData, false)

    // The profile for a member with no saved record is a fresh shell, so its createdAt is
    // stamped per call. Everything that is not a per-call timestamp has to match exactly.
    const stableProfile = (profile: unknown) => {
      const row = { ...(profile as Record<string, unknown>) }
      delete row.createdAt
      delete row.updatedAt
      delete row.joinedAt
      return row
    }
    assert.deepEqual(stableProfile(handlerData.profile), stableProfile(directData.profile))
  })
})
