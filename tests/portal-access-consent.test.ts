import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { handlePortalRequest } from '../server/portalApi.ts'
import {
  ACCESS_CONSENT_TEXT,
  ACCESS_LEAD_EMAILS,
  consentedAccessView,
  emptyAccessProfile,
} from '../src/lib/portalAccess.ts'
import type { AccessProfile } from '../src/lib/portalAccess.ts'
import type { EventRsvp } from '../src/lib/portalEvents.ts'
import type { ClubEventData } from '../src/lib/portalEvents.ts'
import type { MemberAdminRow } from '../src/lib/portalMembers.ts'

/**
 * T5 — spec §9 and §3.4: every branch of `consentedAccessView`.
 *
 * Access needs are the most sensitive data in the system, and §3.4 rule 3 is the rule
 * this file exists to hold: **`super-admin` grants nothing here.** Access data is
 * readable only by the leads the member named, so `consentedAccessView` takes no role
 * at all — there is nothing in its signature that a role could short-circuit. The
 * integration half proves the same thing through `/api/portal`, where a role does exist
 * and still buys nobody a read path.
 *
 * Test files never import each other (spec §9), so the env harness below is a
 * deliberate duplicate rather than a shared module.
 */

const NOW = '2026-08-06T12:00:00.000Z'
const FUTURE = '2026-12-31T23:59:59.000Z'
const PAST = '2026-04-30T23:59:59.000Z'

/** A named lead from ACCESS_LEAD_EMAILS. */
const LEAD = 'ylindsey@umich.edu'
/** An exec on the roster who is NOT one of the four named leads. */
const NON_LEAD_EXEC = 'landonem@umich.edu'

const FORBIDDEN_DETAIL = 'FORBIDDEN_ACCESS_DETAIL'
const FORBIDDEN_NOTE = 'FORBIDDEN_ACCESS_NOTE'
const FORBIDDEN_RSVP_NOTE = 'FORBIDDEN_RSVP_NOTE'

/** Consent in force: shared, unwithdrawn, unexpired, and applying to every event. */
const activeProfile = (overrides: Partial<AccessProfile> = {}): AccessProfile => ({
  ...emptyAccessProfile(),
  needs: [{ id: 'live-captioning', priority: 'required', detail: FORBIDDEN_DETAIL }],
  generalNote: FORBIDDEN_NOTE,
  followUpPreference: 'before-event',
  scope: 'shared-with-leads',
  appliesTo: 'all-events',
  consentAt: '2026-08-01T00:00:00.000Z',
  consentText: ACCESS_CONSENT_TEXT,
  expiresAt: FUTURE,
  withdrawnAt: '',
  hasOpened: true,
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

const viewFor = (overrides: {
  profile?: AccessProfile
  readerEmail?: string
  now?: string
  hasGoingRsvpForEvent?: boolean
} = {}) => consentedAccessView({
  profile: overrides.profile || activeProfile(),
  preferredName: 'Maya',
  readerEmail: overrides.readerEmail === undefined ? LEAD : overrides.readerEmail,
  now: overrides.now || NOW,
  ...(overrides.hasGoingRsvpForEvent === undefined ? {} : { hasGoingRsvpForEvent: overrides.hasGoingRsvpForEvent }),
})

// ── Unit: every branch returns null ───────────────────────────────────────────

test('consentedAccessView returns the view only when every condition holds', async () => {
  const view = viewFor()

  assert.ok(view, 'a fully consented profile read by a named lead returned null')
  assert.equal(view.preferredName, 'Maya')
  assert.equal(view.generalNote, FORBIDDEN_NOTE)
  assert.equal(view.followUpPreference, 'before-event')
  assert.deepEqual(view.needs, [{ id: 'live-captioning', priority: 'required', detail: FORBIDDEN_DETAIL }])

  // Allowlist construction: the consent stamps and the member's own prompt flag
  // (`hasOpened`) are never part of what a lead receives.
  assert.deepEqual(Object.keys(view).sort(), ['followUpPreference', 'generalNote', 'needs', 'preferredName'])
})

test('consentedAccessView returns null when the scope is private', async () => {
  assert.equal(viewFor({ profile: activeProfile({ scope: 'private' }) }), null)
  // The default profile a member starts with is private, and starts with nothing checked.
  assert.equal(viewFor({ profile: emptyAccessProfile() }), null)
})

test('consentedAccessView returns null once consent is withdrawn', async () => {
  // Withdrawal is retroactive by construction: the stored needs are untouched, and the
  // read path stops resolving on the very next read.
  const withdrawn = activeProfile({ withdrawnAt: '2026-08-05T00:00:00.000Z' })

  assert.equal(withdrawn.needs.length, 1, 'withdrawal must not delete what the member wrote')
  assert.equal(viewFor({ profile: withdrawn }), null)
})

test('consentedAccessView returns null when expiresAt is in the past', async () => {
  assert.equal(viewFor({ profile: activeProfile({ expiresAt: PAST }) }), null)
  // Lazy expiry, evaluated at read time: the same profile resolved before it lapsed.
  assert.ok(viewFor({ profile: activeProfile({ expiresAt: PAST }), now: '2026-04-01T00:00:00.000Z' }))
  // A profile with no expiry stamp at all is not an unlimited licence.
  assert.equal(viewFor({ profile: activeProfile({ expiresAt: '' }) }), null)
  assert.equal(viewFor({ profile: activeProfile({ expiresAt: 'whenever' }) }), null)
})

test('consentedAccessView returns null for a reader who is not one of the named leads', async () => {
  assert.equal(viewFor({ readerEmail: NON_LEAD_EXEC }), null)
  assert.equal(viewFor({ readerEmail: '' }), null)
  assert.equal(viewFor({ readerEmail: 'stranger@example.com' }), null)

  // Every one of the four named leads does resolve — the roster is the whole allowlist.
  ACCESS_LEAD_EMAILS.forEach((lead) => {
    assert.ok(viewFor({ readerEmail: lead }), `${lead} is a named lead and should resolve`)
    assert.ok(viewFor({ readerEmail: lead.toUpperCase() }), 'lead matching must not be case-sensitive')
  })
})

test('a super-admin reader who is not a named lead still gets null (§3.4 rule 3)', async () => {
  // `consentedAccessView` takes no role argument at all. That is the design: there is
  // nothing here for a role to short-circuit, so being super-admin cannot create a read
  // path that the member did not grant.
  const superAdminButNotNamed = 'cooperry@umich.edu'

  assert.equal(ACCESS_LEAD_EMAILS.some((lead) => lead === superAdminButNotNamed), false)
  assert.equal(viewFor({ readerEmail: superAdminButNotNamed }), null)

  // Structural, not incidental: `portalAccess.ts` imports nothing from the role module,
  // so no future edit inside it can reach `roleForEmail` or a `super-admin` check.
  const source = await readFile(path.join(import.meta.dirname, '..', 'src', 'lib', 'portalAccess.ts'), 'utf8')
  assert.equal(/^\s*import .*dashboardAccess/m.test(source), false)
  assert.equal(/isSuperAdmin|roleForEmail|DashboardRole/.test(source), false)
})

test('consentedAccessView returns null for rsvp-only sharing without a going RSVP', async () => {
  const rsvpOnly = activeProfile({ appliesTo: 'rsvp-only' })

  assert.equal(viewFor({ profile: rsvpOnly }), null, 'rsvp-only resolved with no RSVP context at all')
  assert.equal(viewFor({ profile: rsvpOnly, hasGoingRsvpForEvent: false }), null)
  assert.ok(viewFor({ profile: rsvpOnly, hasGoingRsvpForEvent: true }))

  // `all-events` is the branch that does not need the RSVP.
  assert.ok(viewFor({ profile: activeProfile({ appliesTo: 'all-events' }) }))
})

// ── Integration: the same rules through /api/portal ───────────────────────────

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
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-portal-consent-'))
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

const eventSeed = (): ClubEventData => ({
  id: '',
  title: 'First general meeting',
  summary: 'Introductions, what the club is for, and what we are building this term.',
  kind: 'meeting',
  format: 'in-person',
  startsAt: '2099-09-15T23:00:00.000Z',
  endsAt: '2099-09-16T00:00:00.000Z',
  locationName: 'Ross R1240',
  locationDetail: 'Step-free route via the east doors on Tappan.',
  virtualUrl: '',
  hostName: 'Andrew Sackett',
  speakerName: '',
  speakerOrg: '',
  capacity: 0,
  rsvpDeadline: '',
  accessCommitments: [{ id: 'step-free-route', state: 'confirmed' }],
  accommodationsContactEmail: 'andsack@umich.edu',
  recordingUrl: '',
  slidesUrl: '',
  roomStatus: 'confirmed',
  internalNotes: '',
})

const execSession = (store: Store, input: { firstName: string; lastName: string; email: string }) => (
  store.upsertAccount({
    firstName: input.firstName,
    lastName: input.lastName,
    uniqname: input.email.replace(/@.*$/, ''),
    email: input.email,
    verifiedVia: 'google',
  })
)

/** A member who has consented to sharing with the four named leads. */
const seedConsentedMember = async (store: Store, appliesTo: 'all-events' | 'rsvp-only') => {
  await store.upsertAccount({
    firstName: 'Maya',
    lastName: 'Karcher',
    uniqname: 'mkarcher',
    email: 'mkarcher@umich.edu',
  })

  await store.saveMemberAccess('mkarcher@umich.edu', {
    needs: [{ id: 'live-captioning', priority: 'required', detail: FORBIDDEN_DETAIL }],
    generalNote: FORBIDDEN_NOTE,
    followUpPreference: 'before-event',
    scope: 'shared-with-leads',
    appliesTo,
    consentText: ACCESS_CONSENT_TEXT,
  }, { email: 'mkarcher@umich.edu', role: 'member' })
}

const adminHalf = (body: Record<string, unknown>) => (
  (body.data as Record<string, unknown>).admin as {
    members: MemberAdminRow[]
    rsvps: EventRsvp[]
  }
)

test('an admin bootstrap for a non-lead exec contains no access data for any member', async () => {
  await withPortalEnv(async (store) => {
    await seedConsentedMember(store, 'all-events')

    const exec = await execSession(store, { firstName: 'Landon', lastName: 'Miller', email: NON_LEAD_EXEC })
    const response = await call('portal.bootstrap', exec.sessionToken)

    assert.equal(response.status, 200, JSON.stringify(response.body))
    const admin = adminHalf(response.body)

    assert.ok(admin.members.length > 0, 'the roster came back empty, so this proves nothing')
    admin.members.forEach((member) => {
      assert.equal('access' in member, false, `${member.email} carried an access key for a non-lead exec`)
    })

    assert.equal(JSON.stringify(response).includes(FORBIDDEN_DETAIL), false)
    assert.equal(JSON.stringify(response).includes(FORBIDDEN_NOTE), false)
  })
})

test('a named lead sees the consented view, and loses it the moment consent is withdrawn', async () => {
  await withPortalEnv(async (store) => {
    await seedConsentedMember(store, 'all-events')

    const lead = await execSession(store, { firstName: 'Lindsey', lastName: 'Ye', email: LEAD })

    const granted = adminHalf((await call('portal.bootstrap', lead.sessionToken)).body)
    const row = granted.members.find((member) => member.email === 'mkarcher@umich.edu')
    assert.ok(row, 'the consented member is missing from the roster')
    assert.ok(row.access, 'a named lead could not read a profile explicitly shared with them')
    assert.equal(row.access.generalNote, FORBIDDEN_NOTE)
    assert.deepEqual(
      Object.keys(row.access).sort(),
      ['followUpPreference', 'generalNote', 'needs', 'preferredName'],
    )

    // Nothing derived from access data is cached, so withdrawal is retroactive.
    await store.withdrawMemberAccessConsent('mkarcher@umich.edu', { email: 'mkarcher@umich.edu', role: 'member' })

    const after = await call('portal.bootstrap', lead.sessionToken)
    const withdrawnRow = adminHalf(after.body).members.find((member) => member.email === 'mkarcher@umich.edu')
    assert.ok(withdrawnRow)
    assert.equal('access' in withdrawnRow, false, 'a withdrawn profile was still readable')
    assert.equal(JSON.stringify(after).includes(FORBIDDEN_DETAIL), false)
    assert.equal(JSON.stringify(after).includes(FORBIDDEN_NOTE), false)
  })
})

test('a granted super-admin who is not a named lead reads no access data', async () => {
  await withPortalEnv(async (store) => {
    await seedConsentedMember(store, 'all-events')

    // Cooper is elevated all the way to super-admin — and is still not one of the four
    // people the member named, so the store gives him nothing.
    const cooper = await execSession(store, { firstName: 'Cooper', lastName: 'Perry', email: 'cooperry@umich.edu' })
    const granted = await store.grantAccountRole(
      { email: 'cooperry@umich.edu', role: 'super-admin', scopes: ['recruiting', 'members', 'events', 'announcements', 'resources', 'system'] },
      adminActor,
    )
    assert.equal(granted.ok, true, JSON.stringify(granted))
    assert.equal(ACCESS_LEAD_EMAILS.some((lead) => lead === 'cooperry@umich.edu'), false)

    const response = await call('portal.bootstrap', cooper.sessionToken)
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.equal((response.body.data as Record<string, unknown>).role, 'super-admin')

    const admin = adminHalf(response.body)
    const row = admin.members.find((member) => member.email === 'mkarcher@umich.edu')
    assert.ok(row, 'the consented member is missing from the roster')
    assert.equal('access' in row, false, 'a super-admin role created a read path §3.4 forbids')
    assert.equal(JSON.stringify(response).includes(FORBIDDEN_DETAIL), false)
    assert.equal(JSON.stringify(response).includes(FORBIDDEN_NOTE), false)
  })
})

test('rsvp-only sharing resolves for a lead only after the member says they are going', async () => {
  await withPortalEnv(async (store) => {
    await seedConsentedMember(store, 'rsvp-only')

    const drafted = await store.saveClubEvent(eventSeed(), adminActor)
    const published = await store.publishClubEvent(drafted.id, adminActor)
    assert.equal(published.ok, true, JSON.stringify(published))

    const lead = await execSession(store, { firstName: 'Lindsey', lastName: 'Ye', email: LEAD })

    const before = adminHalf((await call('portal.bootstrap', lead.sessionToken)).body)
    const beforeRow = before.members.find((member) => member.email === 'mkarcher@umich.edu')
    assert.ok(beforeRow)
    assert.equal('access' in beforeRow, false, 'rsvp-only resolved before the member RSVP\'d')

    // "Interested" is not "going".
    const interested = await store.saveEventRsvp('mkarcher@umich.edu', {
      eventId: drafted.id,
      response: 'interested',
      guestCount: 0,
      accommodationNote: '',
      shareAccommodationWithLeads: false,
    })
    assert.equal(interested.ok, true, JSON.stringify(interested))

    const stillHidden = adminHalf((await call('portal.bootstrap', lead.sessionToken)).body)
      .members.find((member) => member.email === 'mkarcher@umich.edu')
    assert.ok(stillHidden)
    assert.equal('access' in stillHidden, false, 'an "interested" RSVP unlocked rsvp-only sharing')

    const going = await store.saveEventRsvp('mkarcher@umich.edu', {
      eventId: drafted.id,
      response: 'going',
      guestCount: 0,
      accommodationNote: '',
      shareAccommodationWithLeads: false,
    })
    assert.equal(going.ok, true, JSON.stringify(going))

    // A going RSVP unlocks this consent for THAT EVENT — and only there. §3.4 conditions
    // `rsvp-only` on "a going RSVP on the event being planned", and a roster row is not an
    // event. Resolving it on the roster would turn one meeting attended in September into a
    // permanent, club-wide disclosure of that member's access profile.
    const after = adminHalf((await call('portal.bootstrap', lead.sessionToken)).body)

    const afterRow = after.members.find((member) => member.email === 'mkarcher@umich.edu')
    assert.ok(afterRow)
    assert.equal(
      'access' in afterRow,
      false,
      'an rsvp-only profile resolved on the roster, where there is no event being planned',
    )

    const forThisEvent = after.eventAccess[drafted.id] || []
    assert.equal(forThisEvent.length, 1, 'the event the member is going to did not surface their needs')
    assert.equal(forThisEvent[0].generalNote, FORBIDDEN_NOTE)
  })
})

test('an rsvp-only profile never leaks onto an event the member is not going to', async () => {
  await withPortalEnv(async (store) => {
    await seedConsentedMember(store, 'rsvp-only')

    const attending = await store.saveClubEvent(eventSeed(), adminActor)
    assert.equal((await store.publishClubEvent(attending.id, adminActor)).ok, true)
    const other = await store.saveClubEvent({ ...eventSeed(), title: 'A different room' }, adminActor)
    assert.equal((await store.publishClubEvent(other.id, adminActor)).ok, true)

    assert.equal((await store.saveEventRsvp('mkarcher@umich.edu', {
      eventId: attending.id,
      response: 'going',
      guestCount: 0,
    })).ok, true)

    const lead = await execSession(store, { firstName: 'Lindsey', lastName: 'Ye', email: LEAD })
    const workspace = adminHalf((await call('portal.bootstrap', lead.sessionToken)).body)

    assert.equal((workspace.eventAccess[attending.id] || []).length, 1)
    assert.equal(
      (workspace.eventAccess[other.id] || []).length,
      0,
      'access needs surfaced on an event the member never said they were coming to',
    )
  })
})

test('a bare RSVP click does not erase an accommodation note written elsewhere', async () => {
  await withPortalEnv(async (store) => {
    await seedConsentedMember(store, 'all-events')

    const drafted = await store.saveClubEvent(eventSeed(), adminActor)
    assert.equal((await store.publishClubEvent(drafted.id, adminActor)).ok, true)

    // The event-detail screen sends the full shape, note included.
    const written = await store.saveEventRsvp('mkarcher@umich.edu', {
      eventId: drafted.id,
      response: 'going',
      guestCount: 0,
      accommodationNote: 'I need a seat near the door.',
      shareAccommodationWithLeads: true,
    })
    assert.equal(written.ok, true)

    // Member Home and Member Events send only the response. Omitting the note must mean
    // "leave it alone", never "clear it" — this is the most sensitive free-text field in
    // the product and the buttons that omit it are the primary call to action.
    const changed = await store.saveEventRsvp('mkarcher@umich.edu', {
      eventId: drafted.id,
      response: 'interested',
      guestCount: 0,
    })
    assert.equal(changed.ok, true)
    assert.equal(changed.ok && changed.rsvp.accommodationNote, 'I need a seat near the door.')
    assert.equal(changed.ok && changed.rsvp.shareAccommodationWithLeads, true)

    // An explicit empty string is still a real clear.
    const cleared = await store.saveEventRsvp('mkarcher@umich.edu', {
      eventId: drafted.id,
      response: 'going',
      guestCount: 0,
      accommodationNote: '',
      shareAccommodationWithLeads: false,
    })
    assert.equal(cleared.ok && cleared.rsvp.accommodationNote, '')
  })
})

test('a per-event accommodation note reaches a named lead and nobody else', async () => {
  await withPortalEnv(async (store) => {
    await store.upsertAccount({
      firstName: 'Maya',
      lastName: 'Karcher',
      uniqname: 'mkarcher',
      email: 'mkarcher@umich.edu',
    })

    const drafted = await store.saveClubEvent(eventSeed(), adminActor)
    assert.equal((await store.publishClubEvent(drafted.id, adminActor)).ok, true)

    const shared = await store.saveEventRsvp('mkarcher@umich.edu', {
      eventId: drafted.id,
      response: 'going',
      guestCount: 0,
      accommodationNote: FORBIDDEN_RSVP_NOTE,
      shareAccommodationWithLeads: true,
    })
    assert.equal(shared.ok, true, JSON.stringify(shared))

    const nonLead = await execSession(store, { firstName: 'Landon', lastName: 'Miller', email: NON_LEAD_EXEC })
    const nonLeadResponse = await call('portal.bootstrap', nonLead.sessionToken)
    const nonLeadRsvp = adminHalf(nonLeadResponse.body).rsvps.find((rsvp) => rsvp.email === 'mkarcher@umich.edu')
    assert.ok(nonLeadRsvp, 'the RSVP row is missing entirely')
    assert.equal(nonLeadRsvp.accommodationNote, '', 'a non-lead exec read a shared accommodation note')
    assert.equal(JSON.stringify(nonLeadResponse).includes(FORBIDDEN_RSVP_NOTE), false)

    const lead = await execSession(store, { firstName: 'Lindsey', lastName: 'Ye', email: LEAD })
    const leadRsvp = adminHalf((await call('portal.bootstrap', lead.sessionToken)).body)
      .rsvps.find((rsvp) => rsvp.email === 'mkarcher@umich.edu')
    assert.ok(leadRsvp)
    assert.equal(leadRsvp.accommodationNote, FORBIDDEN_RSVP_NOTE)
  })
})

test('an unshared accommodation note reaches nobody, not even a named lead', async () => {
  await withPortalEnv(async (store) => {
    await store.upsertAccount({
      firstName: 'Maya',
      lastName: 'Karcher',
      uniqname: 'mkarcher',
      email: 'mkarcher@umich.edu',
    })

    const drafted = await store.saveClubEvent(eventSeed(), adminActor)
    assert.equal((await store.publishClubEvent(drafted.id, adminActor)).ok, true)

    const kept = await store.saveEventRsvp('mkarcher@umich.edu', {
      eventId: drafted.id,
      response: 'going',
      guestCount: 0,
      accommodationNote: FORBIDDEN_RSVP_NOTE,
      shareAccommodationWithLeads: false,
    })
    assert.equal(kept.ok, true, JSON.stringify(kept))

    const lead = await execSession(store, { firstName: 'Lindsey', lastName: 'Ye', email: LEAD })
    const response = await call('portal.bootstrap', lead.sessionToken)
    const rsvp = adminHalf(response.body).rsvps.find((row) => row.email === 'mkarcher@umich.edu')

    assert.ok(rsvp)
    assert.equal(rsvp.accommodationNote, '')
    assert.equal(JSON.stringify(response).includes(FORBIDDEN_RSVP_NOTE), false)
  })
})
