import assert from 'node:assert/strict'
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

test('forwards validated interview assignments to the configured script', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalAdminToken = process.env.INTERVIEW_ADMIN_TOKEN
  const originalFetch = globalThis.fetch
  let forwardedBody: Record<string, unknown> | null = null

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  process.env.INTERVIEW_ADMIN_TOKEN = 'test-admin-token'
  globalThis.fetch = async (_url, init) => {
    forwardedBody = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({ success: true, row: 4 }), { status: 200 })
  }

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: {
        'user-agent': 'api-handler-test',
        'x-ublda-admin-token': 'test-admin-token',
      },
      body: {
        email: 'candidate@umich.edu',
        assignedSlot: INTERVIEW_SLOTS[0].value,
        interviewers: ['Sam Bodine'],
        interviewStatus: 'Matched',
        feedback: 'Good interview.',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal(forwardedBody?.formType, 'interviewAssignment')
    assert.equal(forwardedBody?.email, 'candidate@umich.edu')
    assert.equal((forwardedBody?.assignedSlot as Record<string, unknown>).value, INTERVIEW_SLOTS[0].value)
    assert.deepEqual(forwardedBody?.interviewers, ['Sam Bodine'])
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    if (originalAdminToken === undefined) {
      delete process.env.INTERVIEW_ADMIN_TOKEN
    } else {
      process.env.INTERVIEW_ADMIN_TOKEN = originalAdminToken
    }
    globalThis.fetch = originalFetch
  }
})

test('rejects assignment updates without the admin token', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalAdminToken = process.env.INTERVIEW_ADMIN_TOKEN

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  process.env.INTERVIEW_ADMIN_TOKEN = 'test-admin-token'

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: { 'user-agent': 'api-handler-test' },
      body: {
        email: 'candidate@umich.edu',
        assignedSlot: INTERVIEW_SLOTS[0].value,
        interviewStatus: 'Matched',
      },
    }, res)

    assert.equal(result().statusCode, 401)
    assert.match(String((result().payload as Record<string, unknown>).error), /admin token/i)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    if (originalAdminToken === undefined) {
      delete process.env.INTERVIEW_ADMIN_TOKEN
    } else {
      process.env.INTERVIEW_ADMIN_TOKEN = originalAdminToken
    }
  }
})
