import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { ConvexError } from 'convex/values'
import {
  handleSpeakerOpsRequest,
  verifySpeakerOpsIdentity,
} from '../server/speakerOpsService.ts'
import {
  createSpeakerOpsStore,
  type SpeakerOpsActor,
} from '../server/speakerOpsStore.ts'

const actor: SpeakerOpsActor = {
  memberId: 'member-sam',
  displayName: 'Sam Bodine',
  email: 'sbodine@umich.edu',
  role: 'admin',
}

const buildOptions = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ublda-speaker-service-'))
  const store = createSpeakerOpsStore(path.join(directory, 'speaker-ops.json'), { forceLocal: true })
  return {
    directory,
    options: {
      store,
      verifyIdentity: async (idToken: string) => {
        assert.equal(idToken, 'canonical-logto-id-token')
        return actor
      },
    },
  }
}

test('requires a canonical ID token for every supported action', async () => {
  const response = await handleSpeakerOpsRequest({ action: 'workspace' })
  assert.equal(response.status, 401)
  assert.match(String(response.body.error), /sign in/i)
})

test('rejects all retired password and session actions before identity verification', async () => {
  let verifierCalls = 0
  const verifyIdentity = async () => {
    verifierCalls += 1
    return actor
  }

  for (const action of ['signIn', 'session', 'logout', 'changePassword']) {
    const response = await handleSpeakerOpsRequest({
      action,
      email: 'sbodine@umich.edu',
      password: 'retired-password',
      sessionToken: 'retired-session-token',
    }, '127.0.0.1', { verifyIdentity })
    assert.deepEqual(response, { status: 400, body: { error: 'Unknown Speaker Ops action.' } })
  }
  assert.equal(verifierCalls, 0)
})

test('serves and mutates Speaker Ops with the verified Convex actor', async (t) => {
  const { directory, options } = await buildOptions()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const workspace = await handleSpeakerOpsRequest({
    action: 'workspace',
    idToken: 'canonical-logto-id-token',
  }, '127.0.0.1', options)
  assert.equal(workspace.status, 200)
  assert.equal((workspace.body.workspace as { viewer: { email: string } }).viewer.email, actor.email)

  const updated = await handleSpeakerOpsRequest({
    action: 'updateLead',
    idToken: 'canonical-logto-id-token',
    lead: { id: 'deb-ruh', nextAction: 'Send the proposed dates.' },
  }, '127.0.0.1', options)
  assert.equal(updated.status, 200)

  const refreshed = await options.store.workspace(actor)
  assert.equal(refreshed.leads.find((lead) => lead.id === 'deb-ruh')?.nextAction, 'Send the proposed dates.')
  assert.equal(refreshed.activity[0]?.actorEmail, actor.email)
})

test('rejects an API attempt to reuse a speaker across both fall slots without persisting partial edits', async (t) => {
  const { directory, options } = await buildOptions()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const before = await options.store.workspace(actor)
  const secondaryBefore = before.slots.find((slot) => slot.id === 'fall-2026-secondary')
  assert.ok(secondaryBefore)

  const response = await handleSpeakerOpsRequest({
    action: 'updateSlot',
    idToken: 'canonical-logto-id-token',
    slot: {
      id: 'fall-2026-secondary',
      leadId: 'deb-ruh',
      preferredStart: '2026-12-01T18:30:00-05:00',
    },
  }, '127.0.0.1', options)
  assert.equal(response.status, 400)
  assert.match(String(response.body.error), /different speaker/i)

  const after = await options.store.workspace(actor)
  assert.deepEqual(after.slots.find((slot) => slot.id === 'fall-2026-secondary'), secondaryBefore)
})

test('uses the Convex roster as the sole leadership authorization source', async () => {
  let queriedToken = ''
  let queriedUrl = ''
  const verified = await verifySpeakerOpsIdentity('signed-logto-token', {
    environment: {
      CONVEX_URL: 'https://primary.convex.cloud',
      VITE_CONVEX_URL: 'https://fallback.convex.cloud',
    },
    exchange: async () => ({
      identity: {
        subject: 'logto-new-leader',
        email: 'newleader@umich.edu',
        emailVerified: true,
        name: 'New Leader',
      },
      token: 'short-lived-convex-token',
      expiresIn: 300,
    }),
    queryViewer: async (token, url) => {
      queriedToken = token
      queriedUrl = url
      return {
        memberId: 'approved-member-id',
        displayName: 'New Leader',
        role: 'member',
        status: 'active',
        avatarUrl: null,
      }
    },
  })

  assert.equal(queriedToken, 'short-lived-convex-token')
  assert.equal(queriedUrl, 'https://primary.convex.cloud')
  assert.deepEqual(verified, {
    memberId: 'approved-member-id',
    displayName: 'New Leader',
    email: 'newleader@umich.edu',
    role: 'member',
  })
})

test('denies identities that Convex has not approved', async () => {
  await assert.rejects(
    verifySpeakerOpsIdentity('signed-logto-token', {
      environment: { VITE_CONVEX_URL: 'https://fallback.convex.cloud' },
      exchange: async () => ({
        identity: {
          subject: 'logto-outsider',
          email: 'outsider@umich.edu',
          emailVerified: true,
        },
        token: 'short-lived-convex-token',
        expiresIn: 300,
      }),
      queryViewer: async () => {
        throw new ConvexError({ code: 'IDENTITY_NOT_APPROVED' })
      },
    }),
    /not approved/i,
  )
})

test('bounds a stalled Convex membership lookup and returns a retryable service error', async () => {
  const startedAt = Date.now()
  await assert.rejects(
    verifySpeakerOpsIdentity('signed-logto-token', {
      environment: { VITE_CONVEX_URL: 'https://fallback.convex.cloud' },
      exchange: async () => ({
        identity: {
          subject: 'logto-member',
          email: 'member@umich.edu',
          emailVerified: true,
        },
        token: 'short-lived-convex-token',
        expiresIn: 300,
      }),
      queryViewer: async () => await new Promise(() => undefined),
      viewerTimeoutMs: 15,
    }),
    /membership could not be verified/i,
  )
  assert.ok(Date.now() - startedAt < 500)
})
