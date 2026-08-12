import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../server/routes/recruitingHealthRoute.ts'
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

test('recruiting health rejects previously issued local recruiting-admin sessions', async () => {
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

    assert.equal(authorized.result().statusCode, 401)
    assert.match(String((authorized.result().payload as Record<string, unknown>).error), /admin session/i)
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
