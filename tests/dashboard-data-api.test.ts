import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/dashboard-data.ts'

const createResponse = () => {
  let statusCode = 0
  let payload: unknown = null

  return {
    res: {
      setHeader() {
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
      return { statusCode, payload }
    },
  }
}

test('hard-retires legacy dashboard authentication for every old session format', async () => {
  for (const sessionToken of [
    'ublda_admin.retired-payload.retired-signature',
    'local_existing-admin-session-token-that-was-already-issued',
    'apps-script-admin-session-token-apps-script-admin-session',
    '',
  ]) {
    const response = createResponse()
    await handler({
      method: 'POST',
      headers: {},
      body: { sessionToken },
    }, response.res)

    assert.equal(response.result().statusCode, 410)
    assert.deepEqual(response.result().payload, {
      success: false,
      error: 'Legacy dashboard authentication is retired. Sign in through the leadership workspace.',
    })
  }
})

test('rejects non-POST requests to the retired dashboard endpoint', async () => {
  const response = createResponse()
  await handler({ method: 'GET', headers: {} }, response.res)
  assert.equal(response.result().statusCode, 405)
})
