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
        accountCreated: true,
        magicLinkSent: true,
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
    assert.equal((result().payload as Record<string, unknown>).accountCreated, true)
    assert.equal((result().payload as Record<string, unknown>).magicLinkSent, true)
    assert.equal((result().payload as Record<string, unknown>).sessionToken, undefined)
    assert.equal((result().payload as Record<string, unknown>).account, undefined)
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

test('requires an explicit flag before issuing a Vercel fallback super-admin session', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK

  delete process.env.GOOGLE_SCRIPT_URL
  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'secure-password'
  delete process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.10' },
      body: {
        action: 'signIn',
        uniqname: 'sbodine',
        password: 'secure-password',
      },
    }, res)

    assert.equal(result().statusCode, 500)
    assert.match(String((result().payload as Record<string, unknown>).error), /backend not configured/i)
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
  }
})

test('restores an explicitly enabled Vercel fallback super-admin session', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK

  delete process.env.GOOGLE_SCRIPT_URL
  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'secure-password'
  process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = 'true'

  try {
    const signIn = createResponse()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.11' },
      body: {
        action: 'signIn',
        uniqname: 'sbodine',
        password: 'secure-password',
      },
    }, signIn.res)

    assert.equal(signIn.result().statusCode, 200)
    const signInPayload = signIn.result().payload as Record<string, unknown>
    assert.equal(signInPayload.success, true)
    assert.equal(signInPayload.localAdminSession, undefined)
    assert.match(String(signInPayload.sessionToken), /^ublda_admin\./)

    const restoredSession = createResponse()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.11' },
      body: {
        action: 'session',
        sessionToken: String(signInPayload.sessionToken),
      },
    }, restoredSession.res)

    assert.equal(restoredSession.result().statusCode, 200)
    assert.equal(((restoredSession.result().payload as Record<string, unknown>).account as Record<string, unknown>).email, 'sbodine@umich.edu')
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
  }
})

test('rate limits repeated password sign-in failures for the same uniqname and IP', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalFetch = globalThis.fetch
  let backendAttempts = 0

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  globalThis.fetch = async () => {
    backendAttempts += 1
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid uniqname or password.',
    }), { status: 200 })
  }

  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { res, result } = createResponse()
      await handler({
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.12' },
        body: {
          action: 'signIn',
          uniqname: 'ratelimit',
          password: 'wrong-password',
        },
      }, res)

      assert.equal(result().statusCode, 401)
    }

    const blocked = createResponse()
    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.12' },
      body: {
        action: 'signIn',
        uniqname: 'ratelimit',
        password: 'wrong-password',
      },
    }, blocked.res)

    assert.equal(blocked.result().statusCode, 429)
    assert.equal(backendAttempts, 8)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    globalThis.fetch = originalFetch
  }
})

test('surfaces email verification requirements without counting them as bad passwords', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalFetch = globalThis.fetch

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false,
    code: 'EMAIL_VERIFICATION_REQUIRED',
    error: 'Check your UMich email to finish setting up your account before signing in.',
  }), { status: 200 })

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.13' },
      body: {
        action: 'signIn',
        uniqname: 'verifyme',
        password: 'correct-password',
      },
    }, res)

    assert.equal(result().statusCode, 403)
    assert.equal((result().payload as Record<string, unknown>).code, 'EMAIL_VERIFICATION_REQUIRED')
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    globalThis.fetch = originalFetch
  }
})

test('does not reveal whether a magic-link account exists', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalFetch = globalThis.fetch

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false,
    error: 'No applicant account found for that uniqname yet. Create an account first.',
  }), { status: 200 })

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.14' },
      body: {
        action: 'requestMagicLink',
        uniqname: 'unknown',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal((result().payload as Record<string, unknown>).magicLinkSent, false)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
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
