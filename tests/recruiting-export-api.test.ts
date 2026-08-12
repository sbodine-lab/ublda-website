import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../server/routes/recruitingExportRoute.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { buildApplicationSubmission, validateApplicationPayload } from '../src/lib/application.ts'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'

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

const withStore = async (run: () => Promise<void>) => {
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-export-api-'))

  delete process.env.BLOB_READ_WRITE_TOKEN
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')

  try {
    await run()
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
}

const seedRecruitingData = async () => {
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
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    email: 'sbodine@umich.edu',
    availability: [INTERVIEW_SLOTS[0]],
    availabilitySummary: 'Thursday, May 7: 1 slot',
    maxInterviews: '2',
    notes: 'Can lead outreach interviews.',
    formType: 'interviewerAvailability',
    dedupeKey: 'sbodine@umich.edu',
    submittedAt: new Date().toISOString(),
    submissionId: 'interviewer_sbodine',
    userAgent: 'test',
  })

  const application = validateApplicationPayload({
    firstName: 'Alex',
    lastName: 'Chen',
    uniqname: 'alexchen',
    year: 'Sophomore',
    expectedGraduation: 'May 2028',
    college: 'Ross BBA',
    rossStatus: 'ross-bba',
    interestType: 'leadership-interview',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    availability: [INTERVIEW_SLOTS[0].value],
    resumeFile: {
      name: 'alex-resume.pdf',
      mimeType: 'application/pdf',
      size: 6,
      contentBase64: 'cmVzdW1l',
    },
  })
  assert.equal(application.success, true)
  await store.saveApplication(buildApplicationSubmission(application.data!, 'export-api-test'))

  return admin.sessionToken
}

test('rejects a previously issued local recruiting-admin session for candidate exports', async () => {
  await withStore(async () => {
    const sessionToken = await seedRecruitingData()

    const unauthorized = createResponse()
    await handler({ method: 'GET', query: { type: 'candidates' }, headers: {} }, unauthorized.res)
    assert.equal(unauthorized.result().statusCode, 401)

    const authorized = createResponse()
    await handler({ method: 'GET', query: { type: 'candidates', sessionToken }, headers: {} }, authorized.res)
    assert.equal(authorized.result().statusCode, 401)
    assert.match(String((authorized.result().payload as Record<string, unknown>).error), /admin session/i)
    assert.equal(authorized.result().headers.has('content-disposition'), false)
  })
})

test('rejects a previously issued local recruiting-admin session for interviewer exports', async () => {
  await withStore(async () => {
    const sessionToken = await seedRecruitingData()

    const response = createResponse()
    await handler({ method: 'GET', query: { type: 'interviewers', sessionToken }, headers: {} }, response.res)
    assert.equal(response.result().statusCode, 401)
    assert.match(String((response.result().payload as Record<string, unknown>).error), /admin session/i)
    assert.equal(response.result().headers.has('content-disposition'), false)
  })
})
