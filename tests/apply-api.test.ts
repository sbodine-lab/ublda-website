import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../api/apply.ts'
import { INTERVIEW_SLOTS } from '../src/lib/application.ts'
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

test('persists validated leadership interest submissions to the recruiting backend', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalWriteMode = process.env.UBLDA_RECRUITING_WRITE_MODE
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const originalFetch = globalThis.fetch
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-apply-api-'))

  delete process.env.GOOGLE_SCRIPT_URL
  delete process.env.UBLDA_RECRUITING_WRITE_MODE
  delete process.env.BLOB_READ_WRITE_TOKEN
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')
  globalThis.fetch = async () => {
    throw new Error('legacy script should not be called')
  }

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: { 'user-agent': 'api-handler-test' },
      body: {
        firstName: 'Alex',
        lastName: 'Chen',
        uniqname: 'AlexChen@umich.edu',
        year: 'Sophomore',
        expectedGraduation: 'May 2028',
        college: 'Ross BBA',
        rossStatus: 'ross-bba',
        interestType: 'leadership-interview',
        rolePreferences: ['VP of Events & Programming', 'VP of Member Experience', 'VP of Marketing & Community'],
        availability: [INTERVIEW_SLOTS[0].value, INTERVIEW_SLOTS[1].value],
        resumeFile: {
          name: 'alex-chen-resume.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          contentBase64: 'cmVzdW1l',
        },
        weeklyCommitment: '2-3 hours/week',
        notes: '',
        website: '',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.deepEqual(result().payload, {
      success: true,
      status: 'Interview eligible',
      source: 'vercel',
      calendarEventCreated: false,
    })

    const storeData = await createLocalRecruitingStore().leadershipDashboardData()
    assert.equal(storeData.candidates?.length, 1)
    assert.equal(storeData.candidates?.[0].email, 'alexchen@umich.edu')
    assert.deepEqual(storeData.candidates?.[0].rolePreferences, ['VP of Events & Programming', 'VP of Member Experience', 'VP of Marketing & Community'])
    assert.equal(storeData.candidates?.[0].availability.length, 2)
    assert.equal(storeData.candidates?.[0].resumeUrl, 'local-preview://alex-chen-resume.pdf')
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
