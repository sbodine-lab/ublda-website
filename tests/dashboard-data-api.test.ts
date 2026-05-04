import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
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

const createLocalAdminToken = (secret: string) => {
  const payload = Buffer.from(JSON.stringify({
    email: 'sbodine@umich.edu',
    exp: Date.now() + 1000 * 60 * 60,
  })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')

  return `ublda_admin.${payload}.${signature}`
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

test('loads the explicitly enabled Vercel fallback dashboard for Sam', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-dashboard-api-'))

  delete process.env.GOOGLE_SCRIPT_URL
  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'secure-password'
  process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = 'true'
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: {},
      body: { sessionToken: createLocalAdminToken('secure-password') },
    }, res)

    assert.equal(result().statusCode, 200)
    const payload = result().payload as Record<string, unknown>
    assert.equal(payload.success, true)
    const dashboardData = payload.dashboardData as Record<string, unknown>
    assert.deepEqual(dashboardData.candidates, [])
    assert.equal((dashboardData.backendStatus as Record<string, unknown>).source, 'vercel')
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
    if (originalDataFile === undefined) {
      delete process.env.UBLDA_LOCAL_DATA_FILE
    } else {
      process.env.UBLDA_LOCAL_DATA_FILE = originalDataFile
    }
  }
})

test('uses a live sheet dashboard for an enabled Vercel fallback Sam session when the script backend exists', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalFetch = globalThis.fetch
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-dashboard-api-'))
  const forwardedBodies: Record<string, unknown>[] = []

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'secure-password'
  process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = 'true'
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body || '{}'))
    forwardedBodies.push(body)

    if (body.action === 'googleSignIn') {
      return new Response(JSON.stringify({
        success: true,
        sessionToken: 'sheet-session-token-sheet-session-token',
        account: {
          firstName: 'Sam',
          lastName: 'Bodine',
          uniqname: 'sbodine',
          email: 'sbodine@umich.edu',
        },
      }), { status: 200 })
    }

    return new Response(JSON.stringify({
      success: true,
      role: 'super-admin',
      dashboardData: {
        interviewerAvailability: [
          {
            name: 'Sam Bodine',
            role: 'Super Admin',
            availability: ['2026-05-07T08:00:00-04:00/2026-05-07T08:30:00-04:00'],
            maxInterviews: '2',
          },
        ],
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
      body: { sessionToken: createLocalAdminToken('secure-password') },
    }, res)

    assert.equal(result().statusCode, 200)
    const payload = result().payload as Record<string, unknown>
    const dashboardData = payload.dashboardData as Record<string, unknown>
    assert.equal((dashboardData.backendStatus as Record<string, unknown>).source, 'sheets')
    assert.equal((dashboardData.interviewerAvailability as unknown[]).length, 1)
    assert.equal(forwardedBodies[0].action, 'googleSignIn')
    assert.equal(forwardedBodies[1].action, 'dashboardData')
    assert.equal(forwardedBodies[1].sessionToken, 'sheet-session-token-sheet-session-token')
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
    if (originalDataFile === undefined) {
      delete process.env.UBLDA_LOCAL_DATA_FILE
    } else {
      process.env.UBLDA_LOCAL_DATA_FILE = originalDataFile
    }
    globalThis.fetch = originalFetch
  }
})

test('does not accept a Vercel fallback dashboard token when fallback is disabled', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
  const originalFetch = globalThis.fetch
  let forwarded = false

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'secure-password'
  delete process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
  globalThis.fetch = async () => {
    forwarded = true
    return new Response(JSON.stringify({
      success: false,
      error: 'A valid member session is required.',
    }), { status: 200 })
  }

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: {},
      body: { sessionToken: createLocalAdminToken('secure-password') },
    }, res)

    assert.equal(result().statusCode, 401)
    assert.equal(forwarded, true)
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
