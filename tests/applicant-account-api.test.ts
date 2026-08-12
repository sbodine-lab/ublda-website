import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/applicant-account.ts'

const createResponse = () => {
  let statusCode = 0
  let payload: unknown = null
  const headers = new Map<string, string>()

  return {
    res: {
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value)
        return this
      },
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
      return { statusCode, payload, headers }
    },
  }
}

test('hard-retires every former applicant authentication action without external calls', async () => {
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    throw new Error('retired applicant auth must not call external services')
  }

  try {
    for (const action of [
      'create',
      'signIn',
      'session',
      'logout',
      'requestMagicLink',
      'googleSignIn',
      'dashboardData',
    ]) {
      const response = createResponse()
      await handler({
        method: 'POST',
        headers: {
          origin: 'https://attacker.example',
          host: 'attacker.example',
        },
        body: {
          action,
          email: 'sbodine@umich.edu',
          password: 'retired-password',
          sessionToken: 'previously-issued-session-token-previously-issued-session',
          credential: 'caller-supplied-google-credential',
        },
      }, response.res)

      assert.equal(response.result().statusCode, 410)
      assert.deepEqual(response.result().payload, {
        success: false,
        error: 'Applicant account authentication is retired. Public application and interview booking remain available.',
      })
      assert.equal(response.result().headers.get('cache-control'), 'no-store, max-age=0')
    }
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('rejects non-POST requests to the retired applicant endpoint', async () => {
  const response = createResponse()
  await handler({ method: 'GET', headers: {} }, response.res)
  assert.equal(response.result().statusCode, 405)
})
