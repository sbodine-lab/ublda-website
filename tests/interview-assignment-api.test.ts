import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../api/interview-assignment.ts'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'
import { buildApplicationSubmission, validateApplicationPayload } from '../src/lib/application.ts'
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

test('persists validated interview assignments to the recruiting backend', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalWriteMode = process.env.UBLDA_RECRUITING_WRITE_MODE
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const originalFetch = globalThis.fetch
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-assignment-api-'))

  delete process.env.GOOGLE_SCRIPT_URL
  delete process.env.UBLDA_RECRUITING_WRITE_MODE
  delete process.env.BLOB_READ_WRITE_TOKEN
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')
  globalThis.fetch = async () => {
    throw new Error('legacy script should not be called')
  }

  try {
    const store = createLocalRecruitingStore()
    const account = await store.upsertAccount({
      firstName: 'Sam',
      lastName: 'Bodine',
      uniqname: 'sbodine',
      email: 'sbodine@umich.edu',
    }, 'not-used-in-test')
    const application = validateApplicationPayload({
      firstName: 'Candidate',
      lastName: 'Student',
      uniqname: 'candidate',
      year: 'Sophomore',
      expectedGraduation: 'May 2028',
      college: 'Ross BBA',
      rossStatus: 'ross-bba',
      interestType: 'leadership-interview',
      rolePreferences: ['VP of Events & Programming', 'VP of Member Experience', 'VP of Marketing & Community'],
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
        sessionToken: account.sessionToken,
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal((result().payload as Record<string, unknown>).source, 'vercel')
    assert.equal((result().payload as Record<string, unknown>).updatedCandidate, true)

    const dashboard = await store.dashboardData(account.sessionToken)
    const candidate = dashboard?.dashboardData.candidates?.find((row) => row.email === 'candidate@umich.edu')
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

    assert.equal(result().statusCode, 400)
    assert.match(String((result().payload as Record<string, unknown>).error), /admin session/i)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
  }
})
