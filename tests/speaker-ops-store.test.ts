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
  assert.deepEqual(workspace.slots.map((slot) => slot.id).sort(), ['fall-2026', 'winter-2027'])
  assert.equal(workspace.leads.some((lead) => lead.name === 'Grant Kessler'), false)
  assert.partialDeepStrictEqual(workspace.leads.find((lead) => lead.id === 'grant-shelton'), {
    name: 'Grant Shelton',
    organization: 'GTH Consulting',
    term: 'winter-2027',
    ownerEmail: 'sdeyoun@umich.edu',
  })
  for (const leadId of ['dustin-giannelli', 'maayan-ziv', 'scott-fiedor']) {
    assert.ok(workspace.leads.some((lead) => lead.id === leadId))
  }
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
    id: 'fall-2026',
    leadId: 'deb-ruh',
    status: 'confirmed',
  })
  assert.deepEqual(blocked, { ok: false, error: 'Ross must approve the room before the fireside can be confirmed.' })

  const unnamedApproval = await store.updateRoomRequest(sam, {
    id: 'room-fall-2026',
    status: 'approved',
  })
  assert.deepEqual(unnamedApproval, { ok: false, error: 'Enter the Ross room before marking the request approved.' })

  const room = await store.updateRoomRequest(sam, {
    id: 'room-fall-2026',
    status: 'approved',
    roomName: 'R1230',
  })
  assert.equal(room.ok, true)

  const confirmed = await store.updateSlot(sam, {
    id: 'fall-2026',
    leadId: 'deb-ruh',
    status: 'confirmed',
  })
  assert.equal(confirmed.ok, true)
})

test('only Sam or Alexa can confirm a programmed date', async (t) => {
  const { directory, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  await store.updateRoomRequest(sam, {
    id: 'room-winter-2027',
    status: 'approved',
    roomName: 'R0320',
  })
  await store.updateSlot(alex, { id: 'winter-2027', leadId: 'rich-donovan' })
  const result = await store.updateSlot(alex, { id: 'winter-2027', status: 'confirmed' })
  assert.deepEqual(result, { ok: false, error: 'Only Sam or Alexa can confirm a programmed date.' })
})

test('migrates legacy state without retaining password or session data', async (t) => {
  const { directory, dataPath, store } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  await store.workspace(sam)
  const current = JSON.parse(await readFile(dataPath, 'utf8')) as Record<string, unknown>
  const leads = current.leads as Record<string, Record<string, unknown>>
  leads['deb-ruh'].nextAction = 'Preserve this business update.'
  await writeFile(dataPath, `${JSON.stringify({
    ...current,
    version: 2,
    accounts: { 'sbodine@umich.edu': { passwordHash: 'legacy-secret-hash' } },
    sessions: { 'legacy-session-hash': { email: 'sbodine@umich.edu' } },
  }, null, 2)}\n`)

  const workspace = await store.workspace(sam)
  assert.equal(workspace.leads.find((lead) => lead.id === 'deb-ruh')?.nextAction, 'Preserve this business update.')

  const migrated = JSON.parse(await readFile(dataPath, 'utf8')) as Record<string, unknown>
  assert.equal(migrated.version, 3)
  assert.equal('accounts' in migrated, false)
  assert.equal('sessions' in migrated, false)
  assert.equal(JSON.stringify(migrated).includes('legacy-secret-hash'), false)
  assert.equal(JSON.stringify(migrated).includes('legacy-session-hash'), false)
})
