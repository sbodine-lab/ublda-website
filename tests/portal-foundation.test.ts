import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import {
  ADMIN_ACCOUNTS,
  PUBLISH_APPROVERS,
  canPublish,
  effectiveRoleForAccount,
  roleForEmail,
  scopesForEmail,
} from '../src/lib/dashboardAccess.ts'
import {
  ACCESS_CONSENT_TEXT,
  ACCESS_LEAD_EMAILS,
  ACCESS_NEED_CATALOG,
  emptyAccessProfile,
  validateAccessProfilePayload,
} from '../src/lib/portalAccess.ts'
import { AUDIT_LOG_LIMIT, appendAudit, buildAuditEntry } from '../src/lib/portalAudit.ts'
import type { AuditEntry } from '../src/lib/portalAudit.ts'
import {
  validateMemberAdminPayload,
  validateMemberSelfPayload,
} from '../src/lib/portalMembers.ts'
import type { ClubEvent, ClubEventData } from '../src/lib/portalEvents.ts'
import {
  buildClubEvent,
  canPublishEvent,
  validateClubEventPayload,
  validateRsvpPayload,
} from '../src/lib/portalEvents.ts'
import { validateAnnouncementPayload } from '../src/lib/portalAnnouncements.ts'
import { validatePortalResourcePayload } from '../src/lib/portalResources.ts'

const ACTOR = { email: 'sbodine@umich.edu', role: 'super-admin' as const }

const eventData = (overrides: Partial<ClubEventData> = {}): ClubEventData => ({
  id: '',
  title: 'Microsoft fireside',
  summary: 'A conversation about accessible hiring.',
  kind: 'fireside',
  format: 'in-person',
  startsAt: '2026-10-01T23:00:00.000Z',
  endsAt: '2026-10-02T00:00:00.000Z',
  locationName: 'Ross R1240',
  locationDetail: 'Step-free route via the east doors on Tappan',
  virtualUrl: '',
  hostName: 'Andrew Sackett',
  speakerName: '',
  speakerOrg: '',
  capacity: 0,
  rsvpDeadline: '',
  accessCommitments: [{ id: 'live-captions', state: 'confirmed' }],
  accommodationsContactEmail: 'andsack@umich.edu',
  recordingUrl: '',
  slidesUrl: '',
  roomStatus: 'requested',
  internalNotes: '',
  ...overrides,
})

const withStore = async (
  run: (store: ReturnType<typeof createLocalRecruitingStore>, dataPath: string) => Promise<void>,
  seed?: Record<string, unknown>,
) => {
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  delete process.env.BLOB_READ_WRITE_TOKEN

  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-portal-'))
  const dataPath = path.join(dir, 'recruiting.json')
  process.env.UBLDA_LOCAL_DATA_FILE = dataPath

  try {
    if (seed) {
      await writeFile(dataPath, `${JSON.stringify(seed, null, 2)}\n`)
    }
    await run(createLocalRecruitingStore(dataPath), dataPath)
  } finally {
    if (originalBlobToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken
    }
    if (originalDataFile === undefined) {
      delete process.env.UBLDA_LOCAL_DATA_FILE
    } else {
      process.env.UBLDA_LOCAL_DATA_FILE = originalDataFile
    }
    await rm(dir, { recursive: true, force: true })
  }
}

test('reads a legacy document that predates every portal collection', async () => {
  await withStore(async (store, dataPath) => {
    const workspace = await store.listPortalWorkspace()

    assert.deepEqual(workspace.memberProfiles, [])
    assert.deepEqual(workspace.clubEvents, [])
    assert.deepEqual(workspace.eventRsvps, [])
    assert.deepEqual(workspace.announcements, [])
    assert.deepEqual(workspace.resources, [])
    assert.deepEqual(await store.readAuditLog(10), [])

    // The preview-admin migration hook also has to survive a write on the legacy shape.
    await store.savePortalResource({
      id: '',
      title: 'Accessible event checklist',
      description: 'What we confirm before a room is booked.',
      href: 'https://ublda.org/accessible-event-checklist',
      category: 'accessibility',
      formatNote: 'Tagged PDF, screen-reader tested',
      audience: 'all-members',
      published: true,
    }, ACTOR)

    const raw = JSON.parse(await readFile(dataPath, 'utf8')) as Record<string, unknown>
    assert.equal(raw.version, 1)
    assert.equal(Object.keys(raw.portalResources as object).length, 1)
    assert.equal((raw.auditLog as unknown[]).length, 1)
  }, {
    version: 1,
    accounts: {},
    sessions: {},
    candidates: {},
    interviewerAvailability: {},
  })
})

test('round-trips every portal collection through a fresh store instance', async () => {
  await withStore(async (store, dataPath) => {
    await store.upsertAccount({
      firstName: 'Tommy',
      lastName: 'Hartnett',
      uniqname: 'thartnet',
      email: 'thartnet@umich.edu',
    }, 'festifall-signup-password')

    await store.bulkAdmitMembers({
      emails: ['thartnet@umich.edu'],
      status: 'active',
      source: 'festifall',
      year: 'Sophomore',
      school: 'Ross',
    }, ACTOR)

    await store.saveMemberProfile('thartnet@umich.edu', { notes: 'Met at Festifall.' }, ACTOR)

    const draft = await store.saveClubEvent(eventData(), ACTOR)
    const published = await store.publishClubEvent(draft.id, ACTOR)
    assert.equal(published.ok, true)

    const rsvp = await store.saveEventRsvp('thartnet@umich.edu', {
      eventId: draft.id,
      response: 'going',
      guestCount: 1,
      accommodationNote: 'A seat near the door works best.',
      shareAccommodationWithLeads: true,
    })
    assert.equal(rsvp.ok, true)
    assert.equal(rsvp.ok && rsvp.rsvpCount, 1)

    const checkIn = await store.checkInMember(draft.id, 'walkin@umich.edu', true, ACTOR)
    assert.equal(checkIn.ok, true)
    assert.equal(checkIn.ok && checkIn.rsvp.response, 'going')
    assert.equal(checkIn.ok && Boolean(checkIn.rsvp.checkedInAt), true)

    const announcement = await store.saveAnnouncement({
      id: '',
      title: 'Festifall table times',
      body: 'We are on the Diag from 11 to 4 on September 2.',
      audience: 'all-members',
      pinned: true,
      ctaLabel: '',
      ctaHref: '',
      expiresAt: '',
    }, ACTOR)
    assert.equal(announcement.status, 'draft')
    const promoted = await store.publishAnnouncement(announcement.id, 'published', ACTOR)
    assert.equal(promoted.ok, true)

    const resource = await store.savePortalResource({
      id: '',
      title: 'Room request form',
      description: 'How we book an accessible room on campus.',
      href: 'https://ublda.org/room-request',
      category: 'club-docs',
      formatNote: 'Captioned',
      audience: 'all-members',
      published: true,
    }, ACTOR)
    await store.reorderPortalResources([resource.id], ACTOR)

    await store.saveMemberAccess('thartnet@umich.edu', {
      needs: [{ id: 'live-captioning', priority: 'required', detail: '' }],
      generalNote: '',
      followUpPreference: 'email',
      scope: 'shared-with-leads',
      appliesTo: 'rsvp-only',
      consentText: ACCESS_CONSENT_TEXT,
    }, { email: 'thartnet@umich.edu', role: 'member' })

    const restarted = createLocalRecruitingStore(dataPath)
    const workspace = await restarted.listPortalWorkspace()

    assert.equal(workspace.memberProfiles.length, 1)
    assert.equal(workspace.memberProfiles[0].status, 'active')
    assert.equal(workspace.memberProfiles[0].school, 'Ross')
    assert.equal(workspace.memberProfiles[0].notes, 'Met at Festifall.')
    assert.equal(workspace.memberProfiles[0].access.scope, 'shared-with-leads')
    assert.equal(workspace.memberProfiles[0].access.consentText, ACCESS_CONSENT_TEXT)
    assert.ok(workspace.memberProfiles[0].access.consentAt)
    assert.ok(workspace.memberProfiles[0].access.expiresAt)

    assert.equal(workspace.clubEvents.length, 1)
    assert.equal(workspace.clubEvents[0].status, 'published')
    assert.equal(workspace.clubEvents[0].publishedBy, 'sbodine@umich.edu')
    assert.equal(workspace.eventRsvps.length, 2)
    assert.equal(workspace.announcements.length, 1)
    assert.equal(workspace.announcements[0].status, 'published')
    assert.equal(workspace.resources.length, 1)
    assert.equal(workspace.resources[0].order, 0)

    const withdrawn = await restarted.withdrawMemberAccessConsent(
      'thartnet@umich.edu',
      { email: 'thartnet@umich.edu', role: 'member' },
    )
    assert.equal(withdrawn.access.scope, 'private')
    assert.ok(withdrawn.access.withdrawnAt)

    const audit = await restarted.readAuditLog(50)
    const actions = audit.map((entry) => entry.action)
    assert.equal(audit[0].action, 'member.withdrawAccessConsent')
    assert.ok(actions.includes('admin.member.bulkAdmit'))
    assert.ok(actions.includes('admin.event.publish'))
    assert.ok(actions.includes('admin.announcement.publish'))
    assert.ok(actions.includes('admin.resource.reorder'))
    assert.ok(actions.includes('member.saveAccess'))
    // The access audit entry records the scope change and never the content.
    const accessEntry = audit.find((entry) => entry.action === 'member.saveAccess')
    assert.equal(accessEntry?.summary, 'Access sharing set to shared-with-leads.')
  })
})

test('never writes access data through the member profile patch path', async () => {
  await withStore(async (store) => {
    const patched = await store.saveMemberProfile('nobody@umich.edu', {
      status: 'active',
      access: { ...emptyAccessProfile(), scope: 'shared-with-leads', generalNote: 'SMUGGLED' },
    }, ACTOR)

    assert.equal(patched.status, 'active')
    assert.equal(patched.access.scope, 'private')
    assert.equal(patched.access.generalNote, '')
  })
})

test('bulk admit is idempotent when the same intake batch runs twice', async () => {
  await withStore(async (store) => {
    const first = await store.bulkAdmitMembers({
      emails: ['a@umich.edu', 'b@umich.edu', 'a@umich.edu'],
      status: 'prospect',
      source: 'festifall',
    }, ACTOR)
    assert.equal(first.length, 2)

    const second = await store.bulkAdmitMembers({
      emails: ['a@umich.edu', 'b@umich.edu'],
      status: 'active',
      source: 'manual',
    }, ACTOR)

    assert.equal(second.length, 2)
    assert.deepEqual(second.map((row) => row.status), ['prospect', 'prospect'])
    assert.deepEqual(second.map((row) => row.createdAt), first.map((row) => row.createdAt))

    const audit = await store.readAuditLog(10)
    assert.equal(audit.filter((entry) => entry.action === 'admin.member.bulkAdmit').length, 1)
  })
})

test('refuses an RSVP on an event that is not published', async () => {
  await withStore(async (store) => {
    const draft = await store.saveClubEvent(eventData(), ACTOR)
    const attempt = await store.saveEventRsvp('thartnet@umich.edu', {
      eventId: draft.id,
      response: 'going',
      guestCount: 0,
      accommodationNote: '',
      shareAccommodationWithLeads: false,
    })

    assert.equal(attempt.ok, false)
    assert.deepEqual(attempt.ok === false && attempt.blockers, ['That event is not published yet.'])
  })
})

test('prunes the audit log to the newest 300 entries inside the mutator', async () => {
  const seededLog: AuditEntry[] = Array.from({ length: AUDIT_LOG_LIMIT }, (_unused, index) => ({
    id: `seed-${index}`,
    at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    actorEmail: 'sbodine@umich.edu',
    actorRole: 'super-admin' as const,
    action: 'admin.member.upsert',
    targetType: 'member' as const,
    targetId: `seed-${index}@umich.edu`,
    summary: `Seeded entry ${index}.`,
  }))

  await withStore(async (store) => {
    await store.saveMemberProfile('overflow@umich.edu', { status: 'active' }, ACTOR)

    const audit = await store.readAuditLog(AUDIT_LOG_LIMIT)
    assert.equal(audit.length, AUDIT_LOG_LIMIT)
    assert.equal(audit.some((entry) => entry.id === 'seed-0'), false)
    assert.equal(audit.some((entry) => entry.id === `seed-${AUDIT_LOG_LIMIT - 1}`), true)
    assert.equal(audit[0].targetId, 'overflow@umich.edu')
  }, {
    version: 1,
    accounts: {},
    sessions: {},
    candidates: {},
    interviewerAvailability: {},
    auditLog: seededLog,
  })
})

test('appendAudit caps the ring buffer and buildAuditEntry stamps id and time', () => {
  const entry = buildAuditEntry({
    actorEmail: 'SBodine@umich.edu',
    actorRole: 'super-admin',
    action: 'admin.export',
    targetType: 'member',
    targetId: 'roster',
    summary: 'Exported the roster.',
  })

  assert.match(entry.id, /^audit_/)
  assert.ok(!Number.isNaN(Date.parse(entry.at)))
  assert.equal(entry.actorEmail, 'sbodine@umich.edu')

  let log: AuditEntry[] = []
  for (let index = 0; index < AUDIT_LOG_LIMIT + 10; index += 1) {
    log = appendAudit(log, { ...entry, id: `entry-${index}` })
  }

  assert.equal(log.length, AUDIT_LOG_LIMIT)
  assert.equal(log[0].id, 'entry-10')
  assert.equal(log[log.length - 1].id, `entry-${AUDIT_LOG_LIMIT + 9}`)
})

test('grants a role from the console without touching the sign-in path', async () => {
  await withStore(async (store) => {
    const missing = await store.grantAccountRole({
      email: 'ghost@umich.edu',
      role: 'exec',
      scopes: ['events'],
    }, ACTOR)
    assert.equal(missing.ok, false)

    await store.upsertAccount({
      firstName: 'Andrew',
      lastName: 'Sackett',
      uniqname: 'andsack',
      email: 'andsack@umich.edu',
    }, 'public-form-password')

    const granted = await store.grantAccountRole({
      email: 'andsack@umich.edu',
      role: 'exec',
      scopes: ['events', 'announcements'],
    }, ACTOR)

    assert.equal(granted.ok, true)
    assert.equal(granted.ok && granted.account.role, 'exec')
    assert.equal(granted.ok && granted.account.adminTitle, 'Events & Programming')
    assert.deepEqual(granted.ok && granted.account.adminScopes, ['events', 'announcements'])

    const audit = await store.readAuditLog(5)
    assert.equal(audit[0].action, 'admin.grantRole')
    assert.equal(audit[0].targetType, 'admin-account')
  })
})

test('elevates a role only for a verified identity provider', () => {
  assert.equal(effectiveRoleForAccount({ email: 'atchiang@umich.edu', verifiedVia: 'password' }), 'member')
  assert.equal(effectiveRoleForAccount({ email: 'atchiang@umich.edu' }), 'member')
  assert.equal(effectiveRoleForAccount({ email: 'atchiang@umich.edu', verifiedVia: '' }), 'member')
  assert.equal(effectiveRoleForAccount({ email: 'atchiang@umich.edu', verifiedVia: 'google' }), 'exec')
  assert.equal(effectiveRoleForAccount({ email: 'sbodine@umich.edu', verifiedVia: 'google' }), 'super-admin')
  assert.equal(effectiveRoleForAccount({ email: 'stranger@umich.edu', verifiedVia: 'google' }), 'member')
  assert.equal(
    effectiveRoleForAccount({ email: 'stranger@umich.edu', role: 'exec', verifiedVia: 'password' }),
    'exec',
  )
  assert.equal(
    effectiveRoleForAccount({ email: 'sbodine@umich.edu', role: 'member', verifiedVia: 'password' }),
    'member',
  )
})

test('carries the corrected nine-officer roster with publish held by the two co-presidents', () => {
  assert.equal(ADMIN_ACCOUNTS.length, 9)
  assert.equal(new Set(ADMIN_ACCOUNTS.map((account) => account.email)).size, 9)
  ADMIN_ACCOUNTS.forEach((account) => {
    assert.ok(account.askAbout.length > 0, `${account.email} needs an askAbout line`)
    assert.ok(account.scopes.length > 0, `${account.email} needs at least one scope`)
  })

  assert.equal(roleForEmail('ylindsey@umich.edu'), 'exec')
  assert.equal(roleForEmail('sdeyoun@umich.edu'), 'exec')
  assert.equal(ADMIN_ACCOUNTS.find((account) => account.email === 'snaber@umich.edu')?.name, 'Samantha Naber')
  assert.ok(scopesForEmail('cooperry@umich.edu').includes('events'))
  assert.ok(scopesForEmail('andsack@umich.edu').includes('events'))
  assert.ok(scopesForEmail('sbodine@umich.edu').includes('system'))

  assert.deepEqual(PUBLISH_APPROVERS, ['sbodine@umich.edu', 'atchiang@umich.edu'])
  assert.equal(canPublish('SBodine@umich.edu'), true)
  assert.equal(canPublish('atchiang@umich.edu'), true)
  assert.equal(canPublish('cooperry@umich.edu'), false)

  // Every named access lead has to be a real officer on the roster.
  ACCESS_LEAD_EMAILS.forEach((email) => {
    assert.ok(ADMIN_ACCOUNTS.some((account) => account.email === email), `${email} is not on the roster`)
  })
})

test('canPublishEvent names every blocker it finds', () => {
  const complete = buildClubEvent(eventData(), ACTOR.email)
  assert.deepEqual(canPublishEvent(complete), { ok: true, blockers: [] })

  const bare: ClubEvent = {
    ...complete,
    accessCommitments: [],
    accommodationsContactEmail: '',
    hostName: '',
    endsAt: complete.startsAt,
  }
  const gate = canPublishEvent(bare)

  assert.equal(gate.ok, false)
  assert.equal(gate.blockers.length, 4)
  assert.ok(gate.blockers.some((blocker) => /access-wise/.test(blocker)))
  assert.ok(gate.blockers.some((blocker) => /accommodations contact/.test(blocker)))
  assert.ok(gate.blockers.some((blocker) => /running this event/.test(blocker)))
  assert.ok(gate.blockers.some((blocker) => /end time/.test(blocker)))
})

test('every portal validator rejects empty input and reports its errors together', () => {
  const validators = [
    validateMemberSelfPayload,
    validateMemberAdminPayload,
    validateClubEventPayload,
    validateRsvpPayload,
    validateAnnouncementPayload,
    validatePortalResourcePayload,
    validateAccessProfilePayload,
  ]

  validators.forEach((validate) => {
    const nothing = validate(null)
    assert.equal(nothing.success, false)
    assert.equal(nothing.data, null)
    assert.equal(nothing.errors.length, 1)
    assert.match(nothing.errors[0], /was empty\.$/)
    assert.equal(validate({}).success, false)
  })

  const event = validateClubEventPayload({
    title: '',
    kind: 'not-a-kind',
    format: 'teleportation',
    startsAt: '',
    endsAt: '',
    roomStatus: 'imagined',
  })
  assert.equal(event.success, false)
  assert.ok(event.errors.length >= 6)

  const resource = validatePortalResourcePayload({
    title: 'Member handbook',
    href: 'http://insecure.example.com',
    category: 'club-docs',
    formatNote: '',
    audience: 'all-members',
  })
  assert.equal(resource.success, false)
  assert.ok(resource.errors.some((error) => /https:\/\//.test(error)))
  assert.ok(resource.errors.some((error) => /what format this is in/.test(error)))
})

test('enforces every document-size cap in validation', () => {
  const long = (length: number) => 'x'.repeat(length)

  const selfProfile = validateMemberSelfPayload({ preferredName: long(81), major: long(121) })
  assert.equal(selfProfile.success, false)
  assert.equal(selfProfile.errors.length, 2)

  const adminProfile = validateMemberAdminPayload({ email: 'member@umich.edu', notes: long(1001) })
  assert.equal(adminProfile.success, false)
  assert.match(adminProfile.errors[0], /1000 characters or fewer/)
  assert.equal(validateMemberAdminPayload({ email: 'member@umich.edu', notes: long(1000) }).success, true)

  const event = validateClubEventPayload(eventData({ title: long(121), summary: long(601), internalNotes: long(1001) }))
  assert.equal(event.success, false)
  assert.equal(event.errors.length, 3)

  const announcement = validateAnnouncementPayload({
    title: 'Weekly note',
    body: long(4001),
    audience: 'all-members',
  })
  assert.equal(announcement.success, false)
  assert.match(announcement.errors[0], /4000 characters or fewer/)

  const resource = validatePortalResourcePayload({
    title: 'Guide',
    description: long(301),
    href: 'https://ublda.org/guide',
    category: 'onboarding',
    formatNote: long(121),
    audience: 'all-members',
  })
  assert.equal(resource.success, false)
  assert.equal(resource.errors.length, 2)

  const access = validateAccessProfilePayload({
    needs: [{ id: 'live-captioning', priority: 'required', detail: long(241) }],
    generalNote: long(601),
    followUpPreference: 'email',
    scope: 'private',
    appliesTo: 'rsvp-only',
    consentText: '',
  })
  assert.equal(access.success, false)
  assert.equal(access.errors.length, 2)
  assert.ok(access.errors.some((error) => /240 characters or fewer/.test(error)))
  assert.ok(access.errors.some((error) => /600 characters or fewer/.test(error)))

  const tooManyNeeds = validateAccessProfilePayload({
    needs: Array.from({ length: 51 }, () => ({ id: 'live-captioning', priority: 'required', detail: '' })),
    generalNote: '',
    followUpPreference: 'email',
    scope: 'private',
    appliesTo: 'rsvp-only',
    consentText: '',
  })
  assert.equal(tooManyNeeds.success, false)
  assert.match(tooManyNeeds.errors[0], /50 items or fewer/)

  const rsvp = validateRsvpPayload({
    eventId: 'event_1',
    response: 'going',
    guestCount: 9,
    accommodationNote: long(301),
  })
  assert.equal(rsvp.success, false)
  assert.equal(rsvp.errors.length, 2)
})

test('holds an access catalog that asks about rooms and never about bodies', () => {
  assert.equal(new Set(ACCESS_NEED_CATALOG.map((need) => need.id)).size, ACCESS_NEED_CATALOG.length)

  const forbidden = /diagnos|disabilit|condition|impairment|medical|treatment/i
  ACCESS_NEED_CATALOG.forEach((need) => {
    assert.equal(forbidden.test(need.label), false, `catalog label asks about a body: ${need.label}`)
    assert.equal(forbidden.test(need.id), false, `catalog id asks about a body: ${need.id}`)
  })

  assert.equal(emptyAccessProfile().scope, 'private')
  assert.deepEqual(emptyAccessProfile().needs, [])
  assert.equal(emptyAccessProfile().appliesTo, 'rsvp-only')

  const offCatalog = validateAccessProfilePayload({
    needs: [{ id: 'chronic-illness', priority: 'required', detail: '' }],
    generalNote: '',
    followUpPreference: 'email',
    scope: 'private',
    appliesTo: 'rsvp-only',
    consentText: '',
  })
  assert.equal(offCatalog.success, false)
  assert.match(offCatalog.errors[0], /not on the list/)

  const unconsented = validateAccessProfilePayload({
    needs: [],
    generalNote: '',
    followUpPreference: 'email',
    scope: 'shared-with-leads',
    appliesTo: 'all-events',
    consentText: '',
  })
  assert.equal(unconsented.success, false)
  assert.match(unconsented.errors[0], /consent wording/)
})
