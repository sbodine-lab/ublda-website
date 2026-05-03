import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/interviewer-availability.ts'
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

test('forwards validated interviewer availability to the configured script', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalFetch = globalThis.fetch
  let forwardedBody: Record<string, unknown> | null = null

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  globalThis.fetch = async (_url, init) => {
    forwardedBody = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: { 'user-agent': 'api-handler-test' },
      body: {
        firstName: 'Cooper',
        lastName: 'Ryan',
        uniqname: 'cooperry',
        availability: [INTERVIEW_SLOTS[0].value, INTERVIEW_SLOTS[1].value],
        maxInterviews: '2',
        notes: '',
        website: '',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal(forwardedBody?.formType, 'interviewerAvailability')
    assert.equal(forwardedBody?.email, 'cooperry@umich.edu')
    assert.equal((forwardedBody?.availability as unknown[]).length, 2)
    assert.equal(forwardedBody?.dedupeKey, 'cooperry@umich.edu')
    assert.match(String(forwardedBody?.submissionId), /^interviewer_/)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    globalThis.fetch = originalFetch
  }
})
