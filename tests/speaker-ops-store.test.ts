import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  createSpeakerOpsStore,
  type SpeakerOpsActor,
} from '../server/speakerOpsStore.ts'
import { SPEAKER_OPS_MEMBERS } from '../src/lib/speakerOps.ts'

const sam: SpeakerOpsActor = {
  memberId: 'member-sam',
  displayName: 'Sam Bodine',
  email: 'sbodine@umich.edu',
  role: 'admin',
}

const alex: SpeakerOpsActor = {
  memberId: 'member-alex',
  displayName: 'Alex Forstner',
  email: 'alexfors@umich.edu',
  role: 'member',
}

const buildStore = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ublda-speaker-ops-'))
  const dataPath = path.join(directory, 'speaker-ops.json')
  const store = createSpeakerOpsStore(dataPath, { forceLocal: true })
  return { directory, dataPath, store }
}

test('loads the reconciled pipeline for an authenticated Convex member', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const workspace = await store.workspace(sam)
  assert.equal(workspace.viewer.email, sam.email)
  assert.equal(workspace.viewer.role, 'admin')
  assert.equal(workspace.viewer.canConfirmProgram, true)
  assert.equal(workspace.members.length, SPEAKER_OPS_MEMBERS.length)
  assert.deepEqual(workspace.slots.map((slot) => slot.id).sort(), ['fall-2026-primary', 'fall-2026-secondary'])
  assert.equal(workspace.slots.every((slot) => slot.term === 'fall-2026'), true)
  assert.equal(workspace.leads.length, 15)
  assert.deepEqual(workspace.leads.filter((lead) => lead.recommendation === 'recommended').map((lead) => lead.id).sort(), ['deb-ruh', 'rich-donovan'])
  assert.equal(workspace.leads.find((lead) => lead.id === 'victor-pineda')?.stage, 'closed')
  assert.equal(workspace.leads.find((lead) => lead.id === 'dr-connolly')?.stage, 'closed')
  assert.equal(workspace.leads.find((lead) => lead.id === 'scott-fedor')?.education[1]?.degree, 'MBA, Marketing')
  assert.equal(workspace.leads.find((lead) => lead.id === 'neil-milliken')?.organization, 'Thrival Holdings')
  assert.match(workspace.leads.find((lead) => lead.id === 'neil-milliken')?.credentials.join(' ') || '', /Former Atos/)
  for (const lead of workspace.leads) {
    assert.ok(lead.shortBio, `${lead.id} needs a drawer bio or explicit unverified summary`)
    assert.ok(lead.whyTheyMatter, `${lead.id} needs a selection-context summary`)
  }
  for (const leadId of ['grant-shelton', 'microsoft-alum', 'dr-connolly']) {
    const lead = workspace.leads.find((candidate) => candidate.id === leadId)
    assert.deepEqual(lead?.education, [])
    assert.match(lead?.researchNotes || '', /unverified/i)
  }
  assert.deepEqual(workspace.leads.find((lead) => lead.id === 'deb-ruh')?.proposedSlots.map((slot) => slot.startAt), [
    '2026-10-01T18:30:00-04:00',
    '2026-10-22T18:30:00-04:00',
  ])
  assert.deepEqual(workspace.leads.find((lead) => lead.id === 'rich-donovan')?.proposedSlots.map((slot) => slot.startAt), [
    '2026-11-17T18:30:00-05:00',
    '2026-11-19T18:30:00-05:00',
  ])
  assert.equal(workspace.leads.find((lead) => lead.id === 'rich-donovan')?.lastContactAt, '2026-07-30')
  assert.equal(workspace.leads.some((lead) => /research has not been completed/i.test(lead.researchNotes)), false)
  assert.equal(workspace.leads.flatMap((lead) => lead.proposedSlots).some((slot) => /all nine|clear across/i.test(slot.evidence)), false)
  assert.equal(workspace.leads.some((lead) => lead.name === 'Grant Kessler'), false)
  assert.partialDeepStrictEqual(workspace.leads.find((lead) => lead.id === 'grant-shelton'), {
    name: 'Grant Shelton',
    organization: 'GTH Consulting',
    term: 'winter-2027',
    ownerEmail: 'sdeyoun@umich.edu',
  })
  for (const leadId of ['dustin-giannelli', 'maayan-ziv', 'scott-fedor']) {
    assert.ok(workspace.leads.some((lead) => lead.id === leadId))
  }
})

test('reading the workspace does not rewrite persisted Speaker Ops state', async (t) => {
  const { directory, dataPath, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  await writeFile(dataPath, `${JSON.stringify({
    version: 4,
    leads: {},
    slots: {},
    roomRequests: {},
    activity: [],
  })}\n`)
  const before = await readFile(dataPath, 'utf8')
  await store.workspace(sam)
  assert.equal(await readFile(dataPath, 'utf8'), before)
})

test('supports approved Convex members outside the business owner list', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const newMember: SpeakerOpsActor = {
    memberId: 'member-new',
    displayName: 'New Leader',
    email: 'newleader@umich.edu',
    role: 'member',
  }
  const workspace = await store.workspace(newMember)
  assert.deepEqual(workspace.viewer, {
    memberId: 'member-new',
    name: 'New Leader',
    email: 'newleader@umich.edu',
    title: 'Leadership Team',
    role: 'member',
    canConfirmProgram: false,
  })
})

test('rejects confirmation until Ross approves a named room', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const blocked = await store.updateSlot(sam, {
    id: 'fall-2026-primary',
    leadId: 'deb-ruh',
    status: 'confirmed',
  })
  assert.deepEqual(blocked, { ok: false, error: 'Ross must approve the room before the fireside can be confirmed.' })

  const invalidTransition = await store.updateRoomRequest(sam, {
    id: 'room-fall-2026-primary',
    status: 'approved',
  })
  assert.match(invalidTransition.ok ? '' : invalidTransition.error, /cannot move from draft to approved/i)

  assert.equal((await store.updateRoomRequest(sam, {
    id: 'room-fall-2026-primary',
    status: 'submitted',
  })).ok, true)

  const unnamedApproval = await store.updateRoomRequest(sam, {
    id: 'room-fall-2026-primary',
    status: 'approved',
  })
  assert.deepEqual(unnamedApproval, { ok: false, error: 'Enter the Ross room before marking the request approved.' })
  let request = (await store.workspace(sam)).roomRequests.find((item) => item.id === 'room-fall-2026-primary')!
  assert.equal(request.status, 'submitted')
  assert.equal(request.roomName, '')

  const unsupportedApproval = await store.updateRoomRequest(sam, {
    id: 'room-fall-2026-primary',
    status: 'approved',
    roomName: 'R1230',
  })
  assert.match(unsupportedApproval.ok ? '' : unsupportedApproval.error, /approval reference or source evidence/i)
  request = (await store.workspace(sam)).roomRequests.find((item) => item.id === 'room-fall-2026-primary')!
  assert.equal(request.status, 'submitted')
  assert.equal(request.roomName, '')

  const room = await store.updateRoomRequest(sam, {
    id: 'room-fall-2026-primary',
    status: 'approved',
    roomName: 'R1230',
    reference: 'ROSS-APPROVAL-123',
  })
  assert.equal(room.ok, true)

  const noAcceptance = await store.updateSlot(sam, {
    id: 'fall-2026-primary',
    leadId: 'deb-ruh',
    status: 'confirmed',
  })
  assert.match(noAcceptance.ok ? '' : noAcceptance.error, /accept this exact proposed time/i)
  const lead = (await store.workspace(sam)).leads.find((item) => item.id === 'deb-ruh')!
  await store.updateLead(sam, {
    id: lead.id,
    proposedSlots: lead.proposedSlots.map((slot) => ({ ...slot, status: slot.startAt === '2026-10-01T18:30:00-04:00' ? 'accepted' : slot.status })),
  })
  const confirmed = await store.updateSlot(sam, {
    id: 'fall-2026-primary',
    leadId: 'deb-ruh',
    status: 'confirmed',
  })
  assert.equal(confirmed.ok, true)
})

test('only a stable Convex admin member can confirm a programmed date', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  await store.updateRoomRequest(sam, {
    id: 'room-fall-2026-secondary',
    status: 'submitted',
  })
  await store.updateRoomRequest(sam, {
    id: 'room-fall-2026-secondary',
    status: 'approved',
    roomName: 'R0320',
    reference: 'ROSS-APPROVAL-456',
  })
  const lead = (await store.workspace(sam)).leads.find((item) => item.id === 'rich-donovan')!
  await store.updateLead(sam, { id: lead.id, proposedSlots: lead.proposedSlots.map((slot) => ({ ...slot, status: slot.startAt === '2026-11-17T18:30:00-05:00' ? 'accepted' : slot.status })) })
  await store.updateSlot(alex, { id: 'fall-2026-secondary', leadId: 'rich-donovan' })
  const result = await store.updateSlot(alex, { id: 'fall-2026-secondary', status: 'confirmed' })
  assert.deepEqual(result, { ok: false, error: 'Only a workspace administrator can confirm a programmed date.' })
})

test('program confirmation follows the member role rather than the current email alias', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const adminAlias: SpeakerOpsActor = {
    ...sam,
    email: 'alternate-admin@umich.edu',
  }
  await store.updateRoomRequest(adminAlias, {
    id: 'room-fall-2026-secondary',
    status: 'submitted',
  })
  await store.updateRoomRequest(adminAlias, {
    id: 'room-fall-2026-secondary',
    status: 'approved',
    roomName: 'R0320',
    reference: 'ROSS-APPROVAL-789',
  })
  const lead = (await store.workspace(adminAlias)).leads.find((item) => item.id === 'rich-donovan')!
  await store.updateLead(adminAlias, { id: lead.id, proposedSlots: lead.proposedSlots.map((slot) => ({ ...slot, status: slot.startAt === '2026-11-17T18:30:00-05:00' ? 'accepted' : slot.status })) })
  await store.updateSlot(adminAlias, { id: 'fall-2026-secondary', leadId: 'rich-donovan' })
  const result = await store.updateSlot(adminAlias, { id: 'fall-2026-secondary', status: 'confirmed' })
  assert.equal(result.ok, true)
  assert.equal((await store.workspace(adminAlias)).viewer.canConfirmProgram, true)
})

test('failed slot confirmation persists no lead, date, label, or status edits', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const before = (await store.workspace(sam)).slots.find((slot) => slot.id === 'fall-2026-secondary')!
  const result = await store.updateSlot(sam, {
    id: before.id,
    leadId: 'deb-ruh',
    preferredStart: '2026-12-31T23:00:00-05:00',
    status: 'confirmed',
  })
  assert.equal(result.ok, false)
  const after = (await store.workspace(sam)).slots.find((slot) => slot.id === before.id)!
  assert.deepEqual(after, before)
})

test('room approval requires submitted state, evidence, and a stable admin actor', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))
  assert.equal((await store.updateRoomRequest(sam, {
    id: 'room-fall-2026-primary',
    status: 'submitted',
  })).ok, true)
  const denied = await store.updateRoomRequest(alex, {
    id: 'room-fall-2026-primary',
    status: 'approved',
    roomName: 'R1230',
    reference: 'ROSS-APPROVAL-123',
  })
  assert.match(denied.ok ? '' : denied.error, /workspace administrator/i)
  const persisted = (await store.workspace(sam)).roomRequests.find((request) => request.id === 'room-fall-2026-primary')!
  assert.equal(persisted.status, 'submitted')
  assert.equal(persisted.roomName, '')
  assert.equal(persisted.reference, '')
})

test('two programmed slots require distinct eligible Fall 2026 speakers and synchronize labels', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const duplicate = await store.updateSlot(sam, { id: 'fall-2026-secondary', leadId: 'deb-ruh' })
  assert.match(duplicate.ok ? '' : duplicate.error, /different speaker/i)
  const winter = await store.updateSlot(sam, { id: 'fall-2026-secondary', leadId: 'mindy-scheier' })
  assert.match(winter.ok ? '' : winter.error, /eligible fall 2026/i)
  const saved = await store.updateSlot(sam, { id: 'fall-2026-secondary', leadId: 'rich-donovan' })
  assert.equal(saved.ok, true)
  assert.equal(saved.ok && saved.slot.label, 'Fall fireside · Rich Donovan')
})

test('migrates legacy state without retaining password or session data', async (t) => {
  const { directory, dataPath, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const seeded = await store.workspace(sam)
  const leads = Object.fromEntries(seeded.leads.map((lead) => [lead.id, { ...lead }]))
  leads['deb-ruh'].nextAction = 'Preserve this business update.'
  await writeFile(dataPath, `${JSON.stringify({
    version: 2,
    leads,
    slots: Object.fromEntries(seeded.slots.map((slot) => [slot.id, slot])),
    roomRequests: Object.fromEntries(seeded.roomRequests.map((request) => [request.id, request])),
    activity: seeded.activity,
    accounts: { 'sbodine@umich.edu': { passwordHash: 'legacy-secret-hash' } },
    sessions: { 'legacy-session-hash': { email: 'sbodine@umich.edu' } },
  }, null, 2)}\n`)

  const workspace = await store.workspace(sam)
  assert.equal(workspace.leads.find((lead) => lead.id === 'deb-ruh')?.nextAction, 'Preserve this business update.')

  const migrated = JSON.parse(await readFile(dataPath, 'utf8')) as Record<string, unknown>
  assert.equal(migrated.version, 4)
  assert.equal('accounts' in migrated, false)
  assert.equal('sessions' in migrated, false)
  assert.equal(JSON.stringify(migrated).includes('legacy-secret-hash'), false)
  assert.equal(JSON.stringify(migrated).includes('legacy-session-hash'), false)
})

test('v3 migration applies the two-event decision while preserving ordinary lead edits', async (t) => {
  const { directory, dataPath, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const seeded = await store.workspace(sam)
  const leads = Object.fromEntries(seeded.leads.map((lead) => [lead.id, { ...lead }]))
  leads['rich-donovan'].term = 'winter-2027'
  leads['rich-donovan'].nextAction = 'Preserve this custom follow-up.'
  leads['neil-milliken'].term = 'fall-2026'
  leads['microsoft-alum'].term = 'fall-2026'
  leads['tiffany-yu'].stage = 'funding-blocked'
  await writeFile(dataPath, `${JSON.stringify({
    version: 3,
    leads,
    slots: {
      'fall-2026': { ...seeded.slots[0], id: 'fall-2026', preferredStart: '2026-10-08T19:00:00-04:00' },
      'winter-2027': { ...seeded.slots[1], id: 'winter-2027', term: 'winter-2027' },
    },
    roomRequests: {},
    activity: [],
  })}\n`)

  const workspace = await store.workspace(sam)
  assert.partialDeepStrictEqual(workspace.leads.find((lead) => lead.id === 'rich-donovan'), {
    term: 'fall-2026',
    recommendation: 'recommended',
    recommendationRank: 2,
    nextAction: 'Preserve this custom follow-up.',
  })
  assert.equal(workspace.leads.find((lead) => lead.id === 'neil-milliken')?.term, 'winter-2027')
  assert.equal(workspace.leads.find((lead) => lead.id === 'microsoft-alum')?.term, 'winter-2027')
  assert.equal(workspace.leads.find((lead) => lead.id === 'tiffany-yu')?.stage, 'closed')
  assert.equal(workspace.slots.find((slot) => slot.id === 'fall-2026-primary')?.preferredStart, '2026-10-01T18:30:00-04:00')
  assert.equal(workspace.slots.find((slot) => slot.id === 'fall-2026-secondary')?.preferredStart, '2026-11-17T18:30:00-05:00')
})

test('normalizes only known v4 research, contact, and calendar placeholders', async (t) => {
  const { directory, dataPath, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const seeded = await store.workspace(sam)
  const leads = Object.fromEntries(seeded.leads.map((lead) => [lead.id, { ...lead, proposedSlots: lead.proposedSlots.map((slot) => ({ ...slot })) }]))
  leads['tiffany-yu'].researchNotes = 'Public profile research has not been completed.'
  leads['diego-mariscal'].researchNotes = 'Keep this custom source limitation.'
  leads['rich-donovan'].lastContactAt = '2026-07-28T16:00:00.000Z'
  leads['rich-donovan'].evidence = 'Direct Gmail acceptance: he would be delighted to speak and told UBLDA to tell him when.'
  leads['rich-donovan'].proposedSlots[0].evidence = 'Clear across all nine board calendars; after Ross Tech Week and eight days before Thanksgiving.'
  await writeFile(dataPath, `${JSON.stringify({
    version: 4,
    leads,
    slots: Object.fromEntries(seeded.slots.map((slot) => [slot.id, slot])),
    roomRequests: Object.fromEntries(seeded.roomRequests.map((request) => [request.id, request])),
    activity: [],
  })}\n`)

  const workspace = await store.workspace(sam)
  const rich = workspace.leads.find((lead) => lead.id === 'rich-donovan')
  assert.equal(rich?.lastContactAt, '2026-07-30')
  assert.match(rich?.evidence || '', /Jul 30 verified Gmail/)
  assert.match(rich?.proposedSlots[0]?.evidence || '', /dated calendar snapshot/i)
  assert.match(rich?.proposedSlots[0]?.evidence || '', /re-check live calendars/i)
  assert.doesNotMatch(workspace.leads.find((lead) => lead.id === 'tiffany-yu')?.researchNotes || '', /not been completed/i)
  assert.equal(workspace.leads.find((lead) => lead.id === 'diego-mariscal')?.researchNotes, 'Keep this custom source limitation.')
})

test('bounds and sanitizes speaker research and scoring updates', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const result = await store.updateLead(sam, {
    id: 'deb-ruh',
    drawScore: 99,
    missionFitScore: -3,
    quotedFee: 2_000_000,
    shortBio: '<script>verified profile</script>',
    researchLinks: [
      { label: '<b>Safe source</b>', url: 'https://example.com/profile' },
      { label: 'Unsafe source', url: 'javascript:alert(1)' },
    ],
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.lead.drawScore, 5)
  assert.equal(result.lead.missionFitScore, 1)
  assert.equal(result.lead.quotedFee, 1_000_000)
  assert.equal(result.lead.shortBio.includes('<'), false)
  assert.deepEqual(result.lead.researchLinks, [{ label: 'bSafe source/b', url: 'https://example.com/profile' }])
})
