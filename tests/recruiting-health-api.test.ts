import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../api/recruiting-health.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { buildApplicationSubmission, validateApplicationPayload } from '../src/lib/application.ts'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'

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
      send(body: unknown) {
        payload = body
        return this
      },
    },
    result() {
      return { statusCode, payload }
    },
  }
}

test('recruiting health summarizes candidates, coverage, and stored resumes for admins', async () => {
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-recruiting-health-'))

  delete process.env.BLOB_READ_WRITE_TOKEN
  delete process.env.GOOGLE_SCRIPT_URL
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')

  try {
    const store = createLocalRecruitingStore()
    const admin = await store.upsertAccount({
      firstName: 'Sam',
      lastName: 'Bodine',
      uniqname: 'sbodine',
      email: 'sbodine@umich.edu',
      role: 'super-admin',
      adminScopes: ['recruiting', 'system'],
    }, 'super-secret-password')
    await store.saveInterviewerAvailability({
      firstName: 'Alexa',
      lastName: 'Chiang',
      uniqname: 'atchiang',
      email: 'atchiang@umich.edu',
      availability: [INTERVIEW_SLOTS[0]],
      availabilitySummary: `${INTERVIEW_SLOTS[0].dayLabel}: 1 slot`,
      maxInterviews: '2',
      notes: '',
      formType: 'interviewerAvailability',
      dedupeKey: 'atchiang@umich.edu',
      submittedAt: new Date().toISOString(),
      submissionId: 'interviewer_atchiang',
      userAgent: 'health-test',
    })
    const application = validateApplicationPayload({
      firstName: 'Andrew',
      lastName: 'Sackett',
      uniqname: 'andsack',
      year: 'Sophomore',
      expectedGraduation: 'May 2028',
      college: 'Ross BBA',
      rossStatus: 'ross-bba',
      interestType: 'leadership-interview',
      rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
      availability: [INTERVIEW_SLOTS[0].value],
      resumeFile: {
        name: 'andrew-resume.pdf',
        mimeType: 'application/pdf',
        size: 6,
        contentBase64: 'cmVzdW1l',
      },
    })
    assert.equal(application.success, true)
    await store.saveApplication(buildApplicationSubmission(application.data!, 'health-test'))

    const unauthorized = createResponse()
    await handler({ method: 'GET', query: {}, headers: {} }, unauthorized.res)
    assert.equal(unauthorized.result().statusCode, 401)

    const authorized = createResponse()
    await handler({
      method: 'GET',
      query: { sessionToken: admin.sessionToken },
      headers: {},
    }, authorized.res)

    assert.equal(authorized.result().statusCode, 200)
    const payload = authorized.result().payload as {
      counts: Record<string, number>
      candidates: Array<Record<string, unknown>>
      interviewers: Array<Record<string, unknown>>
    }
    assert.equal(payload.counts.candidates, 1)
    assert.equal(payload.counts.interviewers, 1)
    assert.equal(payload.counts.resumes, 1)
    assert.equal(payload.counts.coveredSlots, 1)
    assert.equal(payload.candidates[0].email, 'andsack@umich.edu')
    assert.equal(payload.candidates[0].resumePresent, true)
    assert.equal(payload.candidates[0].resumeFileName, 'andrew-resume.pdf')
    assert.equal(payload.interviewers[0].email, 'atchiang@umich.edu')
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
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    await rm(dir, { recursive: true, force: true })
  }
})
