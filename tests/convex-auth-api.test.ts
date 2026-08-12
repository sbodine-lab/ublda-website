import assert from 'node:assert/strict'
import test from 'node:test'
import { authBridgeExchangeFailureStatus, convexAuthHandler } from '../server/convexAuthApi.ts'
import { AuthBridgeTokenError, type AuthBridgeConfig } from '../server/convexAuthBridge.ts'
import type { VercelRequest, VercelResponse } from '../server/types.ts'

const config: AuthBridgeConfig = {
  logtoIssuer: 'https://example.logto.app/oidc',
  logtoAppId: 'logto-app',
  logtoJwksUrl: 'https://example.logto.app/oidc/jwks',
  bridgeIssuer: 'https://example.org/api/convex-auth',
  bridgeAppId: 'ublda-convex',
  signingPrivateKey: 'unused-by-handler-test',
  publicJwks: {
    keys: [{
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: 'bridge-key',
      n: 'public-modulus',
      e: 'AQAB',
    }],
  },
  allowedOrigins: new Set(['https://example.org']),
}

const responseFixture = () => {
  let statusCode = 0
  let payload: unknown
  const headers = new Map<string, string>()
  const response = {
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value)
      return response
    },
    status(code: number) {
      statusCode = code
      return response
    },
    json(body: unknown) {
      payload = body
      return response
    },
    send(body: unknown) {
      payload = body
      return response
    },
  } satisfies VercelResponse
  return {
    response,
    result: () => ({ statusCode, payload, headers }),
  }
}

const postRequest = (
  headers: VercelRequest['headers'] = {},
  body: unknown = { idToken: 'verified-logto-id-token' },
): VercelRequest => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: 'https://example.org',
    'sec-fetch-site': 'same-origin',
    ...headers,
  },
  body,
})

test('serves the public bridge JWKS without requiring browser request headers', async () => {
  const fixture = responseFixture()
  await convexAuthHandler({ method: 'GET', headers: {} }, fixture.response, { config })

  const result = fixture.result()
  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.payload, config.publicJwks)
  assert.match(result.headers.get('cache-control') || '', /public/)
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff')
})

test('exchanges a same-origin JSON Logto token and returns a no-store response', async () => {
  const fixture = responseFixture()
  let receivedToken = ''
  await convexAuthHandler(postRequest(), fixture.response, {
    config,
    exchange: async (idToken) => {
      receivedToken = idToken
      return { token: 'short-lived-convex-token', expiresIn: 300 }
    },
  })

  const result = fixture.result()
  assert.equal(receivedToken, 'verified-logto-id-token')
  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.payload, { token: 'short-lived-convex-token', expiresIn: 300 })
  assert.match(result.headers.get('cache-control') || '', /no-store/)
  assert.equal(result.headers.get('referrer-policy'), 'no-referrer')
})

test('rejects missing, unapproved, and cross-site browser origins before token exchange', async () => {
  let exchanges = 0
  const exchange = async () => {
    exchanges += 1
    return { token: 'should-not-be-issued', expiresIn: 300 }
  }
  const cases = [
    postRequest({ origin: '' }),
    postRequest({ origin: 'https://attacker.example' }),
    postRequest({ 'sec-fetch-site': 'cross-site' }),
  ]

  for (const request of cases) {
    const fixture = responseFixture()
    await convexAuthHandler(request, fixture.response, { config, exchange })
    assert.equal(fixture.result().statusCode, 403)
  }
  assert.equal(exchanges, 0)
})

test('requires JSON and enforces the auth request body limit before exchange', async () => {
  const wrongType = responseFixture()
  await convexAuthHandler(
    postRequest({ 'content-type': 'text/plain' }),
    wrongType.response,
    { config },
  )
  assert.equal(wrongType.result().statusCode, 415)

  const oversized = responseFixture()
  await convexAuthHandler(
    postRequest({ 'content-length': String(33 * 1_024) }),
    oversized.response,
    { config },
  )
  assert.equal(oversized.result().statusCode, 413)
})

test('returns and logs only generic details when token verification fails', async () => {
  const fixture = responseFixture()
  const logLines: string[] = []
  const originalConsoleError = console.error
  console.error = (...values: unknown[]) => {
    logLines.push(values.map(String).join(' '))
  }
  try {
    await convexAuthHandler(postRequest(), fixture.response, {
      config,
      exchange: async () => {
        throw new AuthBridgeTokenError('rejected verified-logto-id-token')
      },
    })
  } finally {
    console.error = originalConsoleError
  }

  assert.equal(fixture.result().statusCode, 401)
  assert.deepEqual(fixture.result().payload, {
    error: 'The leadership sign-in session could not be verified.',
  })
  assert.equal(logLines.some((line) => line.includes('verified-logto-id-token')), false)
})

test('distinguishes rejected tokens from bridge or provider outages', async () => {
  assert.equal(authBridgeExchangeFailureStatus(new AuthBridgeTokenError('bad claims')), 401)
  assert.equal(authBridgeExchangeFailureStatus({ code: 'ERR_JWT_EXPIRED' }), 401)
  assert.equal(authBridgeExchangeFailureStatus({ code: 'ERR_JWKS_TIMEOUT' }), 503)
  assert.equal(authBridgeExchangeFailureStatus(new Error('signing key mismatch')), 503)

  const fixture = responseFixture()
  await convexAuthHandler(postRequest(), fixture.response, {
    config,
    exchange: async () => { throw new Error('provider unavailable') },
  })
  assert.equal(fixture.result().statusCode, 503)
  assert.deepEqual(fixture.result().payload, {
    error: 'Leadership authentication is temporarily unavailable.',
  })
})

test('rejects unsupported methods and advertises only GET and POST', async () => {
  const fixture = responseFixture()
  await convexAuthHandler({ method: 'PUT', headers: {} }, fixture.response, { config })

  assert.equal(fixture.result().statusCode, 405)
  assert.equal(fixture.result().headers.get('allow'), 'GET, POST')
})
