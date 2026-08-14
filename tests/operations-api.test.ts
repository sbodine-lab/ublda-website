import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../api/operations.ts'
import type { VercelRequest, VercelResponse } from '../server/types.ts'

const responseFixture = () => {
  let statusCode = 0
  let payload: unknown
  const headers = new Map<string, string>()
  const response = {
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); return response },
    status(code: number) { statusCode = code; return response },
    json(body: unknown) { payload = body; return response },
    send(body: unknown) { payload = body; return response },
  } satisfies VercelResponse
  return { response, result: () => ({ statusCode, payload, headers }) }
}

const postRequest = (headers: VercelRequest['headers'] = {}): VercelRequest => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: 'https://example.org',
    'sec-fetch-site': 'same-origin',
    ...headers,
  },
  body: { action: 'workspace', idToken: 'token' },
})

const options = {
  allowedOrigins: new Set(['https://example.org']),
  handleRequest: async () => ({ status: 200, body: { success: true } }),
}

test('accepts bounded same-origin JSON Operations requests', async () => {
  const fixture = responseFixture()
  await handler(postRequest(), fixture.response, options)
  assert.equal(fixture.result().statusCode, 200)
  assert.deepEqual(fixture.result().payload, { success: true })
  assert.match(fixture.result().headers.get('cache-control') || '', /no-store/)
  assert.equal(fixture.result().headers.get('x-frame-options'), 'DENY')
})

test('rejects invalid method, content type, size, and origin', async () => {
  const method = responseFixture()
  await handler({ method: 'GET', headers: {} }, method.response, options)
  assert.equal(method.result().statusCode, 405)

  const contentType = responseFixture()
  await handler(postRequest({ 'content-type': 'text/plain' }), contentType.response, options)
  assert.equal(contentType.result().statusCode, 415)

  const size = responseFixture()
  await handler(postRequest({ 'content-length': String(65 * 1_024) }), size.response, options)
  assert.equal(size.result().statusCode, 413)

  const origin = responseFixture()
  await handler(postRequest({ origin: 'https://attacker.example' }), origin.response, options)
  assert.equal(origin.result().statusCode, 403)
})
