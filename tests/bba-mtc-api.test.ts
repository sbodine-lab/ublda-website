import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import handler from '../api/bba-mtc.ts'
import { getBbaMtcShiftState, handleBbaMtcShiftAction } from '../server/bbaMtcShiftService.ts'
import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { BBA_MTC_ROSTER, BBA_MTC_SHIFT_IDS } from '../src/lib/bbaMtcShifts.ts'

delete process.env.BLOB_READ_WRITE_TOKEN

const sam = BBA_MTC_ROSTER.find((member) => member.email === 'sbodine@umich.edu')!
const [setup, kickoff] = BBA_MTC_SHIFT_IDS

const fixture = async (t: test.TestContext) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ublda-bba-mtc-'))
  process.env.UBLDA_BBA_MTC_DATA_FILE = path.join(directory, 'shifts.json')
  t.after(async () => {
    delete process.env.UBLDA_BBA_MTC_DATA_FILE
    await rm(directory, { recursive: true, force: true })
  })
}

type FakeResponse = VercelResponse & { statusCode: number; payload: unknown }

const fakeResponse = (): FakeResponse => {
  const res = {
    statusCode: 0,
    payload: undefined as unknown,
    setHeader: () => res,
    status: (code: number) => {
      res.statusCode = code
      return res
    },
    json: (payload: unknown) => {
      res.payload = payload
      return res
    },
  }
  return res as unknown as FakeResponse
}

test('a board member can save and revise their BBA MTC shifts', async (t) => {
  await fixture(t)
  const first = await handleBbaMtcShiftAction({
    action: 'respond',
    email: sam.email,
    shifts: [setup, kickoff],
  })
  assert.equal(first.status, 200)

  const revised = await handleBbaMtcShiftAction({
    action: 'respond',
    email: sam.email.toUpperCase(),
    shifts: [kickoff],
  })
  assert.equal(revised.status, 200)

  const state = await getBbaMtcShiftState()
  const poll = state.body.poll as { responses: Array<{ shifts: string[] }> }
  assert.equal(poll.responses.length, 1)
  assert.deepEqual(poll.responses[0].shifts, [kickoff])
})

test('rejects an empty signup, names off the roster, and unknown shifts', async (t) => {
  await fixture(t)
  assert.equal((await handleBbaMtcShiftAction({ action: 'respond', email: sam.email, shifts: [] })).status, 400)
  assert.equal((await handleBbaMtcShiftAction({ action: 'respond', email: 'nobody@umich.edu', shifts: [setup] })).status, 400)
  assert.equal((await handleBbaMtcShiftAction({ action: 'respond', email: sam.email, shifts: ['midnight'] })).status, 400)
  const state = await getBbaMtcShiftState()
  assert.equal((state.body.poll as { responses: unknown[] }).responses.length, 0)
})

test('the API serves state, ignores the honeypot, and rejects other methods', async (t) => {
  await fixture(t)
  const getRes = fakeResponse()
  await handler({ method: 'GET' } as unknown as VercelRequest, getRes)
  assert.equal(getRes.statusCode, 200)

  const botRes = fakeResponse()
  await handler({
    method: 'POST',
    body: { action: 'respond', email: sam.email, shifts: [setup], website: 'spam.example' },
  } as unknown as VercelRequest, botRes)
  assert.equal(botRes.statusCode, 200)
  assert.equal(((await getBbaMtcShiftState()).body.poll as { responses: unknown[] }).responses.length, 0)

  const putRes = fakeResponse()
  await handler({ method: 'PUT' } as unknown as VercelRequest, putRes)
  assert.equal(putRes.statusCode, 405)
})
