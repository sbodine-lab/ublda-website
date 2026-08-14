import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { handleOperationsRequest } from '../server/operationsService.ts'
import { createOperationsStore } from '../server/operationsStore.ts'
import type { SpeakerOpsActor } from '../server/speakerOpsStore.ts'

const sam: SpeakerOpsActor = { memberId: 'sam', displayName: 'Sam', email: 'sbodine@umich.edu', role: 'admin' }
const officer: SpeakerOpsActor = { memberId: 'andrew', displayName: 'Andrew', email: 'andsack@umich.edu', role: 'admin' }

const fixture = async (actor = sam) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ublda-operations-service-'))
  return {
    directory,
    store: createOperationsStore(path.join(directory, 'operations.json'), { forceLocal: true }),
    verifyIdentity: async (token: string) => {
      assert.equal(token, 'canonical-id-token')
      return actor
    },
  }
}

test('requires a verified leadership identity for Operations', async () => {
  const response = await handleOperationsRequest({ action: 'workspace' })
  assert.equal(response.status, 401)
})

test('permits read-only officer views but denies privileged writes at the service boundary', async (t) => {
  const options = await fixture(officer)
  t.after(() => rm(options.directory, { recursive: true, force: true }))
  const read = await handleOperationsRequest({ action: 'workspace', idToken: 'canonical-id-token' }, 'local', options)
  assert.equal(read.status, 200)
  assert.equal((read.body.workspace as { viewer: { canWrite: boolean } }).viewer.canWrite, false)

  const write = await handleOperationsRequest({
    action: 'updateAccount',
    idToken: 'canonical-id-token',
    account: { email: officer.email, role: 'member' },
  }, 'local', options)
  assert.equal(write.status, 403)
  assert.match(String(write.body.error), /three operations super admins/i)
})

test('allows a fixed super admin to update attendance through the service', async (t) => {
  const options = await fixture(sam)
  t.after(() => rm(options.directory, { recursive: true, force: true }))
  const response = await handleOperationsRequest({
    action: 'updateAttendance',
    idToken: 'canonical-id-token',
    attendance: {
      eventId: 'team-meeting-2026-08-14',
      memberEmail: officer.email,
      status: 'present',
      notes: 'Recorded during the meeting.',
    },
  }, 'local', options)
  assert.equal(response.status, 200)
  assert.equal((response.body.attendance as { status: string }).status, 'present')
})

test('rejects unknown and retired Operations actions before identity verification', async () => {
  let calls = 0
  const response = await handleOperationsRequest({ action: 'grantAdmin', idToken: 'token' }, 'local', {
    verifyIdentity: async () => {
      calls += 1
      return sam
    },
  })
  assert.equal(response.status, 400)
  assert.equal(calls, 0)
})

test('denies Operations reads after an account is marked inactive', async (t) => {
  const options = await fixture(sam)
  t.after(() => rm(options.directory, { recursive: true, force: true }))
  assert.equal((await options.store.updateAccount(sam, { email: officer.email, role: 'inactive' })).ok, true)
  const response = await handleOperationsRequest({ action: 'workspace', idToken: 'canonical-id-token' }, 'local', {
    store: options.store,
    verifyIdentity: async () => officer,
  })
  assert.equal(response.status, 403)
  assert.match(String(response.body.error), /operations account is inactive/i)
})
