import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { getCraftNightState, handleCraftNightAction } from '../server/craftNightService.ts'
import { CRAFT_NIGHT_OPTION_IDS, CRAFT_NIGHT_ROSTER } from '../src/lib/craftNight.ts'
import handler from '../api/craft-night.ts'
import type { VercelRequest, VercelResponse } from '../server/types.ts'

delete process.env.BLOB_READ_WRITE_TOKEN

const leadership = {
  verifyIdentity: async (idToken: string) => {
    if (idToken !== 'canonical-id-token') {
      throw Object.assign(new Error('Your leadership sign-in is invalid or expired.'), { status: 401 })
    }
    return { email: 'sbodine@umich.edu' }
  },
}

const sam = CRAFT_NIGHT_ROSTER.find((member) => member.email === 'sbodine@umich.edu')!
const andrew = CRAFT_NIGHT_ROSTER.find((member) => member.email === 'andsack@umich.edu')!
const [firstOption, secondOption] = CRAFT_NIGHT_OPTION_IDS

const fixture = async (t: test.TestContext) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ublda-craft-night-'))
  process.env.UBLDA_CRAFT_NIGHT_DATA_FILE = path.join(directory, 'craft-night.json')
  t.after(async () => {
    delete process.env.UBLDA_CRAFT_NIGHT_DATA_FILE
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

test('a board member can save and revise their availability', async (t) => {
  await fixture(t)
  const first = await handleCraftNightAction({
    action: 'respond',
    email: sam.email,
    available: [firstOption, secondOption],
    note: 'might run late',
  })
  assert.equal(first.status, 200)

  const revised = await handleCraftNightAction({
    action: 'respond',
    email: sam.email.toUpperCase(),
    available: [secondOption],
    note: '',
  })
  assert.equal(revised.status, 200)

  const state = await getCraftNightState()
  const poll = state.body.poll as { responses: Array<{ email: string; available: string[]; note: string }> }
  assert.equal(poll.responses.length, 1)
  assert.deepEqual(poll.responses[0].available, [secondOption])
  assert.equal(poll.responses[0].note, '')
})

test('rejects names off the roster and options off the ballot', async (t) => {
  await fixture(t)
  const stranger = await handleCraftNightAction({
    action: 'respond',
    email: 'notonboard@umich.edu',
    available: [firstOption],
  })
  assert.equal(stranger.status, 400)

  const fakeOption = await handleCraftNightAction({
    action: 'respond',
    email: sam.email,
    available: ['never-oclock'],
  })
  assert.equal(fakeOption.status, 400)

  const state = await getCraftNightState()
  assert.equal((state.body.poll as { responses: unknown[] }).responses.length, 0)
})

test('admin actions require a leadership identity and closing the poll blocks new responses', async (t) => {
  await fixture(t)
  const badToken = await handleCraftNightAction(
    { action: 'set-status', status: 'closed', idToken: 'wrong' },
    leadership,
  )
  assert.equal(badToken.status, 401)

  const closed = await handleCraftNightAction(
    { action: 'set-status', status: 'closed', idToken: 'canonical-id-token' },
    leadership,
  )
  assert.equal(closed.status, 200)

  const lateVote = await handleCraftNightAction({
    action: 'respond',
    email: andrew.email,
    available: [firstOption],
  })
  assert.equal(lateVote.status, 409)

  const reopened = await handleCraftNightAction(
    { action: 'set-status', status: 'open', idToken: 'canonical-id-token' },
    leadership,
  )
  assert.equal(reopened.status, 200)
  const vote = await handleCraftNightAction({
    action: 'respond',
    email: andrew.email,
    available: [firstOption],
  })
  assert.equal(vote.status, 200)
})

test('locking a final option closes the poll and clearing removes one response', async (t) => {
  await fixture(t)
  await handleCraftNightAction({ action: 'respond', email: sam.email, available: [firstOption] })
  await handleCraftNightAction({ action: 'respond', email: andrew.email, available: [firstOption] })

  const finalized = await handleCraftNightAction({
    action: 'set-final',
    optionId: firstOption,
    idToken: 'canonical-id-token',
  }, leadership)
  assert.equal(finalized.status, 200)
  const finalPoll = finalized.body.poll as { status: string; finalOptionId: string }
  assert.equal(finalPoll.status, 'closed')
  assert.equal(finalPoll.finalOptionId, firstOption)

  const cleared = await handleCraftNightAction({
    action: 'clear-response',
    email: andrew.email,
    idToken: 'canonical-id-token',
  }, leadership)
  assert.equal(cleared.status, 200)
  assert.equal((cleared.body.poll as { responses: unknown[] }).responses.length, 1)
})

test('the API handler serves state, swallows honeypot posts, and rejects other methods', async (t) => {
  await fixture(t)

  const getRes = fakeResponse()
  await handler({ method: 'GET' } as unknown as VercelRequest, getRes)
  assert.equal(getRes.statusCode, 200)
  assert.ok((getRes.payload as { poll: { status: string } }).poll.status)

  const botRes = fakeResponse()
  await handler({
    method: 'POST',
    body: { action: 'respond', email: sam.email, available: [firstOption], website: 'spam.example' },
  } as unknown as VercelRequest, botRes)
  assert.equal(botRes.statusCode, 200)

  const state = await getCraftNightState()
  assert.equal((state.body.poll as { responses: unknown[] }).responses.length, 0)

  const putRes = fakeResponse()
  await handler({ method: 'PUT' } as unknown as VercelRequest, putRes)
  assert.equal(putRes.statusCode, 405)
})
