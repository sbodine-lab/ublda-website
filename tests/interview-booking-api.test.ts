import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../api/interview-booking.ts'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'

const functionPreferences = ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships']

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
    },
    result() {
      return { statusCode, payload }
    },
  }
}

const withBookingStore = async (run: (dataPath: string) => Promise<void>) => {
  const originalDataFile = process.env.UBLDA_LOCAL_DATA_FILE
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-booking-api-'))
  const dataPath = path.join(dir, 'recruiting.json')

  delete process.env.BLOB_READ_WRITE_TOKEN
  process.env.UBLDA_LOCAL_DATA_FILE = dataPath

  try {
    await run(dataPath)
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

const saveCoverage = async (email: string, firstName: string, lastName: string, slotValue = INTERVIEW_SLOTS[0].value) => {
  const slot = INTERVIEW_SLOTS.find((candidateSlot) => candidateSlot.value === slotValue) || INTERVIEW_SLOTS[0]
  await createLocalRecruitingStore().saveInterviewerAvailability({
    firstName,
    lastName,
    uniqname: email.replace(/@.*$/, ''),
    email,
    availability: [slot],
    availabilitySummary: `${slot.dayLabel}: 1 slot`,
    maxInterviews: '2',
    notes: '',
    formType: 'interviewerAvailability',
    dedupeKey: email,
    submittedAt: new Date().toISOString(),
    submissionId: `interviewer_${email}`,
    userAgent: 'test',
  })
}

test('public booking slots show e-board coverage without exposing applicant signups', async () => {
  await withBookingStore(async () => {
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')
    await saveCoverage('atchiang@umich.edu', 'Alexa', 'Chiang')

    const { res, result } = createResponse()
    await handler({ method: 'GET', body: null, headers: {} }, res)

    assert.equal(result().statusCode, 200)
    const payload = result().payload as { slots: Array<Record<string, unknown>>; timeZone: string }
    const openSlot = payload.slots.find((slot) => slot.value === INTERVIEW_SLOTS[0].value)

    assert.equal(payload.timeZone, 'Eastern Time (ET, Ann Arbor)')
    assert.equal(openSlot?.interviewerCount, 2)
    assert.deepEqual(openSlot?.interviewers, ['Alexa Chiang', 'Sam Bodine'])
    assert.equal('bookedBy' in (openSlot || {}), false)
  })
})

test('books one interviewee into a covered slot and persists the assignment to disk', async () => {
  await withBookingStore(async (dataPath) => {
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')
    await saveCoverage('atchiang@umich.edu', 'Alexa', 'Chiang')

    const { res, result } = createResponse()
    await handler({
      method: 'POST',
      headers: { 'user-agent': 'booking-test' },
      body: {
        firstName: 'Priya',
        lastName: 'Rao',
        email: 'priya@example.com',
        slotValue: INTERVIEW_SLOTS[0].value,
        rolePreferences: functionPreferences,
        conflicts: 'No conflicts.',
        website: '',
      },
    }, res)

    assert.equal(result().statusCode, 200)

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    const candidate = dashboard.candidates?.find((row) => row.email === 'priya@example.com')
    assert.equal(candidate?.assignedSlot, INTERVIEW_SLOTS[0].value)
    assert.deepEqual(candidate?.interviewers, ['Alexa Chiang', 'Sam Bodine'])
    assert.equal(candidate?.status, 'Invited')

    const raw = JSON.parse(await readFile(dataPath, 'utf8')) as { candidates: Record<string, unknown> }
    assert.ok(raw.candidates['priya@example.com'])
  })
})

test('only one simultaneous applicant can book the same slot', async () => {
  await withBookingStore(async () => {
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')

    const first = createResponse()
    const second = createResponse()
    const baseBody = {
      firstName: 'Concurrent',
      lastName: 'Tester',
      slotValue: INTERVIEW_SLOTS[0].value,
      rolePreferences: functionPreferences,
      conflicts: '',
      website: '',
    }

    await Promise.all([
      handler({ method: 'POST', headers: {}, body: { ...baseBody, email: 'one@example.com' } }, first.res),
      handler({ method: 'POST', headers: {}, body: { ...baseBody, email: 'two@example.com' } }, second.res),
    ])

    const statuses = [first.result().statusCode, second.result().statusCode].sort()
    assert.deepEqual(statuses, [200, 409])

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    assert.equal(dashboard.candidates?.filter((row) => row.assignedSlot === INTERVIEW_SLOTS[0].value).length, 1)
  })
})

test('rejects double-booking one email and handles hostile-looking input safely', async () => {
  await withBookingStore(async () => {
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine', INTERVIEW_SLOTS[0].value)
    await saveCoverage('atchiang@umich.edu', 'Alexa', 'Chiang', INTERVIEW_SLOTS[1].value)

    const first = createResponse()
    await handler({
      method: 'POST',
      headers: {},
      body: {
        firstName: `<script>${'A'.repeat(5000)}</script>`,
        lastName: '"; DROP TABLE candidates; -- <img src=x onerror=alert(1)>',
        email: 'edge@example.com',
        slotValue: INTERVIEW_SLOTS[0].value,
        rolePreferences: functionPreferences,
        roleInterest: '<b>Any</b>',
        conflicts: 'unicode ✓ and SQL-ish text should stay inert <script>alert(1)</script>',
        website: '',
      },
    }, first.res)
    assert.equal(first.result().statusCode, 200)

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    const candidate = dashboard.candidates?.find((row) => row.email === 'edge@example.com')
    assert.ok(candidate)
    assert.equal(/[<>]/.test(`${candidate.name} ${candidate.rolePreferences.join(' ')} ${candidate.feedback}`), false)

    const second = createResponse()
    await handler({
      method: 'POST',
      headers: {},
      body: {
        firstName: 'Edge',
        lastName: 'Case',
        email: 'edge@example.com',
        slotValue: INTERVIEW_SLOTS[1].value,
        rolePreferences: functionPreferences,
        conflicts: '',
        website: '',
      },
    }, second.res)
    assert.equal(second.result().statusCode, 409)
  })
})

test('rate limits rapid public booking attempts from one client', async () => {
  await withBookingStore(async () => {
    const slots = INTERVIEW_SLOTS.slice(10, 17)
    for (const [index, slot] of slots.entries()) {
      await saveCoverage(`rate${index}@umich.edu`, 'Rate', `Interviewer${index}`, slot.value)
    }

    const statuses: number[] = []
    for (const [index, slot] of slots.entries()) {
      const response = createResponse()
      await handler({
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.77' },
        body: {
          firstName: 'Rate',
          lastName: `Applicant${index}`,
          email: `rate.applicant.${index}@example.com`,
          slotValue: slot.value,
          rolePreferences: functionPreferences,
          conflicts: '',
          website: '',
        },
      }, response.res)
      statuses.push(response.result().statusCode)
    }

    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 429])
  })
})
