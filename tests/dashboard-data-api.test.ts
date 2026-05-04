import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/dashboard-data.ts'

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

test('loads dashboard data through the configured account backend', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalFetch = globalThis.fetch
  let forwardedBody: Record<string, unknown> | null = null

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  globalThis.fetch = async (_url, init) => {
    forwardedBody = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({
      success: true,
      role: 'super-admin',
      dashboardData: {
        backendStatus: {
          source: 'sheets',
          message: 'Loaded from Google Sheets',
          updatedAt: '2026-05-04T00:00:00.000Z',
        },
      },
    }), { status: 200 })
  }

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: {},
      body: { sessionToken: 'session-token-session-token-session' },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal(forwardedBody?.formType, 'applicantAccount')
    assert.equal(forwardedBody?.action, 'dashboardData')
    assert.equal(forwardedBody?.sessionToken, 'session-token-session-token-session')
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    globalThis.fetch = originalFetch
  }
})

test('rejects dashboard data requests without a session', async () => {
  const { res, result } = createResponse()

  await handler({
    method: 'POST',
    headers: {},
    body: { sessionToken: 'short' },
  }, res)

  assert.equal(result().statusCode, 401)
})
