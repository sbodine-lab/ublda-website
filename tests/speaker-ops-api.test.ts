import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../api/speaker-ops.ts'
import type { VercelRequest, VercelResponse } from '../server/types.ts'

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
  return { response, result: () => ({ statusCode, payload, headers }) }
}

const postRequest = (
  headers: VercelRequest['headers'] = {},
  body: unknown = { action: 'workspace', idToken: 'logto-token' },
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

const options = {
  allowedOrigins: new Set(['https://example.org']),
  handleRequest: async () => ({ status: 200, body: { success: true } }),
}

test('accepts a bounded same-origin JSON Speaker Ops request', async () => {
  const fixture = responseFixture()
  await handler(postRequest(), fixture.response, options)

  assert.equal(fixture.result().statusCode, 200)
  assert.deepEqual(fixture.result().payload, { success: true })
  assert.match(fixture.result().headers.get('cache-control') || '', /no-store/)
  assert.equal(fixture.result().headers.get('referrer-policy'), 'no-referrer')
})

test('rejects missing or cross-site Speaker Ops origins before service execution', async () => {
  let calls = 0
  const guardedOptions = {
    allowedOrigins: options.allowedOrigins,
    handleRequest: async () => {
      calls += 1
      return { status: 200, body: { success: true } }
    },
  }

  for (const request of [
    postRequest({ origin: '' }),
    postRequest({ origin: 'https://attacker.example' }),
    postRequest({ 'sec-fetch-site': 'cross-site' }),
  ]) {
    const fixture = responseFixture()
    await handler(request, fixture.response, guardedOptions)
    assert.equal(fixture.result().statusCode, 403)
  }
  assert.equal(calls, 0)
})

test('requires POST JSON and enforces the Speaker Ops body limit', async () => {
  const method = responseFixture()
  await handler({ method: 'GET', headers: {} }, method.response, options)
  assert.equal(method.result().statusCode, 405)
  assert.equal(method.result().headers.get('allow'), 'POST')

  const type = responseFixture()
  await handler(postRequest({ 'content-type': 'text/plain' }), type.response, options)
  assert.equal(type.result().statusCode, 415)

  const size = responseFixture()
  await handler(postRequest({ 'content-length': String(65 * 1_024) }), size.response, options)
  assert.equal(size.result().statusCode, 413)
})
