import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  createOperationsStore,
  isOperationsSuperAdmin,
  operationsEventStatus,
  validDocumentDriveUrl,
} from '../server/operationsStore.ts'
import type { SpeakerOpsActor } from '../server/speakerOpsStore.ts'

const sam: SpeakerOpsActor = {
  memberId: 'member-sam',
  displayName: 'Sam Bodine',
  email: 'sbodine@umich.edu',
  role: 'admin',
}
const cooper: SpeakerOpsActor = {
  memberId: 'member-cooper',
  displayName: 'Cooper Perry',
  email: 'cooperry@umich.edu',
  role: 'admin',
}
const alexa: SpeakerOpsActor = {
  memberId: 'member-alexa',
  displayName: 'Alexa Chiang',
  email: 'atchiang@umich.edu',
  role: 'admin',
}
const officer: SpeakerOpsActor = {
  memberId: 'member-andrew',
  displayName: 'Andrew Sackett',
  email: 'andsack@umich.edu',
  role: 'admin',
}

const fixture = async (now = '2026-08-14T14:00:00-04:00') => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ublda-operations-'))
  const store = createOperationsStore(path.join(directory, 'operations.json'), {
    forceLocal: true,
    now: () => new Date(now),
  })
  return { directory, store }
}

test('computes upcoming, active, and inactive event status from the current time', () => {
  const event = { startsAt: '2026-08-14T15:45:00-04:00', endsAt: '2026-08-14T16:15:00-04:00' }
  assert.equal(operationsEventStatus(event, new Date('2026-08-14T15:44:59-04:00')), 'upcoming')
  assert.equal(operationsEventStatus(event, new Date('2026-08-14T15:45:00-04:00')), 'active')
  assert.equal(operationsEventStatus(event, new Date('2026-08-14T16:15:00-04:00')), 'inactive')
})

test('seeds the exact meeting, verified documents, accounts, and read-only views', async (t) => {
  const { directory, store } = await fixture()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const workspace = await store.workspace(officer)

  assert.equal(workspace.events[0]?.status, 'upcoming')
  assert.equal(workspace.events[0]?.startsAt, '2026-08-14T15:45:00-04:00')
  assert.equal(workspace.events[0]?.calendarStartsAt, '2026-08-14T15:45:00-04:00')
  assert.equal(workspace.events[0]?.sourceStatus, 'user_confirmed')
  assert.match(workspace.events[0]?.sourceNote || '', /location or google meet link has not yet been verified/i)
  assert.equal(workspace.attendance.length, 9)
  assert.equal(workspace.attendance.filter((record) => record.invited).length, 8)
  assert.ok(workspace.attendance.filter((record) => record.invited).every((record) => record.status === 'unrecorded'))
  assert.partialDeepStrictEqual(workspace.attendance.find((record) => record.memberEmail === alexa.email), {
    invited: false,
    status: 'not_invited',
  })
  assert.equal(workspace.viewer.canWrite, false)
  assert.equal(workspace.viewer.role, 'officer')

  const constitution = workspace.documents.find((document) => document.id === 'constitution')
  assert.equal(constitution?.sourceStatus, 'verified')
  assert.equal(constitution?.currentStatus, 'current')
  assert.equal(constitution?.driveUrl, 'https://drive.google.com/file/d/1OQM2b62K93_uKrNVAh0iTSRHtBAP8bDD/view')
  assert.match(constitution?.sourceNote || '', /governance review/i)
  assert.ok(workspace.documents.some((document) => document.id === 'team-meeting-notes-2026-08-14'))
})

test('enforces the immutable three-person write allowlist inside the store', async (t) => {
  const { directory, store } = await fixture()
  t.after(() => rm(directory, { recursive: true, force: true }))

  assert.equal(isOperationsSuperAdmin('sbodine@umich.edu'), true)
  assert.equal(isOperationsSuperAdmin('atchiang@umich.edu'), true)
  assert.equal(isOperationsSuperAdmin('cooperry@umich.edu'), true)
  assert.equal(isOperationsSuperAdmin('andsack@umich.edu'), false)

  const denied = await store.updateAccount(officer, { email: officer.email, role: 'member' })
  assert.equal(denied.ok, false)
  assert.match(denied.ok ? '' : denied.error, /three operations super admins/i)

  const grantDenied = await store.updateAccount(sam, { email: officer.email, role: 'super_admin' })
  assert.equal(grantDenied.ok, false)
  const demoteDenied = await store.updateAccount(sam, { email: sam.email, role: 'officer' })
  assert.equal(demoteDenied.ok, false)

  const changed = await store.updateAccount(sam, { email: officer.email, role: 'inactive' })
  assert.equal(changed.ok, true)
  await assert.rejects(store.workspace(officer), /operations account is inactive/i)
})

test('records attendance without creating an automatic strike', async (t) => {
  const { directory, store } = await fixture()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const updated = await store.updateAttendance(sam, {
    eventId: 'team-meeting-2026-08-14',
    memberEmail: officer.email,
    status: 'absent',
    noticeAt: '',
    notes: 'No notice recorded yet.',
  })
  assert.equal(updated.ok, true)
  const workspace = await store.workspace(sam)
  assert.equal(workspace.attendance.find((record) => record.memberEmail === officer.email)?.status, 'absent')
  assert.equal(workspace.strikes.length, 0)
})

test('uses active strikes only for the three-strike escalation and keeps an audit trail', async (t) => {
  const { directory, store } = await fixture()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const created = []
  for (const reason of ['meeting_absence', 'notice', 'communication'] as const) {
    const result = await store.createStrike(sam, {
      memberEmail: officer.email,
      reason,
      detail: `Documented ${reason} evidence.`,
      eventId: 'team-meeting-2026-08-14',
    })
    assert.equal(result.ok, true)
    if (result.ok) created.push(result.strike)
  }
  let workspace = await store.workspace(sam)
  assert.equal(workspace.strikeSummary.find((summary) => summary.memberEmail === officer.email)?.activeCount, 3)
  assert.equal(workspace.strikeSummary.find((summary) => summary.memberEmail === officer.email)?.escalationRequired, true)
  assert.partialDeepStrictEqual(workspace.escalations[0], {
    memberEmail: officer.email,
    ownerEmail: sam.email,
    status: 'open',
  })
  assert.equal(workspace.escalations[0]?.history[0]?.action, 'opened')

  const excused = await store.updateStrikeStatus(cooper, {
    id: created[0]!.id,
    status: 'excused',
    note: 'Academic conflict was documented and approved.',
  })
  assert.equal(excused.ok, true)
  assert.equal(excused.ok && excused.strike.audit.length, 2)
  workspace = await store.workspace(sam)
  assert.equal(workspace.strikeSummary.find((summary) => summary.memberEmail === officer.email)?.activeCount, 2)
  assert.equal(workspace.strikeSummary.find((summary) => summary.memberEmail === officer.email)?.escalationRequired, false)
  assert.equal(workspace.escalations[0]?.status, 'resolved')
  assert.equal(workspace.escalations[0]?.history[0]?.action, 'resolved')
  assert.match(workspace.escalations[0]?.resolutionNote || '', /dropped below three/i)
})

test('requires an independent assigned reviewer for approval and preserves stage history', async (t) => {
  const { directory, store } = await fixture()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const conflict = await store.updateReview(sam, {
    id: 'review-constitution',
    reviewerEmail: sam.email,
    note: 'Self assignment should fail.',
  })
  assert.equal(conflict.ok, false)

  const submitted = await store.updateReview(sam, {
    id: 'review-constitution',
    decision: 'submit',
    note: 'Ready for an independent governance check.',
  })
  assert.equal(submitted.ok, true)

  const wrongReviewer = await store.updateReview(sam, {
    id: 'review-constitution',
    decision: 'start_review',
    note: '',
  })
  assert.equal(wrongReviewer.ok, false)

  assert.equal((await store.updateReview(cooper, {
    id: 'review-constitution',
    decision: 'start_review',
    note: 'Beginning review.',
  })).ok, true)
  const approved = await store.updateReview(cooper, {
    id: 'review-constitution',
    decision: 'approve',
    note: 'Governance conflicts were resolved and the requirements were confirmed.',
  })
  assert.equal(approved.ok, true)
  assert.equal(approved.ok && approved.review.stage, 'approved')
  assert.equal(approved.ok && approved.review.independentReviewer, true)
  assert.equal(approved.ok && approved.review.history.length, 3)
})

test('rejects uninvited attendance updates without implying Alexa was absent', async (t) => {
  const { directory, store } = await fixture()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const result = await store.updateAttendance(sam, {
    eventId: 'team-meeting-2026-08-14',
    memberEmail: alexa.email,
    status: 'absent',
  })
  assert.equal(result.ok, false)
  assert.partialDeepStrictEqual((await store.workspace(sam)).attendance.find((record) => record.memberEmail === alexa.email), {
    invited: false,
    status: 'not_invited',
  })
})

test('failed document verification and review transitions persist no partial mutation', async (t) => {
  const { directory, store } = await fixture()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const before = await store.workspace(sam)
  const constitutionBefore = before.documents.find((document) => document.id === 'constitution')!

  const invalidDocument = await store.updateDocument(sam, {
    id: 'constitution',
    driveUrl: 'https://attacker.example/not-drive',
    sourceStatus: 'verified',
    sourceNote: 'This partial change must be discarded.',
  })
  assert.equal(invalidDocument.ok, false)
  const afterDocument = (await store.workspace(sam)).documents.find((document) => document.id === 'constitution')!
  assert.deepEqual(afterDocument, constitutionBefore)

  const invalidReview = await store.updateReview(alexa, {
    id: 'review-constitution',
    reviewerEmail: alexa.email,
    decision: 'approve',
    note: 'This assignment and history must be discarded with the invalid transition.',
  })
  assert.equal(invalidReview.ok, false)
  const review = (await store.workspace(sam)).reviews.find((item) => item.id === 'review-constitution')!
  assert.equal(review.reviewerEmail, cooper.email)
  assert.equal(review.stage, 'draft')
  assert.deepEqual(review.history, [])
  assert.deepEqual(review.reviewNotes, [])
})

test('only a non-owner super admin may assign a reviewer before submission', async (t) => {
  const { directory, store } = await fixture()
  t.after(() => rm(directory, { recursive: true, force: true }))
  assert.equal((await store.updateReview(sam, {
    id: 'review-constitution',
    reviewerEmail: alexa.email,
    note: 'Owner must not control the independent reviewer.',
  })).ok, false)
  assert.equal((await store.updateReview(alexa, {
    id: 'review-constitution',
    reviewerEmail: alexa.email,
    note: 'Alexa assigned as the independent reviewer.',
  })).ok, true)
  assert.equal((await store.updateReview(sam, {
    id: 'review-constitution',
    decision: 'submit',
    note: 'Ready.',
  })).ok, true)
  assert.equal((await store.updateReview(cooper, {
    id: 'review-constitution',
    reviewerEmail: cooper.email,
    note: 'Assignment is frozen.',
  })).ok, false)
  assert.equal((await store.workspace(sam)).reviews[0]?.reviewerEmail, alexa.email)
})

test('document verification accepts only canonical Drive paths and stamps verification server-side', async (t) => {
  const { directory, store } = await fixture()
  t.after(() => rm(directory, { recursive: true, force: true }))
  assert.equal(validDocumentDriveUrl('https://drive.google.com/file/d/abc_123/view'), 'https://drive.google.com/file/d/abc_123/view')
  assert.equal(validDocumentDriveUrl('https://docs.google.com/document/d/abc_123/edit'), 'https://docs.google.com/document/d/abc_123/edit')
  assert.equal(validDocumentDriveUrl('https://drive.google.com/open?id=abc_123'), '')
  assert.equal(validDocumentDriveUrl('https://docs.google.com.evil.example/document/d/abc/edit'), '')

  const result = await store.updateDocument(sam, {
    id: 'constitution',
    sourceStatus: 'verified',
    driveUrl: 'https://drive.google.com/file/d/1OQM2b62K93_uKrNVAh0iTSRHtBAP8bDD/view',
    lastVerifiedAt: '1970-01-01T00:00:00.000Z',
  })
  assert.equal(result.ok, true)
  assert.equal(result.ok && result.document.lastVerifiedAt, '2026-08-14T18:00:00.000Z')
})
