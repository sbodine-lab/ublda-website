import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createHmac } from 'node:crypto'
import handler from '../api/dashboard-calendar-event.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'

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

const createLocalAdminToken = (secret: string) => {
  const payload = Buffer.from(JSON.stringify({
    email: 'sbodine@umich.edu',
    exp: Date.now() + 1000 * 60 * 60,
  })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `ublda_admin.${payload}.${signature}`
}

test('persists manual dashboard calendar events to the recruiting backend', async () => {
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-calendar-api-'))

  delete process.env.BLOB_READ_WRITE_TOKEN
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')
  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'secure-password'
  process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = 'true'

  try {
    const sessionToken = createLocalAdminToken('secure-password')
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      body: {
        action: 'save',
        sessionToken,
        id: 'manual-test',
        title: 'Manual interview hold',
        date: '2026-05-07',
        startMinutes: 9 * 60,
        durationMinutes: 50,
        owner: 'Sam Bodine',
        location: 'Google Meet',
        notes: '',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    assert.equal(dashboard.calendarEvents?.length, 1)
    assert.equal(dashboard.calendarEvents?.[0].title, 'Manual interview hold')

    const deleteResponse = createResponse()
    await handler({
      method: 'POST',
      body: {
        action: 'delete',
        sessionToken,
        id: 'manual-test',
      },
    }, deleteResponse.res)

    assert.equal(deleteResponse.result().statusCode, 200)
    assert.equal((await createLocalRecruitingStore().leadershipDashboardData()).calendarEvents?.length, 0)
  } finally {
    if (originalDataFile === undefined) {
      delete process.env.UBLDA_LOCAL_DATA_FILE
    } else {
      process.env.UBLDA_LOCAL_DATA_FILE = originalDataFile
    }
    if (originalBlobToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken
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
    await rm(dir, { recursive: true, force: true })
  }
})

test('rejects manual dashboard calendar events without an admin session', async () => {
  const { res, result } = createResponse()

  await handler({
    method: 'POST',
    body: {
      action: 'save',
      title: 'No session',
      date: '2026-05-07',
      startMinutes: 9 * 60,
      durationMinutes: 50,
    },
  }, res)

  assert.equal(result().statusCode, 401)
})
