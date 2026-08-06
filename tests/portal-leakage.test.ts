import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { handlePortalRequest } from '../server/portalApi.ts'
import { buildApplicationSubmission, validateApplicationPayload } from '../src/lib/application.ts'
import {
  buildInterviewAssignmentSubmission,
  validateInterviewAssignmentPayload,
} from '../src/lib/interviewAssignment.ts'
import {
  buildInterviewerAvailabilitySubmission,
  validateInterviewerAvailabilityPayload,
} from '../src/lib/interviewerAvailability.ts'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'
import { ACCESS_CONSENT_TEXT } from '../src/lib/portalAccess.ts'
import type { ClubEventData } from '../src/lib/portalEvents.ts'

/**
 * T5 — spec §9: the forbidden-substring test.
 *
 * The portal is two faces over ONE store document, so the highest-severity defect in
 * this codebase is not a crash — it is a member payload that quietly carries an admin
 * field. Every projection in `server/portalApi.ts` is written as a fresh literal for
 * exactly this reason; a redaction that deletes keys fails open on the next field
 * somebody adds. This test is the thing that notices.
 *
 * The store is seeded with one poisoned string per class of data a member must never
 * see, and the assertion is deliberately blunt: `JSON.stringify(bootstrap)` contains
 * none of them, anywhere, at any depth, under any key name.
 *
 * Test files never import each other (spec §9), so the env harness below is a
 * deliberate duplicate rather than a shared module.
 */

/** Every string a plain member's payload must never contain. */
const FORBIDDEN = [
  'FORBIDDEN_FEEDBACK_STRING', // recruiting candidate feedback
  'FORBIDDEN_AVAILABILITY', // interviewer availability notes
  'FORBIDDEN_ACCESS_NEED', // ANOTHER member's access profile
  'FORBIDDEN_RSVP_NOTE', // ANOTHER member's per-event accommodation note
  'FORBIDDEN_INTERNAL', // internalNotes on a published event
  'FORBIDDEN_DRAFT', // an unpublished event title
  'FORBIDDEN_ANNOUNCEMENT', // an unpublished announcement
  'FORBIDDEN_ROOM_STATUS', // admin-only room logistics
  'mkarcher@umich.edu', // the other member's identity
]

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
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-portal-leakage-'))
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
  accessCommitments: [
    { id: 'step-free-route', state: 'confirmed' },
    { id: 'live-captions', state: 'on-request' },
    { id: 'asl-interpreter', state: 'not-available' },
  ],
  accommodationsContactEmail: 'andsack@umich.edu',
  recordingUrl: '',
  slidesUrl: '',
  roomStatus: 'requested',
  internalNotes: '',
  ...overrides,
})

/** A recruiting candidate whose interview feedback is poisoned. */
const seedCandidateWithFeedback = async (store: Store) => {
  const application = validateApplicationPayload({
    firstName: 'Candidate',
    lastName: 'Student',
    uniqname: 'candidat',
    year: 'Sophomore',
    expectedGraduation: 'May 2028',
    college: 'Ross BBA',
    rossStatus: 'ross-bba',
    interestType: 'leadership-interview',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    availability: [INTERVIEW_SLOTS[0].value],
    resumeFile: {
      name: 'candidat-resume.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      contentBase64: 'cmVzdW1l',
    },
    weeklyCommitment: '2-3 hours/week',
    notes: '',
  })
  assert.equal(application.success, true, JSON.stringify(application.errors))
  await store.saveApplication(buildApplicationSubmission(application.data!, 'portal-leakage-test'))

  const assignment = validateInterviewAssignmentPayload({
    uniqname: 'candidat',
    interviewers: [],
    interviewStatus: 'Needs match',
    feedback: 'FORBIDDEN_FEEDBACK_STRING',
    sessionToken: 'seed-session-token-for-the-leakage-test',
  })
  assert.equal(assignment.success, true, JSON.stringify(assignment.errors))
  await store.saveInterviewAssignment(buildInterviewAssignmentSubmission(assignment.data!, 'portal-leakage-test'))
}

/** An interviewer availability row whose free-text notes are poisoned. */
const seedInterviewerAvailability = async (store: Store) => {
  const availability = validateInterviewerAvailabilityPayload({
    firstName: 'Cooper',
    lastName: 'Perry',
    uniqname: 'cooperry',
    availability: [INTERVIEW_SLOTS[0].value],
    maxInterviews: 'As needed',
    notes: 'FORBIDDEN_AVAILABILITY',
  })
  assert.equal(availability.success, true, JSON.stringify(availability.errors))
  await store.saveInterviewerAvailability(
    buildInterviewerAvailabilitySubmission(availability.data!, 'portal-leakage-test'),
  )
}

/**
 * Seeds the whole document and returns the session token of a PLAIN MEMBER —
 * a real signup with no role, no scopes, and no relationship to any of it.
 */
const seedPoisonedWorkspace = async (store: Store) => {
  // 1. Recruiting data: candidate feedback + interviewer availability notes.
  await seedCandidateWithFeedback(store)
  await seedInterviewerAvailability(store)

  // 2. An admin account carrying a role and scopes.
  await store.upsertAccount({
    firstName: 'Alexa',
    lastName: 'Chiang',
    uniqname: 'atchiang',
    email: 'atchiang@umich.edu',
    role: 'exec',
    verifiedVia: 'google',
  })

  // 3. A published event with admin-only internal notes and room logistics…
  const published = await store.saveClubEvent(eventSeed({
    internalNotes: 'FORBIDDEN_INTERNAL — Lindsey still has to file the room request.',
    roomStatus: 'requested',
  }), adminActor)
  const publishResult = await store.publishClubEvent(published.id, adminActor)
  assert.equal(publishResult.ok, true, `seed event did not publish: ${JSON.stringify(publishResult)}`)

  // …and a draft event that no member has any business knowing exists.
  await store.saveClubEvent(eventSeed({
    title: 'FORBIDDEN_DRAFT',
    summary: 'Unannounced partner conversation. Not public.',
    internalNotes: 'FORBIDDEN_ROOM_STATUS — no room booked yet.',
  }), adminActor)

  // 4. A SECOND member: consented access profile plus a per-event accommodation note.
  await store.upsertAccount({
    firstName: 'Maya',
    lastName: 'Karcher',
    uniqname: 'mkarcher',
    email: 'mkarcher@umich.edu',
  })
  await store.saveMemberAccess('mkarcher@umich.edu', {
    needs: [{ id: 'live-captioning', priority: 'required', detail: 'FORBIDDEN_ACCESS_NEED' }],
    generalNote: 'FORBIDDEN_ACCESS_NEED — auto-captions are not enough for me.',
    followUpPreference: 'before-event',
    scope: 'shared-with-leads',
    appliesTo: 'all-events',
    consentText: ACCESS_CONSENT_TEXT,
  }, { email: 'mkarcher@umich.edu', role: 'member' })

  const rsvp = await store.saveEventRsvp('mkarcher@umich.edu', {
    eventId: published.id,
    response: 'going',
    guestCount: 0,
    accommodationNote: 'FORBIDDEN_RSVP_NOTE',
    shareAccommodationWithLeads: true,
  })
  assert.equal(rsvp.ok, true, `seed RSVP did not save: ${JSON.stringify(rsvp)}`)

  // 5. A draft announcement.
  await store.saveAnnouncement({
    id: '',
    title: 'FORBIDDEN_ANNOUNCEMENT',
    body: 'FORBIDDEN_ANNOUNCEMENT — still being argued about in the group chat.',
    audience: 'all-members',
    pinned: false,
    ctaLabel: '',
    ctaHref: '',
    expiresAt: '',
  }, adminActor)

  // 6. The plain member doing the reading. No role, no scopes, no elevation.
  const member = await store.upsertAccount({
    firstName: 'Tommy',
    lastName: 'Hartnett',
    uniqname: 'thartnet',
    email: 'thartnet@umich.edu',
  })

  return { memberToken: member.sessionToken, publishedEventId: published.id }
}

test('a plain member bootstrap carries none of the forbidden strings', async () => {
  await withPortalEnv(async (store) => {
    const { memberToken } = await seedPoisonedWorkspace(store)

    const response = await call('portal.bootstrap', memberToken)
    assert.equal(response.status, 200, JSON.stringify(response.body))

    const serialized = JSON.stringify(response)
    const data = response.body.data as Record<string, unknown>

    // Not a vacuous pass: this really is a member's real bootstrap.
    assert.equal(data.role, 'member')
    assert.equal((data.profile as Record<string, unknown>).email, 'thartnet@umich.edu')
    assert.equal(
      (data.events as unknown[]).length,
      1,
      'the member should see exactly the one published event',
    )

    FORBIDDEN.forEach((needle) => {
      assert.equal(
        serialized.includes(needle),
        false,
        `a member payload leaked ${needle}`,
      )
    })

    // Two structural leaks that would not show up as a substring.
    assert.equal(serialized.includes('adminScopes'), false, 'a member payload carried an adminScopes key')
    assert.equal('admin' in data, false, 'a member payload carried an admin key')
    assert.equal(serialized.includes('"admin"'), false, 'a member payload carried an admin key')
    assert.equal('scopes' in data, false, 'a member payload carried a scopes key')
    assert.equal('canPublish' in data, false, 'a member payload carried a canPublish key')

    // The officer list is a "who to ask" contact card, never a permissions table.
    const officers = data.officers as Record<string, unknown>[]
    assert.ok(officers.length > 0)
    officers.forEach((officer) => {
      assert.deepEqual(Object.keys(officer).sort(), ['askAbout', 'email', 'name', 'title'])
    })
  })
})

test('the same document read by a lead does contain the seeded strings', async () => {
  // The point of this test is to prove the one above is not passing because the
  // fixture never landed. Everything the member could not see is really in the store.
  await withPortalEnv(async (store) => {
    await seedPoisonedWorkspace(store)

    const lead = await store.upsertAccount({
      firstName: 'Sam',
      lastName: 'Bodine',
      uniqname: 'sbodine',
      email: 'sbodine@umich.edu',
      verifiedVia: 'google',
    })

    const response = await call('portal.bootstrap', lead.sessionToken)
    assert.equal(response.status, 200, JSON.stringify(response.body))

    const serialized = JSON.stringify(response)
    const data = response.body.data as Record<string, unknown>
    assert.equal(data.role, 'super-admin')
    assert.ok(data.admin, 'a super-admin bootstrap should carry the admin half')

    // The member-facing strings a NAMED LEAD is allowed to read.
    assert.ok(serialized.includes('FORBIDDEN_ACCESS_NEED'), 'the consented access profile never reached a lead')
    assert.ok(serialized.includes('FORBIDDEN_RSVP_NOTE'), 'the shared accommodation note never reached a lead')
    assert.ok(serialized.includes('FORBIDDEN_INTERNAL'), 'the event internal notes never reached an admin')
    assert.ok(serialized.includes('FORBIDDEN_DRAFT'), 'the draft event never reached an admin')
    assert.ok(serialized.includes('FORBIDDEN_ANNOUNCEMENT'), 'the draft announcement never reached an admin')
    assert.ok(serialized.includes('mkarcher@umich.edu'), 'the second member never reached the roster')

    // The recruiting fixtures live in the document even though the portal bootstrap
    // deliberately only surfaces counts from them.
    const recruiting = await store.leadershipDashboardData()
    assert.ok(
      (recruiting.candidates || []).some((candidate) => candidate.feedback === 'FORBIDDEN_FEEDBACK_STRING'),
      'the candidate feedback fixture never landed',
    )
    assert.ok(
      (recruiting.interviewerAvailability || []).some((row) => row.notes === 'FORBIDDEN_AVAILABILITY'),
      'the interviewer availability fixture never landed',
    )
  })
})

test('a member bootstrap stays clean when the member is signed in as an exec elsewhere in the roster', async () => {
  // An exec is still a member, so `/members` is served from the SAME action. What must
  // not happen is the member half of an admin's payload picking up admin-only strings —
  // the member half is shared code, and this is the regression that would poison it.
  await withPortalEnv(async (store) => {
    await seedPoisonedWorkspace(store)

    const exec = await store.upsertAccount({
      firstName: 'Landon',
      lastName: 'Miller',
      uniqname: 'landonem',
      email: 'landonem@umich.edu',
      verifiedVia: 'google',
    })

    const response = await call('portal.bootstrap', exec.sessionToken)
    assert.equal(response.status, 200, JSON.stringify(response.body))
    const data = response.body.data as Record<string, unknown>
    assert.equal(data.role, 'exec')

    // The member half of an admin payload, isolated from the admin half.
    const memberHalf = JSON.stringify({
      profile: data.profile,
      events: data.events,
      announcements: data.announcements,
      resources: data.resources,
      officers: data.officers,
      participation: data.participation,
    })

    FORBIDDEN.forEach((needle) => {
      assert.equal(
        memberHalf.includes(needle),
        false,
        `the member half of an admin payload leaked ${needle}`,
      )
    })
  })
})

test('server/portalApi.ts does not import leadershipDashboardData', async () => {
  // `leadershipDashboardData()` returns the full super-admin recruiting payload with no
  // session, no role, and no scope check. One import of it inside the portal handler is
  // all it would take to hand a member the candidate list.
  const source = await readFile(
    path.join(import.meta.dirname, '..', 'server', 'portalApi.ts'),
    'utf8',
  )

  assert.equal(
    source.includes('leadershipDashboardData'),
    false,
    'server/portalApi.ts must never reach for the unscoped leadership payload',
  )
})
