import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createSpeakerOpsStore } from '../server/speakerOpsStore.ts'
import { SPEAKER_OPS_MEMBERS, SPEAKER_OPS_SESSION_DAYS } from '../src/lib/speakerOps.ts'

const buildStore = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ublda-speaker-ops-'))
  const store = createSpeakerOpsStore(path.join(directory, 'speaker-ops.json'), { forceLocal: true })
  const passwords = Object.fromEntries(SPEAKER_OPS_MEMBERS.map((member) => [member.email, `Temp-${member.email}-2026!`]))
  await store.provisionAccounts(passwords)
  return { directory, store, passwords }
}

test('provisions only the nine allowlisted leadership accounts', async (t) => {
  const { directory, store, passwords } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  assert.equal(await store.signIn('outsider@umich.edu', 'anything'), null)
  for (const member of SPEAKER_OPS_MEMBERS) {
    const session = await store.signIn(member.email, passwords[member.email])
    assert.equal(session?.account.email, member.email)
    assert.equal(session?.account.mustChangePassword, true)
  }
})

test('uses a 180-day session and requires a first-login password change', async (t) => {
  const { directory, store, passwords } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))

  const session = await store.signIn('andsack@umich.edu', passwords['andsack@umich.edu'])
  assert.ok(session)
  const durationDays = (new Date(session.sessionExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  assert.ok(durationDays > SPEAKER_OPS_SESSION_DAYS - 0.01)
  assert.ok(durationDays <= SPEAKER_OPS_SESSION_DAYS)

  const changed = await store.changePassword(
    session.sessionToken,
    passwords['andsack@umich.edu'],
    'A-new-private-password-2026!',
  )
  assert.equal(changed.ok, true)
  if (changed.ok) assert.equal(changed.account.mustChangePassword, false)
  assert.equal(await store.signIn('andsack@umich.edu', passwords['andsack@umich.edu']), null)
  assert.ok(await store.signIn('andsack@umich.edu', 'A-new-private-password-2026!'))
})

test('loads the reconciled pipeline under the two-event cap', async (t) => {
  const { directory, store, passwords } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const session = await store.signIn('sbodine@umich.edu', passwords['sbodine@umich.edu'])
  assert.ok(session)

  const workspace = await store.workspace(session.sessionToken)
  assert.ok(workspace)
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

test('rejects confirmation until Ross approves a named room', async (t) => {
  const { directory, store, passwords } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const sam = await store.signIn('sbodine@umich.edu', passwords['sbodine@umich.edu'])
  assert.ok(sam)

  const blocked = await store.updateSlot(sam.sessionToken, {
    id: 'fall-2026',
    leadId: 'deb-ruh',
    status: 'confirmed',
  })
  assert.deepEqual(blocked, { ok: false, error: 'Ross must approve the room before the fireside can be confirmed.' })

  const unnamedApproval = await store.updateRoomRequest(sam.sessionToken, {
    id: 'room-fall-2026',
    status: 'approved',
  })
  assert.deepEqual(unnamedApproval, { ok: false, error: 'Enter the Ross room before marking the request approved.' })

  const room = await store.updateRoomRequest(sam.sessionToken, {
    id: 'room-fall-2026',
    status: 'approved',
    roomName: 'R1230',
  })
  assert.equal(room.ok, true)

  const confirmed = await store.updateSlot(sam.sessionToken, {
    id: 'fall-2026',
    leadId: 'deb-ruh',
    status: 'confirmed',
  })
  assert.equal(confirmed.ok, true)
})

test('only Sam or Alexa can confirm a programmed date', async (t) => {
  const { directory, store, passwords } = await buildStore()
  t.after(() => rm(directory, { recursive: true, force: true }))
  const sam = await store.signIn('sbodine@umich.edu', passwords['sbodine@umich.edu'])
  const alex = await store.signIn('alexfors@umich.edu', passwords['alexfors@umich.edu'])
  assert.ok(sam && alex)

  await store.updateRoomRequest(sam.sessionToken, {
    id: 'room-winter-2027',
    status: 'approved',
    roomName: 'R0320',
  })
  await store.updateSlot(alex.sessionToken, { id: 'winter-2027', leadId: 'rich-donovan' })
  const result = await store.updateSlot(alex.sessionToken, { id: 'winter-2027', status: 'confirmed' })
  assert.deepEqual(result, { ok: false, error: 'Only Sam or Alexa can confirm a programmed date.' })
})
