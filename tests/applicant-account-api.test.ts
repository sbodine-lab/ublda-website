import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/applicant-account.ts'

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

test('creates an applicant account through the configured script backend', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalFetch = globalThis.fetch
  let forwardedBody: Record<string, unknown> | null = null

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  globalThis.fetch = async (_url, init) => {
    forwardedBody = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({
      success: true,
      sessionToken: 'token-token-token-token-token-token',
      account: {
        firstName: 'Alex',
        lastName: 'Chen',
        uniqname: 'alexchen',
        email: 'alexchen@umich.edu',
      },
      application: null,
    }), { status: 200 })
  }

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: {
        origin: 'https://ublda.org',
        host: 'ublda.org',
      },
      body: {
        action: 'create',
        firstName: 'Alex',
        lastName: 'Chen',
        uniqname: 'AlexChen',
        password: 'secure-password',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal(forwardedBody?.formType, 'applicantAccount')
    assert.equal(forwardedBody?.action, 'create')
    assert.equal((forwardedBody?.account as Record<string, unknown>).email, 'alexchen@umich.edu')
    assert.equal(forwardedBody?.password, 'secure-password')
    assert.equal(forwardedBody?.origin, 'https://ublda.org')
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    globalThis.fetch = originalFetch
  }
})

test('signs Sam in with the configured super-admin password before creating a backend session', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFetch = globalThis.fetch
  let forwardedBody: Record<string, unknown> | null = null

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'secure-password'
  globalThis.fetch = async (_url, init) => {
    forwardedBody = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({
      success: true,
      sessionToken: 'token-token-token-token-token-token',
      account: {
        firstName: 'Sam',
        lastName: 'Bodine',
        uniqname: 'sbodine',
        email: 'sbodine@umich.edu',
      },
      application: null,
    }), { status: 200 })
  }

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: {
        origin: 'https://ublda.org',
        host: 'ublda.org',
      },
      body: {
        action: 'signIn',
        uniqname: 'sbodine',
        password: 'secure-password',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal(forwardedBody?.action, 'googleSignIn')
    assert.equal((forwardedBody?.account as Record<string, unknown>).email, 'sbodine@umich.edu')
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
    globalThis.fetch = originalFetch
  }
})

test('verifies Google sign-in before forwarding an account session request', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID
  const originalFetch = globalThis.fetch
  const forwardedBodies: Record<string, unknown>[] = []

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  process.env.GOOGLE_CLIENT_ID = 'google-client-id'
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      return new Response(JSON.stringify({
        aud: 'google-client-id',
        email: 'alexchen@umich.edu',
        email_verified: true,
        given_name: 'Alex',
        family_name: 'Chen',
      }), { status: 200 })
    }

    forwardedBodies.push(JSON.parse(String(init?.body || '{}')))
    return new Response(JSON.stringify({
      success: true,
      sessionToken: 'token-token-token-token-token-token',
      account: {
        firstName: 'Alex',
        lastName: 'Chen',
        uniqname: 'alexchen',
        email: 'alexchen@umich.edu',
      },
      application: null,
    }), { status: 200 })
  }

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: {
        origin: 'https://ublda.org',
        host: 'ublda.org',
      },
      body: {
        action: 'googleSignIn',
        credential: 'google-token-google-token-google-token',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal(forwardedBodies[0]?.action, 'googleSignIn')
    assert.equal((forwardedBodies[0]?.account as Record<string, unknown>).email, 'alexchen@umich.edu')
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    if (originalGoogleClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID
    } else {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId
    }
    globalThis.fetch = originalFetch
  }
})
