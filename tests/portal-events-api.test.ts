import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { handlePortalRequest } from '../server/portalApi.ts'
import { ACCESS_COMMITMENT_CATALOG } from '../src/lib/portalEvents.ts'
import type { ClubEvent, EventRsvp } from '../src/lib/portalEvents.ts'

/**
 * Spec §9, T2 row. The five things this file exists to pin:
 *
 *  1. `admin.event.upsert` cannot set `status: 'published'`.
 *  2. `admin.event.publish` returns 400 with a `blockers` array when the event
 *     has not said what it can provide access-wise — and succeeds once it has.
 *  3. `admin.event.publish` from a non-publisher exec returns 403 even when the
 *     client forces the request past its own disabled button.
 *  4. `event.rsvp` on a draft returns 400.
 *  5. `admin.event.checkIn` creates the RSVP row for a walk-in.
 *
 * Test files never import each other (spec §9), so the response fake and the
 * env helper are duplicated here rather than extracted.
 */

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
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-portal-events-'))
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

type Store = ReturnType<typeof createLocalRecruitingStore>

const publisherSession = (store: Store) => store.upsertAccount({
  firstName: 'Alexa',
  lastName: 'Chiang',
  uniqname: 'atchiang',
  email: 'atchiang@umich.edu',
  role: 'exec',
  verifiedVia: 'google',
})

/** Events + announcements scope, and no publish rights. */
const eventsExecSession = (store: Store) => store.upsertAccount({
  firstName: 'Andrew',
  lastName: 'Sackett',
  uniqname: 'andsack',
  email: 'andsack@umich.edu',
  role: 'exec',
  verifiedVia: 'google',
})

const memberSession = (store: Store) => store.upsertAccount({
  firstName: 'Tommy',
  lastName: 'Hartnett',
  uniqname: 'thartnet',
  email: 'thartnet@umich.edu',
}, 'a-real-password')

const call = (action: string, sessionToken: string, payload: Record<string, unknown> = {}) => (
  handlePortalRequest({ method: 'POST', body: { action, sessionToken, payload } })
)

const eventFields = (overrides: Record<string, unknown> = {}) => ({
  title: 'Microsoft fireside',
  summary: 'Forty minutes with the accessibility engineering team, then questions.',
  kind: 'fireside',
  format: 'in-person',
  startsAt: '2026-10-01T23:00:00.000Z',
  endsAt: '2026-10-02T00:30:00.000Z',
  locationName: 'Ross R1240',
  locationDetail: 'Step-free route via the east doors on Tappan.',
  virtualUrl: '',
  hostName: 'Andrew Sackett',
  speakerName: '',
  speakerOrg: '',
  capacity: 40,
  rsvpDeadline: '',
  accessCommitments: [],
  accommodationsContactEmail: 'andsack@umich.edu',
  recordingUrl: '',
  slidesUrl: '',
  roomStatus: 'requested',
  internalNotes: '',
  ...overrides,
})

/** Every catalog item answered — which is what "state what you can provide" means. */
const everyCommitmentStated = ACCESS_COMMITMENT_CATALOG.map((id, index) => ({
  id,
  state: index % 3 === 0 ? 'not-available' : index % 3 === 1 ? 'on-request' : 'confirmed',
}))

const eventOf = (body: Record<string, unknown>) => (body.data as { event: ClubEvent }).event

test('admin.event.upsert cannot set a published status, on create or on edit', async () => {
  await withPortalEnv(async (store) => {
    const session = await eventsExecSession(store)

    const created = await call('admin.event.upsert', session.sessionToken, eventFields({
      status: 'published',
      publishedAt: '2026-01-01T00:00:00.000Z',
      publishedBy: 'andsack@umich.edu',
    }))

    assert.equal(created.status, 200)
    const draft = eventOf(created.body)
    assert.equal(draft.status, 'draft')
    assert.equal(draft.publishedAt, '')
    assert.equal(draft.publishedBy, '')

    // And it is a draft in the store, not merely in the response projection.
    const workspace = await store.listPortalWorkspace()
    assert.equal(workspace.clubEvents.length, 1)
    assert.equal(workspace.clubEvents[0].status, 'draft')

    // The publisher publishes it, then an edit tries to demote it back.
    const publisher = await publisherSession(store)
    await call('admin.event.upsert', session.sessionToken, eventFields({
      id: draft.id,
      accessCommitments: everyCommitmentStated,
    }))
    const published = await call('admin.event.publish', publisher.sessionToken, { eventId: draft.id })
    assert.equal(published.status, 200)
    assert.equal(eventOf(published.body).status, 'published')

    const demoted = await call('admin.event.upsert', session.sessionToken, eventFields({
      id: draft.id,
      status: 'draft',
      accessCommitments: everyCommitmentStated,
    }))
    assert.equal(eventOf(demoted.body).status, 'published')
  })
})

test('publishing an event with no access commitments returns 400 and names every blocker', async () => {
  await withPortalEnv(async (store) => {
    const exec = await eventsExecSession(store)
    const publisher = await publisherSession(store)

    // No commitments, no accommodations contact, nobody running it.
    const created = await call('admin.event.upsert', exec.sessionToken, eventFields({
      accessCommitments: [],
      accommodationsContactEmail: '',
      hostName: '',
    }))
    const draft = eventOf(created.body)

    const refused = await call('admin.event.publish', publisher.sessionToken, { eventId: draft.id })

    assert.equal(refused.status, 400)
    assert.equal(refused.body.success, undefined)
    const blockers = refused.body.blockers as string[]
    assert.ok(Array.isArray(blockers))
    assert.equal(blockers.length, 3)
    assert.ok(blockers.some((blocker) => /access-wise/i.test(blocker)), blockers.join(' | '))
    assert.ok(blockers.some((blocker) => /accommodations contact/i.test(blocker)), blockers.join(' | '))
    assert.ok(blockers.some((blocker) => /running this event/i.test(blocker)), blockers.join(' | '))
    // The first blocker is also the human sentence, so a toast is never empty.
    assert.equal(refused.body.error, blockers[0])

    // Still a draft. A refused publish changes nothing.
    const afterRefusal = await store.listPortalWorkspace()
    assert.equal(afterRefusal.clubEvents[0].status, 'draft')

    // Fix exactly what the blockers named, and it publishes.
    await call('admin.event.upsert', exec.sessionToken, eventFields({
      id: draft.id,
      accessCommitments: everyCommitmentStated,
    }))
    const published = await call('admin.event.publish', publisher.sessionToken, { eventId: draft.id })

    assert.equal(published.status, 200)
    const live = eventOf(published.body)
    assert.equal(live.status, 'published')
    assert.equal(live.publishedBy, 'atchiang@umich.edu')
    assert.ok(live.publishedAt)
    assert.equal(live.accessCommitments.length, ACCESS_COMMITMENT_CATALOG.length)
    // "not available" is stated, never omitted — that honesty is the point.
    assert.ok(live.accessCommitments.some((commitment) => commitment.state === 'not-available'))

    const audit = await store.readAuditLog(50)
    assert.equal(audit.filter((entry) => entry.action === 'admin.event.publish').length, 1)
  })
})

test('a non-publisher exec is refused 403 even when the client forces the publish', async () => {
  await withPortalEnv(async (store) => {
    const exec = await eventsExecSession(store)

    // A perfectly publishable event: the only thing missing is the authority.
    const created = await call('admin.event.upsert', exec.sessionToken, eventFields({
      accessCommitments: everyCommitmentStated,
    }))
    const draft = eventOf(created.body)

    const forced = await call('admin.event.publish', exec.sessionToken, {
      eventId: draft.id,
      // Whatever the client claims about itself is worth nothing here.
      canPublish: true,
      status: 'published',
      role: 'super-admin',
    })

    assert.equal(forced.status, 403)
    assert.equal(forced.body.success, undefined)

    const workspace = await store.listPortalWorkspace()
    assert.equal(workspace.clubEvents[0].status, 'draft')
    assert.equal(workspace.clubEvents[0].publishedBy, '')

    // A plain member gets 403 too, and a signed-out caller gets 401.
    const member = await memberSession(store)
    assert.equal((await call('admin.event.publish', member.sessionToken, { eventId: draft.id })).status, 403)
    assert.equal((await call('admin.event.publish', '', { eventId: draft.id })).status, 401)
  })
})

test('event.rsvp on a draft returns 400 and starts working the moment it is published', async () => {
  await withPortalEnv(async (store) => {
    const exec = await eventsExecSession(store)
    const publisher = await publisherSession(store)
    const member = await memberSession(store)

    const created = await call('admin.event.upsert', exec.sessionToken, eventFields({
      accessCommitments: everyCommitmentStated,
    }))
    const draft = eventOf(created.body)

    const tooEarly = await call('event.rsvp', member.sessionToken, {
      eventId: draft.id,
      response: 'going',
      guestCount: 0,
      accommodationNote: '',
      shareAccommodationWithLeads: false,
    })

    assert.equal(tooEarly.status, 400)
    assert.match(String(tooEarly.body.error), /not published/i)
    assert.deepEqual(await store.listPortalWorkspace().then((data) => data.eventRsvps), [])

    await call('admin.event.publish', publisher.sessionToken, { eventId: draft.id })

    const accepted = await call('event.rsvp', member.sessionToken, {
      eventId: draft.id,
      response: 'going',
      guestCount: 1,
      accommodationNote: '',
      shareAccommodationWithLeads: false,
    })

    assert.equal(accepted.status, 200)
    const data = accepted.body.data as { rsvp: EventRsvp; event: { rsvpCount: number } }
    assert.equal(data.rsvp.email, 'thartnet@umich.edu')
    assert.equal(data.rsvp.response, 'going')
    assert.equal(data.event.rsvpCount, 1)
    // A member's own view of their RSVP never carries who checked them in.
    assert.equal('checkedInBy' in data.rsvp, false)
  })
})

test('admin.event.checkIn creates the RSVP row for a walk-in and can be undone', async () => {
  await withPortalEnv(async (store) => {
    const exec = await eventsExecSession(store)

    const created = await call('admin.event.upsert', exec.sessionToken, eventFields({
      accessCommitments: everyCommitmentStated,
    }))
    const draft = eventOf(created.body)

    const before = await store.listPortalWorkspace()
    assert.deepEqual(before.eventRsvps, [])

    const walkIn = await call('admin.event.checkIn', exec.sessionToken, {
      eventId: draft.id,
      email: 'Walkin@umich.edu',
      checkedIn: true,
    })

    assert.equal(walkIn.status, 200)
    const rsvp = (walkIn.body.data as { rsvp: EventRsvp }).rsvp
    assert.equal(rsvp.email, 'walkin@umich.edu')
    assert.equal(rsvp.eventId, draft.id)
    assert.equal(rsvp.response, 'going')
    assert.ok(rsvp.checkedInAt)
    assert.equal(rsvp.checkedInBy, 'andsack@umich.edu')

    const after = await store.listPortalWorkspace()
    assert.equal(after.eventRsvps.length, 1)
    assert.equal(after.eventRsvps[0].id, `${draft.id}:walkin@umich.edu`)

    // Undo clears both stamps and leaves the row where it is.
    const undone = await call('admin.event.checkIn', exec.sessionToken, {
      eventId: draft.id,
      email: 'walkin@umich.edu',
      checkedIn: false,
    })
    assert.equal(undone.status, 200)
    assert.equal((undone.body.data as { rsvp: EventRsvp }).rsvp.checkedInAt, '')
    assert.equal((await store.listPortalWorkspace()).eventRsvps.length, 1)

    // Both actions are audited, inside the same write as the change itself.
    const audit = await store.readAuditLog(50)
    assert.equal(audit.filter((entry) => entry.action === 'admin.event.checkIn').length, 2)

    // And a member cannot check anybody in, whatever the button says.
    const member = await memberSession(store)
    const refused = await call('admin.event.checkIn', member.sessionToken, {
      eventId: draft.id,
      email: 'walkin@umich.edu',
      checkedIn: true,
    })
    assert.equal(refused.status, 403)
  })
})

test('cancelling keeps the event visible and closes RSVPs', async () => {
  await withPortalEnv(async (store) => {
    const exec = await eventsExecSession(store)
    const publisher = await publisherSession(store)
    const member = await memberSession(store)

    const created = await call('admin.event.upsert', exec.sessionToken, eventFields({
      accessCommitments: everyCommitmentStated,
    }))
    const draft = eventOf(created.body)
    await call('admin.event.publish', publisher.sessionToken, { eventId: draft.id })

    const cancelled = await call('admin.event.cancel', exec.sessionToken, {
      eventId: draft.id,
      reason: 'The room fell through.',
    })

    assert.equal(cancelled.status, 200)
    assert.equal(eventOf(cancelled.body).status, 'cancelled')
    assert.match(eventOf(cancelled.body).internalNotes, /The room fell through/)

    const refused = await call('event.rsvp', member.sessionToken, {
      eventId: draft.id,
      response: 'going',
      guestCount: 0,
      accommodationNote: '',
      shareAccommodationWithLeads: false,
    })
    assert.equal(refused.status, 400)
    assert.match(String(refused.body.error), /cancelled/i)
  })
})
