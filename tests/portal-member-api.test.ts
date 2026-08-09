import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { handlePortalRequest } from '../server/portalApi.ts'
import { ACCESS_CONSENT_TEXT } from '../src/lib/portalAccess.ts'
import type { AccessProfile } from '../src/lib/portalAccess.ts'
import { MEMBER_EDITABLE_FIELDS } from '../src/lib/portalMembers.ts'
import type { ClubEventData } from '../src/lib/portalEvents.ts'

/**
 * T4 — the member half of `/api/portal` (spec §9).
 *
 * Four things are load-bearing here and every one of them is a privacy boundary
 * rather than a feature:
 *
 *  · `member.saveProfile` writes ONLY `MEMBER_EDITABLE_FIELDS`. A member cannot
 *    promote themselves to `active`, and cannot write the admin-only note field.
 *  · `member.saveAccess` stores the consent wording verbatim, so what someone
 *    agreed to is recoverable a year later without guessing at a version number.
 *  · Withdrawal actually withdraws — scope back to private, `withdrawnAt`
 *    stamped — because every read path re-evaluates it live.
 *  · `event.rsvp` writes the CALLER's row. An email in the payload is decoration.
 */

/**
 * Mandatory env discipline: without deleting BLOB_READ_WRITE_TOKEN the store talks to real
 * Vercel Blob, and without UBLDA_LOCAL_DATA_FILE it writes into the developer's own data.
 */
const withPortalEnv = async (
  run: (store: ReturnType<typeof createLocalRecruitingStore>) => Promise<void>,
) => {
  const keys = ['BLOB_READ_WRITE_TOKEN', 'UBLDA_LOCAL_DATA_FILE']
  const original = new Map<string, string | undefined>(keys.map((key) => [key, process.env[key]]))

  delete process.env.BLOB_READ_WRITE_TOKEN
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-portal-member-'))
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

const call = (action: string, sessionToken: string, payload: Record<string, unknown> = {}) => (
  handlePortalRequest({ method: 'POST', body: { action, sessionToken, payload } })
)

const dataOf = (response: { status: number; body: Record<string, unknown> }) => {
  assert.equal(response.status, 200, `expected 200, got ${response.status}: ${JSON.stringify(response.body)}`)
  assert.equal(response.body.success, true)
  return response.body.data as Record<string, unknown>
}

const memberSession = (store: ReturnType<typeof createLocalRecruitingStore>, input: {
  firstName: string
  lastName: string
  uniqname: string
  email: string
}) => store.upsertAccount(input, 'a-real-password')

const publishedEventSeed = (title: string): ClubEventData => ({
  id: '',
  title,
  summary: 'A real seeded event so the RSVP path has something to write against.',
  kind: 'fireside',
  format: 'in-person',
  startsAt: '2099-10-01T23:00:00.000Z',
  endsAt: '2099-10-02T00:00:00.000Z',
  locationName: 'Ross R1240',
  locationDetail: 'Step-free route via the east doors on Tappan',
  virtualUrl: '',
  hostName: 'Andrew Sackett',
  speakerName: '',
  speakerOrg: '',
  capacity: 0,
  rsvpDeadline: '',
  accessCommitments: [
    { id: 'step-free-route', state: 'confirmed' },
    { id: 'live-captions', state: 'not-available' },
  ],
  accommodationsContactEmail: 'andsack@umich.edu',
  recordingUrl: '',
  slidesUrl: '',
  roomStatus: 'confirmed',
  internalNotes: '',
})

const seedPublishedEvent = async (
  store: ReturnType<typeof createLocalRecruitingStore>,
  title = 'Fireside chat',
) => {
  const actor = { email: 'sbodine@umich.edu', role: 'super-admin' as const }
  const drafted = await store.saveClubEvent(publishedEventSeed(title), actor)
  const published = await store.publishClubEvent(drafted.id, actor)
  assert.equal(published.ok, true, `seed event did not publish: ${JSON.stringify(published)}`)
  return drafted.id
}

test('member.saveProfile writes only MEMBER_EDITABLE_FIELDS', async () => {
  await withPortalEnv(async (store) => {
    const session = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    const response = await call('member.saveProfile', session.sessionToken, {
      // Allowed.
      preferredName: 'Tom',
      school: 'Ross',
      interests: ['consulting', 'speakers'],
      dietary: 'No red meat',
      // Not allowed — admin-only fields smuggled into a member payload.
      status: 'active',
      notes: 'FORBIDDEN_ADMIN_NOTE',
      source: 'recruiting',
      firstName: 'Renamed',
      email: 'someone.else@umich.edu',
      updatedBy: 'nobody@umich.edu',
    })

    const profile = dataOf(response).profile as Record<string, unknown>

    // The allowed half landed.
    assert.equal(profile.preferredName, 'Tom')
    assert.equal(profile.school, 'Ross')
    assert.deepEqual(profile.interests, ['consulting', 'speakers'])
    assert.equal(profile.dietary, 'No red meat')

    // The disallowed half did not, in the response…
    assert.equal(profile.status, 'prospect')
    // A record the member created by editing their own profile is a self-signup. It must not
    // be stamped 'manual', which the roster drawer renders as "Added by an officer" — no
    // officer touched this row, and the roster should not assert otherwise.
    assert.equal(profile.source, 'self-signup')
    assert.equal(profile.firstName, 'Tommy')
    assert.equal(profile.email, 'thartnet@umich.edu')
    assert.equal('notes' in profile, false)
    assert.equal('updatedBy' in profile, false)
    assert.equal(JSON.stringify(response.body).includes('FORBIDDEN_ADMIN_NOTE'), false)

    // …nor in the store, which is the assertion that actually matters.
    const workspace = await store.listPortalWorkspace()
    const stored = workspace.memberProfiles.find((row) => row.email === 'thartnet@umich.edu')
    assert.ok(stored, 'the profile was not written at all')
    assert.equal(stored.status, 'prospect')
    assert.equal(stored.notes, '')
    assert.equal(stored.source, 'self-signup')
    assert.equal(stored.firstName, 'Tommy')
    assert.equal(workspace.memberProfiles.some((row) => row.email === 'someone.else@umich.edu'), false)

    // The allowlist and the field list cannot drift apart silently.
    assert.deepEqual([...MEMBER_EDITABLE_FIELDS], [
      'preferredName', 'pronouns', 'year', 'school', 'major', 'gradYear',
      'interests', 'linkedinUrl', 'phone', 'dietary',
    ])
    assert.equal(MEMBER_EDITABLE_FIELDS.some((field) => field === 'status'), false)
    assert.equal(MEMBER_EDITABLE_FIELDS.some((field) => field === 'notes'), false)
  })
})

test('member.saveProfile cannot write access data down the profile path', async () => {
  await withPortalEnv(async (store) => {
    const session = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    await call('member.saveProfile', session.sessionToken, {
      preferredName: 'Tom',
      access: {
        needs: [{ id: 'live-captioning', priority: 'required', detail: 'FORBIDDEN_ACCESS_DETAIL' }],
        scope: 'shared-with-leads',
      },
    })

    const workspace = await store.listPortalWorkspace()
    const stored = workspace.memberProfiles.find((row) => row.email === 'thartnet@umich.edu')
    assert.ok(stored)
    assert.deepEqual(stored.access.needs, [])
    assert.equal(stored.access.scope, 'private')
  })
})

test('member.saveAccess stores the consent wording verbatim and stamps consentAt', async () => {
  await withPortalEnv(async (store) => {
    const session = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    const response = await call('member.saveAccess', session.sessionToken, {
      needs: [
        { id: 'live-captioning', priority: 'required', detail: 'Auto-captions are not enough.' },
        { id: 'quiet-space', priority: 'helpful', detail: '' },
      ],
      generalNote: 'A seat near the door means I can leave without explaining.',
      followUpPreference: 'before-event',
      scope: 'shared-with-leads',
      appliesTo: 'rsvp-only',
      consentText: ACCESS_CONSENT_TEXT,
    })

    const access = dataOf(response).access as AccessProfile

    // Verbatim — not normalized, not truncated, not re-worded.
    assert.equal(access.consentText, ACCESS_CONSENT_TEXT)
    assert.equal(access.scope, 'shared-with-leads')
    assert.equal(access.appliesTo, 'rsvp-only')
    assert.equal(access.withdrawnAt, '')
    assert.ok(access.consentAt, 'consentAt was not stamped')
    assert.equal(Number.isNaN(Date.parse(access.consentAt)), false)
    assert.ok(Date.parse(access.expiresAt) > Date.parse(access.consentAt), 'consent expiry is not in the future')
    assert.equal(access.needs.length, 2)
    assert.equal(access.needs[0].priority, 'required')

    const workspace = await store.listPortalWorkspace()
    const stored = workspace.memberProfiles.find((row) => row.email === 'thartnet@umich.edu')
    assert.ok(stored)
    assert.equal(stored.access.consentText, ACCESS_CONSENT_TEXT)
    assert.equal(stored.access.generalNote, 'A seat near the door means I can leave without explaining.')
  })
})

test('member.saveAccess is self-only — an email in the payload is ignored', async () => {
  await withPortalEnv(async (store) => {
    const caller = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })
    await memberSession(store, {
      firstName: 'Other', lastName: 'Member', uniqname: 'othermbr', email: 'othermbr@umich.edu',
    })

    await call('member.saveAccess', caller.sessionToken, {
      email: 'othermbr@umich.edu',
      needs: [{ id: 'step-free-entry', priority: 'required', detail: '' }],
      generalNote: '',
      followUpPreference: 'email',
      scope: 'shared-with-leads',
      appliesTo: 'all-events',
      consentText: ACCESS_CONSENT_TEXT,
    })

    const workspace = await store.listPortalWorkspace()
    const mine = workspace.memberProfiles.find((row) => row.email === 'thartnet@umich.edu')
    const theirs = workspace.memberProfiles.find((row) => row.email === 'othermbr@umich.edu')

    assert.ok(mine)
    assert.equal(mine.access.needs.length, 1)
    assert.equal(mine.access.scope, 'shared-with-leads')
    // The target either has no record at all, or an untouched private one.
    assert.equal(theirs?.access.scope ?? 'private', 'private')
    assert.deepEqual(theirs?.access.needs ?? [], [])
  })
})

test('member.withdrawAccessConsent sets scope private and stamps withdrawnAt', async () => {
  await withPortalEnv(async (store) => {
    const session = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    await call('member.saveAccess', session.sessionToken, {
      needs: [{ id: 'asl-interpreter', priority: 'required', detail: '' }],
      generalNote: 'Kept on purpose.',
      followUpPreference: 'email',
      scope: 'shared-with-leads',
      appliesTo: 'all-events',
      consentText: ACCESS_CONSENT_TEXT,
    })

    const withdrawn = dataOf(await call('member.withdrawAccessConsent', session.sessionToken)).access as AccessProfile

    assert.equal(withdrawn.scope, 'private')
    assert.ok(withdrawn.withdrawnAt, 'withdrawnAt was not stamped')
    assert.equal(Number.isNaN(Date.parse(withdrawn.withdrawnAt)), false)
    // Withdrawal stops sharing. It does not delete what the member wrote.
    assert.equal(withdrawn.needs.length, 1)
    assert.equal(withdrawn.generalNote, 'Kept on purpose.')

    const workspace = await store.listPortalWorkspace()
    const stored = workspace.memberProfiles.find((row) => row.email === 'thartnet@umich.edu')
    assert.ok(stored)
    assert.equal(stored.access.scope, 'private')
    assert.ok(stored.access.withdrawnAt)
  })
})

test('event.rsvp writes the caller row even when the payload names someone else', async () => {
  await withPortalEnv(async (store) => {
    const eventId = await seedPublishedEvent(store)

    const caller = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })
    await memberSession(store, {
      firstName: 'Other', lastName: 'Member', uniqname: 'othermbr', email: 'othermbr@umich.edu',
    })

    const data = dataOf(await call('event.rsvp', caller.sessionToken, {
      eventId,
      // Every one of these names the other member. None of them may be honoured.
      email: 'othermbr@umich.edu',
      id: `${eventId}:othermbr@umich.edu`,
      response: 'going',
      guestCount: 1,
      accommodationNote: 'A seat near the door, please.',
      shareAccommodationWithLeads: true,
    }))

    const rsvp = data.rsvp as Record<string, unknown>
    assert.equal(rsvp.email, 'thartnet@umich.edu')
    assert.equal(rsvp.id, `${eventId}:thartnet@umich.edu`)
    assert.equal(rsvp.response, 'going')
    assert.equal(rsvp.guestCount, 1)
    // The self view never carries the admin-only stamp.
    assert.equal('checkedInBy' in rsvp, false)

    const workspace = await store.listPortalWorkspace()
    const rows = workspace.eventRsvps.filter((row) => row.eventId === eventId)
    assert.equal(rows.length, 1, `expected exactly one RSVP row, got ${rows.length}`)
    assert.equal(rows[0].email, 'thartnet@umich.edu')
    assert.equal(workspace.eventRsvps.some((row) => row.email === 'othermbr@umich.edu'), false)
  })
})

test('event.rsvp is refused on an event that is not published', async () => {
  await withPortalEnv(async (store) => {
    const actor = { email: 'sbodine@umich.edu', role: 'super-admin' as const }
    const draft = await store.saveClubEvent(publishedEventSeed('Draft night'), actor)

    const session = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    const response = await call('event.rsvp', session.sessionToken, {
      eventId: draft.id, response: 'going', guestCount: 0,
    })

    assert.equal(response.status, 400)
    assert.equal(response.body.success, undefined)
    assert.match(String(response.body.error), /not published/i)
    assert.deepEqual((await store.listPortalWorkspace()).eventRsvps, [])
  })
})

test('a member bootstrap releases the join link only once the member says they are going', async () => {
  await withPortalEnv(async (store) => {
    const actor = { email: 'sbodine@umich.edu', role: 'super-admin' as const }
    const drafted = await store.saveClubEvent({
      ...publishedEventSeed('Virtual fireside'),
      format: 'virtual',
      virtualUrl: 'https://umich.zoom.us/j/FORBIDDEN_JOIN_LINK',
    }, actor)
    const published = await store.publishClubEvent(drafted.id, actor)
    assert.equal(published.ok, true)

    const session = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    const before = await call('portal.bootstrap', session.sessionToken)
    assert.equal(JSON.stringify(before.body).includes('FORBIDDEN_JOIN_LINK'), false)

    await call('event.rsvp', session.sessionToken, {
      eventId: drafted.id, response: 'interested', guestCount: 0,
    })
    const interested = await call('portal.bootstrap', session.sessionToken)
    assert.equal(JSON.stringify(interested.body).includes('FORBIDDEN_JOIN_LINK'), false)

    await call('event.rsvp', session.sessionToken, {
      eventId: drafted.id, response: 'going', guestCount: 0,
    })
    const going = await call('portal.bootstrap', session.sessionToken)
    assert.equal(JSON.stringify(going.body).includes('FORBIDDEN_JOIN_LINK'), true)
  })
})
