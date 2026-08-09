import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../api/interview-assignment.ts'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'
import { buildApplicationSubmission, validateApplicationPayload } from '../src/lib/application.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { createHmac } from 'node:crypto'

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

test('persists validated interview assignments to the recruiting backend', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalWriteMode = process.env.UBLDA_RECRUITING_WRITE_MODE
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
  const originalFetch = globalThis.fetch
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-assignment-api-'))

  delete process.env.GOOGLE_SCRIPT_URL
  delete process.env.UBLDA_RECRUITING_WRITE_MODE
  delete process.env.BLOB_READ_WRITE_TOKEN
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')
  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'secure-password'
  process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = 'true'
  globalThis.fetch = async () => {
    throw new Error('legacy script should not be called')
  }

  try {
    const store = createLocalRecruitingStore()
    const sessionToken = createLocalAdminToken('secure-password')
    const application = validateApplicationPayload({
      firstName: 'Candidate',
      lastName: 'Student',
      uniqname: 'candidate',
      year: 'Sophomore',
      expectedGraduation: 'May 2028',
      college: 'Ross BBA',
      rossStatus: 'ross-bba',
      interestType: 'leadership-interview',
      rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
      availability: [INTERVIEW_SLOTS[0].value],
      resumeFile: {
        name: 'candidate-resume.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        contentBase64: 'cmVzdW1l',
      },
      weeklyCommitment: '2-3 hours/week',
      notes: '',
    })
    assert.equal(application.success, true)
    await store.saveApplication(buildApplicationSubmission(application.data!, 'api-handler-test'))

    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: { 'user-agent': 'api-handler-test' },
      body: {
        email: 'candidate@umich.edu',
        assignedSlot: INTERVIEW_SLOTS[0].value,
        interviewers: ['Sam Bodine'],
        interviewStatus: 'Matched',
        feedback: 'Good interview.',
        sessionToken,
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal((result().payload as Record<string, unknown>).source, 'vercel')
    assert.equal((result().payload as Record<string, unknown>).updatedCandidate, true)

    const dashboard = await store.leadershipDashboardData()
    const candidate = dashboard.candidates?.find((row) => row.email === 'candidate@umich.edu')
    assert.equal(candidate?.assignedSlot, INTERVIEW_SLOTS[0].value)
    assert.deepEqual(candidate?.interviewers, ['Sam Bodine'])
    assert.equal(candidate?.status, 'Matched')
    assert.equal(candidate?.feedback, 'Good interview.')
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    if (originalWriteMode === undefined) {
      delete process.env.UBLDA_RECRUITING_WRITE_MODE
    } else {
      process.env.UBLDA_RECRUITING_WRITE_MODE = originalWriteMode
    }
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
    globalThis.fetch = originalFetch
    await rm(dir, { recursive: true, force: true })
  }
})

test('rejects assignment updates without an admin session', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: { 'user-agent': 'api-handler-test' },
      body: {
        email: 'candidate@umich.edu',
        interviewStatus: 'Matched',
      },
    }, res)

    assert.equal(result().statusCode, 401)
    assert.match(String((result().payload as Record<string, unknown>).error), /admin session/i)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
  }
})

test('rejects assignment updates from logged-in non-admin members', async () => {
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-assignment-api-'))

  delete process.env.BLOB_READ_WRITE_TOKEN
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')

  try {
    const account = await createLocalRecruitingStore().upsertAccount({
      firstName: 'Regular',
      lastName: 'Member',
      uniqname: 'regular',
      email: 'regular@example.com',
    }, 'regular-password')
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: {},
      body: {
        uniqname: 'candidate',
        assignedSlot: INTERVIEW_SLOTS[0].value,
        interviewers: ['Sam Bodine'],
        interviewStatus: 'Matched',
        feedback: 'Nope.',
        sessionToken: account.sessionToken,
      },
    }, res)

    assert.equal(result().statusCode, 403)
    assert.deepEqual(result().payload, { error: 'Admin access is required.' })
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
    await rm(dir, { recursive: true, force: true })
  }
})
