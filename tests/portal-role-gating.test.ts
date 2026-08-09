import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { handlePortalRequest, portalActionNames } from '../server/portalApi.ts'
import type { PortalSessionResult } from '../server/portalSession.ts'
import { portalSessionFor } from '../server/portalSession.ts'
import { ADMIN_SCOPES } from '../src/lib/dashboardAccess.ts'
import type { ClubEvent, ClubEventData } from '../src/lib/portalEvents.ts'

/**
 * T5 — spec §9: every action name × every role → expected status.
 *
 * Spec §4.2: "the client role is a rendering hint, never an authorization decision."
 * `RequireRole` is UX; this file is the enforcement. A member who types
 * `/dashboard/roster` gets redirected, and a member who curls `admin.member.upsert`
 * gets a 403 — both must be true, and only the second one is testable here.
 *
 * The action list is read from `server/portalApi.ts` itself via `portalActionNames()`
 * and the table is checked against it, so a newly added action cannot silently escape
 * coverage: it fails this file until someone states what each role should get.
 *
 * Every allowed cell uses a payload that really succeeds (200) rather than a stub that
 * fails validation, because a 400 would prove only that the request reached the
 * validator — not that the action works for the role that owns it.
 *
 * Test files never import each other (spec §9), so the env harness below is a
 * deliberate duplicate rather than a shared module.
 */

const ROLE_KEYS = [
  'signed-out',
  'member',
  'exec-without-scope',
  'exec-with-scope',
  'publisher',
  'super-admin',
] as const

type RoleKey = (typeof ROLE_KEYS)[number]

type Expectation = Record<RoleKey, number>

/** Signed-in and nothing more: the five member-face actions. */
const memberAction = (): Expectation => ({
  'signed-out': 401,
  member: 200,
  'exec-without-scope': 200,
  'exec-with-scope': 200,
  publisher: 200,
  'super-admin': 200,
})

/** Needs an admin scope. An exec without it is refused exactly like a member. */
const scopedAction = (): Expectation => ({
  'signed-out': 401,
  member: 403,
  'exec-without-scope': 403,
  'exec-with-scope': 200,
  publisher: 200,
  'super-admin': 200,
})

/** Doc #54 in software: holding the scope is not the same as being allowed to publish. */
const publisherAction = (): Expectation => ({
  'signed-out': 401,
  member: 403,
  'exec-without-scope': 403,
  'exec-with-scope': 403,
  publisher: 200,
  'super-admin': 200,
})

const superAdminAction = (): Expectation => ({
  'signed-out': 401,
  member: 403,
  'exec-without-scope': 403,
  'exec-with-scope': 403,
  publisher: 403,
  'super-admin': 200,
})

/**
 * Mandatory env discipline: without deleting BLOB_READ_WRITE_TOKEN the store talks to
 * real Vercel Blob, and without UBLDA_LOCAL_DATA_FILE it writes the developer's own data.
 */
const withPortalEnv = async (
  run: (store: ReturnType<typeof createLocalRecruitingStore>) => Promise<void>,
) => {
  const keys = ['BLOB_READ_WRITE_TOKEN', 'UBLDA_LOCAL_DATA_FILE']
  const original = new Map<string, string | undefined>(keys.map((key) => [key, process.env[key]]))

  delete process.env.BLOB_READ_WRITE_TOKEN
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-portal-gating-'))
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')

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

type Store = ReturnType<typeof createLocalRecruitingStore>

const call = (action: string, sessionToken: string, payload: Record<string, unknown> = {}) => (
  handlePortalRequest({ method: 'POST', body: { action, sessionToken, payload } })
)

const adminActor = { email: 'sbodine@umich.edu', role: 'super-admin' as const }

const eventSeed = (overrides: Partial<ClubEventData> = {}): ClubEventData => ({
  id: '',
  title: 'Microsoft fireside',
  summary: 'Forty minutes with the accessibility engineering team, then questions.',
  kind: 'fireside',
  format: 'in-person',
  startsAt: '2099-10-01T23:00:00.000Z',
  endsAt: '2099-10-02T00:30:00.000Z',
  locationName: 'Ross R1240',
  locationDetail: 'Step-free route via the east doors on Tappan.',
  virtualUrl: '',
  hostName: 'Andrew Sackett',
  speakerName: '',
  speakerOrg: '',
  capacity: 40,
  rsvpDeadline: '',
  // Non-empty commitments + an accommodations contact + a DRI: publishable per §3.3.
  accessCommitments: [
    { id: 'step-free-route', state: 'confirmed' },
    { id: 'live-captions', state: 'not-available' },
  ],
  accommodationsContactEmail: 'andsack@umich.edu',
  recordingUrl: '',
  slidesUrl: '',
  roomStatus: 'requested',
  internalNotes: '',
  ...overrides,
})

const googleSession = (store: Store, input: { firstName: string; lastName: string; email: string }) => (
  store.upsertAccount({
    firstName: input.firstName,
    lastName: input.lastName,
    uniqname: input.email.replace(/@.*$/, ''),
    email: input.email,
    verifiedVia: 'google',
  })
)

/** A signup with a password and no elevation: the plain-member case. */
const passwordSession = (store: Store, input: { firstName: string; lastName: string; email: string }) => (
  store.upsertAccount({
    firstName: input.firstName,
    lastName: input.lastName,
    uniqname: input.email.replace(/@.*$/, ''),
    email: input.email,
  })
)

type Fixtures = {
  tokens: Record<RoleKey, string>
  publishedEventId: string
  publishTargets: Record<RoleKey, string>
  cancelTargets: Record<RoleKey, string>
  announcementTargets: Record<RoleKey, string>
  resourceIds: string[]
}

const seedFixtures = async (store: Store): Promise<Fixtures> => {
  // ── Sessions, one per role in the matrix ────────────────────────────────────
  const member = await passwordSession(store, {
    firstName: 'Tommy', lastName: 'Hartnett', email: 'thartnet@umich.edu',
  })

  // Two granted execs. Neither is on the static roster, so their scopes come only from
  // what a super-admin granted — which is exactly what makes a scopeless exec possible
  // (every officer on the real roster happens to hold `events`).
  const noScope = await passwordSession(store, {
    firstName: 'Noscope', lastName: 'Exec', email: 'noscope@umich.edu',
  })
  const scoped = await passwordSession(store, {
    firstName: 'Scoped', lastName: 'Exec', email: 'scopedexec@umich.edu',
  })
  assert.equal((await store.grantAccountRole(
    { email: 'noscope@umich.edu', role: 'exec', scopes: [] }, adminActor,
  )).ok, true)
  assert.equal((await store.grantAccountRole(
    { email: 'scopedexec@umich.edu', role: 'exec', scopes: [...ADMIN_SCOPES] }, adminActor,
  )).ok, true)

  // Alexa Chiang: exec, holds every scope this table needs, AND publishes.
  const publisher = await googleSession(store, {
    firstName: 'Alexa', lastName: 'Chiang', email: 'atchiang@umich.edu',
  })
  const superAdmin = await googleSession(store, {
    firstName: 'Sam', lastName: 'Bodine', email: 'sbodine@umich.edu',
  })

  // The target of admin.grantRole. It has to already exist to be granted anything.
  await passwordSession(store, { firstName: 'Grant', lastName: 'Ee', email: 'grantee@umich.edu' })

  const tokens: Record<RoleKey, string> = {
    // Long enough to survive the length check, so it is rejected by session lookup
    // rather than by the cheap guard — the path a stolen or stale token really takes.
    'signed-out': 'not-a-real-session-token-0000000000000000',
    member: member.sessionToken,
    'exec-without-scope': noScope.sessionToken,
    'exec-with-scope': scoped.sessionToken,
    publisher: publisher.sessionToken,
    'super-admin': superAdmin.sessionToken,
  }

  // ── One published event everyone can be measured against ────────────────────
  const drafted = await store.saveClubEvent(eventSeed({ title: 'Published fireside' }), adminActor)
  const published = await store.publishClubEvent(drafted.id, adminActor)
  assert.equal(published.ok, true, `seed event did not publish: ${JSON.stringify(published)}`)

  // ── Per-role write targets, so no cell can affect another cell's outcome ────
  const publishTargets = {} as Record<RoleKey, string>
  const cancelTargets = {} as Record<RoleKey, string>
  const announcementTargets = {} as Record<RoleKey, string>

  for (const role of ROLE_KEYS) {
    const publishTarget = await store.saveClubEvent(eventSeed({ title: `Publish target ${role}` }), adminActor)
    publishTargets[role] = publishTarget.id

    const cancelTarget = await store.saveClubEvent(eventSeed({ title: `Cancel target ${role}` }), adminActor)
    cancelTargets[role] = cancelTarget.id

    const announcement = await store.saveAnnouncement({
      id: '',
      title: `Announcement target ${role}`,
      body: 'Ross R1240, step-free route via the east doors on Tappan.',
      audience: 'all-members',
      pinned: false,
      ctaLabel: '',
      ctaHref: '',
      expiresAt: '',
    }, adminActor)
    announcementTargets[role] = announcement.id
  }

  // ── Two resources for the reorder action ────────────────────────────────────
  const first = await store.savePortalResource({
    id: '',
    title: 'Accessibility commitments',
    description: 'What we promise about every room we book.',
    href: 'https://ublda.org/accessibility',
    category: 'accessibility',
    formatNote: 'Tagged PDF, screen-reader tested',
    audience: 'all-members',
    published: true,
  }, adminActor)
  const second = await store.savePortalResource({
    id: '',
    title: 'New member onboarding',
    description: 'What happens in the first month.',
    href: 'https://ublda.org/onboarding',
    category: 'onboarding',
    formatNote: 'Captioned',
    audience: 'all-members',
    published: true,
  }, adminActor)

  return {
    tokens,
    publishedEventId: drafted.id,
    publishTargets,
    cancelTargets,
    announcementTargets,
    resourceIds: [first.id, second.id],
  }
}

type Case = {
  action: string
  expected: Expectation
  payload: (role: RoleKey, fixtures: Fixtures) => Record<string, unknown>
}

const CASES: Case[] = [
  {
    action: 'portal.bootstrap',
    expected: memberAction(),
    payload: () => ({}),
  },
  {
    action: 'member.saveProfile',
    expected: memberAction(),
    payload: (role) => ({ preferredName: `Gate ${role}` }),
  },
  {
    action: 'member.saveAccess',
    expected: memberAction(),
    payload: () => ({
      needs: [],
      generalNote: '',
      followUpPreference: 'email',
      scope: 'private',
      appliesTo: 'rsvp-only',
      consentText: '',
    }),
  },
  {
    action: 'member.withdrawAccessConsent',
    expected: memberAction(),
    payload: () => ({}),
  },
  {
    action: 'event.rsvp',
    expected: memberAction(),
    payload: (_role, fixtures) => ({
      eventId: fixtures.publishedEventId,
      response: 'interested',
      guestCount: 0,
      accommodationNote: '',
      shareAccommodationWithLeads: false,
    }),
  },
  {
    action: 'admin.member.upsert',
    expected: scopedAction(),
    payload: (role) => ({
      email: `upsert-${role}@umich.edu`,
      firstName: 'Upsert',
      lastName: 'Target',
      status: 'active',
      source: 'manual',
    }),
  },
  {
    action: 'admin.member.bulkAdmit',
    expected: scopedAction(),
    payload: (role) => ({
      emails: [`bulk-${role}@umich.edu`],
      status: 'active',
      source: 'festifall',
    }),
  },
  {
    action: 'admin.event.upsert',
    expected: scopedAction(),
    payload: (role) => eventSeed({ title: `Upsert by ${role}` }) as unknown as Record<string, unknown>,
  },
  {
    action: 'admin.event.publish',
    expected: publisherAction(),
    payload: (role, fixtures) => ({ eventId: fixtures.publishTargets[role] }),
  },
  {
    action: 'admin.event.cancel',
    expected: scopedAction(),
    payload: (role, fixtures) => ({ eventId: fixtures.cancelTargets[role], reason: 'Room fell through.' }),
  },
  {
    action: 'admin.event.checkIn',
    expected: scopedAction(),
    payload: (role, fixtures) => ({
      eventId: fixtures.publishedEventId,
      email: `walkin-${role}@umich.edu`,
      checkedIn: true,
    }),
  },
  {
    action: 'admin.announcement.upsert',
    expected: scopedAction(),
    payload: (role) => ({
      title: `Draft by ${role}`,
      body: 'We are tabling on the Diag from 11 to 4. Two-hour shifts, sit-down table.',
      audience: 'all-members',
      pinned: false,
      ctaLabel: '',
      ctaHref: '',
      expiresAt: '',
    }),
  },
  {
    action: 'admin.announcement.publish',
    expected: publisherAction(),
    payload: (role, fixtures) => ({ id: fixtures.announcementTargets[role], status: 'published' }),
  },
  {
    action: 'admin.resource.upsert',
    expected: scopedAction(),
    payload: (role) => ({
      title: `Library entry by ${role}`,
      description: 'A real link with a real format note.',
      href: 'https://ublda.org/resources',
      category: 'club-docs',
      formatNote: 'Not yet remediated — email us and we will send another format',
      audience: 'all-members',
      published: true,
    }),
  },
  {
    action: 'admin.resource.reorder',
    expected: scopedAction(),
    payload: (_role, fixtures) => ({ ids: [...fixtures.resourceIds].reverse() }),
  },
  {
    action: 'admin.export',
    expected: superAdminAction(),
    payload: () => ({ kind: 'roster' }),
  },
  {
    action: 'admin.grantRole',
    expected: superAdminAction(),
    payload: () => ({ email: 'grantee@umich.edu', role: 'exec', scopes: ['events'] }),
  },
  {
    action: 'admin.audit.list',
    expected: superAdminAction(),
    payload: () => ({ limit: 5 }),
  },
]

test('the table covers every action registered in server/portalApi.ts', async () => {
  // Read from the registry itself, not from a copy: an action added without a row here
  // fails this test rather than shipping ungated.
  const registered = [...portalActionNames()].sort()
  const covered = CASES.map((entry) => entry.action).sort()

  assert.deepEqual(covered, registered, 'every registered portal action needs a role-gating row')
  assert.equal(new Set(covered).size, covered.length, 'the table lists an action twice')
})

test('each fixture really is the role the table claims it is', async () => {
  // Without this the whole matrix could pass vacuously: if the "exec without scope"
  // fixture silently resolved to `member`, every 403 below would still line up.
  await withPortalEnv(async (store) => {
    const fixtures = await seedFixtures(store)

    const resolved = {} as Record<RoleKey, PortalSessionResult>
    for (const role of ROLE_KEYS) {
      resolved[role] = await portalSessionFor(fixtures.tokens[role])
    }

    assert.equal(resolved['signed-out'].authorized, false)
    assert.equal(resolved['signed-out'].authorized === false && resolved['signed-out'].status, 401)

    const actorFor = (role: RoleKey) => {
      const result = resolved[role]
      assert.equal(result.authorized, true, `${role} did not authorize at all`)
      assert.ok(result.authorized)
      return result.actor
    }

    const member = actorFor('member')
    assert.equal(member.role, 'member')
    assert.equal(member.isAdmin, false)
    assert.deepEqual(member.scopes, [])
    assert.equal(member.canPublish, false)

    const noScope = actorFor('exec-without-scope')
    assert.equal(noScope.role, 'exec')
    assert.equal(noScope.isAdmin, true, 'the scopeless fixture is not an admin, so its 403s prove nothing')
    assert.equal(noScope.isSuperAdmin, false)
    assert.deepEqual(noScope.scopes, [], 'the scopeless fixture picked up scopes from somewhere')
    assert.equal(noScope.canPublish, false)

    const scoped = actorFor('exec-with-scope')
    assert.equal(scoped.role, 'exec')
    assert.equal(scoped.isSuperAdmin, false)
    assert.equal(scoped.canPublish, false, 'the scoped fixture must not also be a publisher')
    ADMIN_SCOPES.forEach((scope) => {
      assert.ok(scoped.scopes.includes(scope), `the scoped fixture is missing ${scope}`)
    })

    const publisher = actorFor('publisher')
    assert.equal(publisher.role, 'exec')
    assert.equal(publisher.isSuperAdmin, false, 'the publisher fixture must not be a super-admin')
    assert.equal(publisher.canPublish, true)

    const superAdmin = actorFor('super-admin')
    assert.equal(superAdmin.role, 'super-admin')
    assert.equal(superAdmin.isSuperAdmin, true)
    assert.equal(superAdmin.canPublish, true)
  })
})

test('every action × every role returns exactly the expected status', async () => {
  await withPortalEnv(async (store) => {
    const fixtures = await seedFixtures(store)
    const mismatches: string[] = []
    const leaked: string[] = []

    for (const entry of CASES) {
      for (const role of ROLE_KEYS) {
        const response = await call(entry.action, fixtures.tokens[role], entry.payload(role, fixtures))
        const expected = entry.expected[role]

        if (response.status !== expected) {
          mismatches.push(
            `${entry.action} as ${role}: expected ${expected}, got ${response.status} `
            + `${JSON.stringify(response.body).slice(0, 200)}`,
          )
        }

        // The headline rule, asserted independently of the table so a wrong expectation
        // cannot hide it: no action returns 200 to a role that should not have it.
        if (expected !== 200 && response.status === 200) {
          leaked.push(`${entry.action} returned 200 to ${role}`)
        }
      }
    }

    assert.deepEqual(leaked, [], `an action authorized a role it must refuse:\n${leaked.join('\n')}`)
    assert.deepEqual(mismatches, [], `role gating did not match the table:\n${mismatches.join('\n')}`)
  })
})

test('a refused call writes nothing at all', async () => {
  // A 403 that still mutated the document would be the worst possible outcome: the gate
  // reads as enforced while the write already happened.
  await withPortalEnv(async (store) => {
    const fixtures = await seedFixtures(store)

    const refusedRoles: RoleKey[] = ['signed-out', 'member', 'exec-without-scope']

    for (const role of refusedRoles) {
      await call('admin.member.upsert', fixtures.tokens[role], {
        email: `upsert-${role}@umich.edu`,
        firstName: 'Upsert',
        lastName: 'Target',
        status: 'active',
        source: 'manual',
      })
      await call('admin.event.cancel', fixtures.tokens[role], {
        eventId: fixtures.cancelTargets[role],
        reason: 'Should never land.',
      })
    }

    // The scoped exec holds `events` but cannot publish; the publish attempt must not stick.
    await call('admin.event.publish', fixtures.tokens['exec-with-scope'], {
      eventId: fixtures.publishTargets['exec-with-scope'],
    })

    const workspace = await store.listPortalWorkspace()
    const byId = new Map<string, ClubEvent>(workspace.clubEvents.map((event) => [event.id, event]))

    refusedRoles.forEach((role) => {
      assert.equal(
        workspace.memberProfiles.some((profile) => profile.email === `upsert-${role}@umich.edu`),
        false,
        `${role} was refused admin.member.upsert and the row was written anyway`,
      )
      assert.equal(
        byId.get(fixtures.cancelTargets[role])?.status,
        'draft',
        `${role} was refused admin.event.cancel and the event changed anyway`,
      )
    })

    assert.equal(
      byId.get(fixtures.publishTargets['exec-with-scope'])?.status,
      'draft',
      'a non-publisher exec was refused and the event published anyway',
    )
    assert.equal(byId.get(fixtures.publishTargets['exec-with-scope'])?.publishedBy, '')
  })
})

test('a token that is too short, empty, or the dev preview token never authorizes', async () => {
  await withPortalEnv(async (store) => {
    const fixtures = await seedFixtures(store)

    const rejectedTokens = [
      '',
      'short',
      'local-preview-session-token', // §10.6 — a dev shortcut must never reach prod logic
    ]

    for (const token of rejectedTokens) {
      for (const entry of CASES) {
        const response = await call(entry.action, token, entry.payload('member', fixtures))
        assert.equal(
          response.status,
          401,
          `${entry.action} answered ${response.status} for token ${JSON.stringify(token)}`,
        )
      }
    }
  })
})

test('the dispatcher refuses a non-POST request and an unknown action before touching a session', async () => {
  await withPortalEnv(async (store) => {
    const fixtures = await seedFixtures(store)

    const notPost = await handlePortalRequest({
      method: 'GET',
      body: { action: 'portal.bootstrap', sessionToken: fixtures.tokens['super-admin'] },
    })
    assert.equal(notPost.status, 405)
    assert.equal(notPost.body.success, undefined)

    const unknown = await call('admin.deleteEverything', fixtures.tokens['super-admin'])
    assert.equal(unknown.status, 400)
    assert.equal(unknown.body.success, undefined)

    // An unknown action is refused for a signed-out caller too, and never 200.
    const unknownSignedOut = await call('admin.deleteEverything', fixtures.tokens['signed-out'])
    assert.equal(unknownSignedOut.status, 400)
  })
})

test('a member who is handed an admin scope list by the client gains nothing', async () => {
  // §4.2: scopes resolve server-side from the actor's email. A client that sends its own
  // role or scopes is sending decoration.
  await withPortalEnv(async (store) => {
    const member = await passwordSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', email: 'thartnet@umich.edu',
    })

    const forged = await handlePortalRequest({
      method: 'POST',
      body: {
        action: 'admin.member.upsert',
        sessionToken: member.sessionToken,
        role: 'super-admin',
        scopes: [...ADMIN_SCOPES],
        adminScopes: [...ADMIN_SCOPES],
        payload: {
          email: 'forged@umich.edu',
          firstName: 'Forged',
          lastName: 'Row',
          status: 'active',
          source: 'manual',
          role: 'super-admin',
          adminScopes: [...ADMIN_SCOPES],
        },
      },
    })

    assert.equal(forged.status, 403)
    const workspace = await store.listPortalWorkspace()
    assert.equal(workspace.memberProfiles.some((profile) => profile.email === 'forged@umich.edu'), false)

    // And the bootstrap it can reach still has no admin half.
    const bootstrap = await call('portal.bootstrap', member.sessionToken)
    assert.equal(bootstrap.status, 200)
    assert.equal('admin' in (bootstrap.body.data as Record<string, unknown>), false)
  })
})
