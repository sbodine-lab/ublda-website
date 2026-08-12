import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import handler from '../api/dashboard-calendar-event.ts'

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

const createRetiredAdminToken = (secret: string) => {
  const payload = Buffer.from(JSON.stringify({
    email: 'sbodine@umich.edu',
    exp: Date.now() + 1000 * 60 * 60,
  })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `ublda_admin.${payload}.${signature}`
}

const eventBody = (sessionToken?: string) => ({
  action: 'save',
  ...(sessionToken ? { sessionToken } : {}),
  id: 'manual-test',
  title: 'Manual interview hold',
  date: '2026-05-07',
  startMinutes: 9 * 60,
  durationMinutes: 50,
  owner: 'Sam Bodine',
  location: 'Google Meet',
  notes: '',
})

test('rejects a previously valid shared-password calendar administrator session', async () => {
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK

  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'retired-password'
  process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = 'true'

  try {
    const response = createResponse()
    await handler({
      method: 'POST',
      headers: {},
      body: eventBody(createRetiredAdminToken('retired-password')),
    }, response.res)

    assert.equal(response.result().statusCode, 401)
    assert.match(String((response.result().payload as Record<string, unknown>).error), /retired/i)
  } finally {
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

test('rejects manual dashboard calendar events without a legacy admin session', async () => {
  const response = createResponse()
  await handler({
    method: 'POST',
    headers: {},
    body: eventBody(),
  }, response.res)

  assert.equal(response.result().statusCode, 401)
})
