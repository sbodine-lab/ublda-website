import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import handler from '../api/interview-assignment.ts'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'

const createResponse = () => {
  let statusCode = 0
  let payload: unknown = null

  return {
    res: {
      status(code: number) {
        statusCode = code
        return this
      },
      json(body: unknown) {
        payload = body
        return this
      },
    },
    result() {
      return { statusCode, payload }
    },
  }
}

const createRetiredAdminToken = (secret: string) => {
  const payload = Buffer.from(JSON.stringify({
    email: 'sbodine@umich.edu',
    exp: Date.now() + 1000 * 60 * 60,
  })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `ublda_admin.${payload}.${signature}`
}

const assignmentBody = (sessionToken?: string) => ({
  email: 'candidate@umich.edu',
  assignedSlot: INTERVIEW_SLOTS[0].value,
  interviewers: ['Sam Bodine'],
  interviewStatus: 'Matched',
  feedback: 'Good interview.',
  ...(sessionToken ? { sessionToken } : {}),
})

test('rejects a previously valid shared-password interview-assignment session', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
  const originalFetch = globalThis.fetch
  let fetchCalled = false

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'retired-password'
  process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = 'true'
  globalThis.fetch = async () => {
    fetchCalled = true
    throw new Error('retired endpoint must not call Apps Script')
  }

  try {
    const response = createResponse()
    await handler({
      method: 'POST',
      headers: { 'user-agent': 'api-handler-test' },
      body: assignmentBody(createRetiredAdminToken('retired-password')),
    }, response.res)

    assert.equal(response.result().statusCode, 401)
    assert.match(String((response.result().payload as Record<string, unknown>).error), /retired/i)
    assert.equal(fetchCalled, false)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    if (originalPassword === undefined) {
      delete process.env.UBLDA_SUPER_ADMIN_PASSWORD
    } else {
      process.env.UBLDA_SUPER_ADMIN_PASSWORD = originalPassword
    }
    if (originalFallback === undefined) {
      delete process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
    } else {
      process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = originalFallback
    }
    globalThis.fetch = originalFetch
  }
})

test('rejects assignment updates without a legacy admin session', async () => {
  const response = createResponse()
  await handler({
    method: 'POST',
    headers: {},
    body: assignmentBody(),
  }, response.res)

  assert.equal(response.result().statusCode, 401)
})

test('rejects arbitrary local and Apps Script tokens on the retired endpoint', async () => {
  for (const sessionToken of [
    'local_existing-admin-session-token-that-was-already-issued',
    'apps-script-admin-session-token-apps-script-admin-session',
  ]) {
    const response = createResponse()
    await handler({
      method: 'POST',
      headers: {},
      body: assignmentBody(sessionToken),
    }, response.res)

    assert.equal(response.result().statusCode, 401)
    assert.match(String((response.result().payload as Record<string, unknown>).error), /retired/i)
  }
})
