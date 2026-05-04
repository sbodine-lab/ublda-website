import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../api/interviewer-availability.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'

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

test('persists validated interviewer availability to the recruiting backend without calling the member script', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalFetch = globalThis.fetch
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-interviewer-api-'))
  const dataPath = path.join(dir, 'recruiting.json')
  let fetchCalled = false

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  process.env.UBLDA_LOCAL_DATA_FILE = dataPath
  globalThis.fetch = async () => {
    fetchCalled = true
    return new Response(JSON.stringify({ success: false }), { status: 500 })
  }

  try {
    const { res, result } = createResponse()

    await handler({
      method: 'POST',
      headers: { 'user-agent': 'api-handler-test' },
      body: {
        firstName: 'Cooper',
        lastName: 'Ryan',
        uniqname: 'cooperry',
        availability: [INTERVIEW_SLOTS[0].value, INTERVIEW_SLOTS[1].value],
        maxInterviews: '2',
        notes: '',
        website: '',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    assert.equal((result().payload as Record<string, unknown>).success, true)
    assert.equal(fetchCalled, false)

    const dashboard = await createLocalRecruitingStore(dataPath).leadershipDashboardData()
    assert.equal(dashboard.interviewerAvailability?.length, 1)
    assert.equal(dashboard.interviewerAvailability?.[0].name, 'Cooper Ryan')
    assert.equal(dashboard.interviewerAvailability?.[0].availability.length, 2)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    if (originalDataFile === undefined) {
      delete process.env.UBLDA_LOCAL_DATA_FILE
    } else {
      process.env.UBLDA_LOCAL_DATA_FILE = originalDataFile
    }
    globalThis.fetch = originalFetch
  }
})
