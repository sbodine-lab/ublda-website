import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/recruiting.ts'
import type { VercelRequest } from '../server/types.ts'

/**
 * `api/recruiting.ts` is the only thing standing between the rewrite and three
 * endpoints that were top-level functions until the Hobby plan's 12-function cap
 * forced them together. The endpoints keep their own tests; these cover the
 * dispatch itself, which nothing else exercises.
 */

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
      send(body: unknown) {
        payload = body
        return this
      },
    },
    result() {
      return { statusCode, payload, headers }
    },
  }
}

const call = async (req: Partial<VercelRequest>) => {
  const { res, result } = createResponse()
  await handler({ method: 'GET', headers: {}, query: {}, ...req } as VercelRequest, res)
  return result()
}

const errorOf = (payload: unknown) => (
  payload && typeof payload === 'object' ? (payload as { error?: string }).error : undefined
)

test('an unknown recruiting path is a 404, not a crash', async () => {
  const { statusCode, payload } = await call({ query: { recruitingPath: '/nope' } })
  assert.equal(statusCode, 404)
  assert.equal(errorOf(payload), 'Unknown recruiting endpoint.')
})

test('a request with no path at all is a 404', async () => {
  const { statusCode } = await call({ url: '/api/recruiting' })
  assert.equal(statusCode, 404)
})

test('the rewrite query parameter reaches each of the three routes', async () => {
  // Each route answers with its own validation error, which is how we know the
  // dispatch landed rather than falling through to the 404 above.
  const resume = await call({ query: { recruitingPath: '/resume' } })
  assert.equal(resume.statusCode, 400)
  assert.equal(errorOf(resume.payload), 'Candidate email is required.')

  const csv = await call({ query: { recruitingPath: '/recruiting-export' } })
  assert.equal(csv.statusCode, 400)
  assert.equal(errorOf(csv.payload), 'Choose a valid export type.')

  // Health has no query validation to fail on, so it stops at the session gate.
  const health = await call({ query: { recruitingPath: '/recruiting-health' } })
  assert.equal(health.statusCode, 401)
})

test('a direct /api/resume URL still dispatches when no rewrite ran', async () => {
  const { statusCode, payload } = await call({ url: '/api/resume' })
  assert.equal(statusCode, 400)
  assert.equal(errorOf(payload), 'Candidate email is required.')
})

test('the routes keep their own method guards', async () => {
  const { statusCode, payload } = await call({ method: 'POST', query: { recruitingPath: '/resume' } })
  assert.equal(statusCode, 405)
  assert.equal(errorOf(payload), 'Method not allowed')
})
