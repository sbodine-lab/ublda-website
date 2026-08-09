import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../api/resume.ts'
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

test('serves stored resumes only to recruiting admins', async () => {
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-resume-api-'))

  delete process.env.BLOB_READ_WRITE_TOKEN
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
    await store.saveApplication(buildApplicationSubmission(application.data!, 'resume-api-test'))

    const unauthorized = createResponse()
    await handler({
      method: 'GET',
      query: { candidate: 'alexchen@umich.edu' },
      headers: {},
    }, unauthorized.res)
    assert.equal(unauthorized.result().statusCode, 401)

    const authorized = createResponse()
    await handler({
      method: 'GET',
      query: { candidate: 'alexchen@umich.edu', sessionToken: admin.sessionToken },
      headers: {},
    }, authorized.res)
    assert.equal(authorized.result().statusCode, 200)
    assert.equal(authorized.result().headers.get('content-type'), 'application/pdf')
    assert.equal(Buffer.isBuffer(authorized.result().payload), true)
    assert.equal((authorized.result().payload as Buffer).toString('utf8'), 'resume')
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
