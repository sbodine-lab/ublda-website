import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apiRoute, handleApiRequest } from '../cloudflare/worker.ts'
import www from '../cloudflare/www.ts'

test('www redirect preserves the full route and query on the HTTPS apex', () => {
  const response = www.fetch(new Request('https://www.ublda.org/consulting/contact?from=partner'))
  assert.equal(response.status, 308)
  assert.equal(response.headers.get('location'), 'https://ublda.org/consulting/contact?from=partner')
})

test('Cloudflare preserves gateway and housing rewrites and repeated query values', () => {
  const cases = [
    ['/mcp', '/api/decision-agent', 'decisionAgentPath', '/mcp'],
    ['/api/convex-auth', '/api/decision-agent', 'decisionAgentPath', '/convex-auth'],
    ['/api/decision-agent/drafts', '/api/decision-agent', 'decisionAgentPath', '/drafts'],
    ['/api/facilities/abc/availability', '/api/housing', 'housingPath', '/facilities/abc/availability'],
    ['/api/map/layers/demand', '/api/housing', 'housingPath', '/map/layers/demand'],
    ['/api/submissions/facility-correction', '/api/housing', 'housingPath', '/submissions/facility-correction'],
  ]
  for (const [path, destination, key, value] of cases) {
    const route = apiRoute(new URL(`${path}?tag=a&tag=b&${key}=spoof`, 'https://ublda.org'))
    assert.equal(route.pathname, destination)
    assert.equal(route.query.get(key), value)
    assert.deepEqual(route.query.getAll('tag'), ['a', 'b'])
  }
})

test('Cloudflare rejects unknown API routes with JSON rather than the SPA', async () => {
  const response = await handleApiRequest(new Request('https://ublda.org/api/missing'), {})
  assert.equal(response.status, 404)
  assert.match(response.headers.get('content-type') || '', /application\/json/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
})

test('Cloudflare refuses Blob routes without durable storage, including reads', async () => {
  for (const path of ['/api/craft-night', '/api/bba-mtc', '/api/speaker-ops', '/api/operations']) {
    for (const method of ['GET', 'POST']) {
      const response = await handleApiRequest(new Request(`https://ublda.org${path}`, { method }), {})
      assert.equal(response.status, 503)
      assert.deepEqual(await response.json(), { error: 'Persistent storage is not configured.' })
    }
  }
})

test('Cloudflare retains contact origin restrictions and production validation', async () => {
  const request = (origin: string) => new Request('https://ublda.org/api/contact', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}',
  })
  assert.equal((await handleApiRequest(request('https://unapproved.example'), {})).status, 403)
  const response = await handleApiRequest(request('https://ublda.org'), {})
  assert.equal(response.status, 400)
  assert.match((await response.json() as { error: string }).error, /valid email/)
})

test('Cloudflare rejects malformed JSON and oversized streamed bodies before handlers', async () => {
  const invalid = new Request('https://ublda.org/api/join', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  })
  assert.equal((await handleApiRequest(invalid, {})).status, 400)
  const large = new Request('https://ublda.org/api/join', { method: 'POST', body: 'a'.repeat(1024 * 1024 + 1) })
  assert.equal((await handleApiRequest(large, {})).status, 413)
})

test('Cloudflare retains API method responses and housing path dispatch', async () => {
  assert.equal((await handleApiRequest(new Request('https://ublda.org/api/join'), {})).status, 405)
  const response = await handleApiRequest(new Request('https://ublda.org/api/facilities'), {})
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control') || '', /no-store/)
})
