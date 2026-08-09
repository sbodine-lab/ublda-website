import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import handler from '../api/interview-booking.ts'
import { createLocalRecruitingStore, setRecruitingBlobClientForTests } from '../server/localRecruitingStore.js'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'

const functionPreferences = ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships']
const resumeFile = {
  name: 'candidate-resume.pdf',
  mimeType: 'application/pdf',
  size: 256,
  contentBase64: 'cmVzdW1l',
}

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
  const originalEnv = {
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    UBLDA_EMAIL_FROM: process.env.UBLDA_EMAIL_FROM,
    UBLDA_EMAIL_REPLY_TO: process.env.UBLDA_EMAIL_REPLY_TO,
    UBLDA_EMAIL_BCC: process.env.UBLDA_EMAIL_BCC,
    UBLDA_EMAIL_DOMAIN_VERIFIED: process.env.UBLDA_EMAIL_DOMAIN_VERIFIED,
    UBLDA_REQUIRE_BOOKING_EMAIL: process.env.UBLDA_REQUIRE_BOOKING_EMAIL,
    UBLDA_ENABLE_TEST_SIGNUPS: process.env.UBLDA_ENABLE_TEST_SIGNUPS,
    UBLDA_LOCAL_DATA_FILE: process.env.UBLDA_LOCAL_DATA_FILE,
    VERCEL_ENV: process.env.VERCEL_ENV,
  }
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-booking-api-'))
  const dataPath = path.join(dir, 'recruiting.json')

  delete process.env.BLOB_READ_WRITE_TOKEN
  delete process.env.RESEND_API_KEY
  delete process.env.UBLDA_EMAIL_FROM
  delete process.env.UBLDA_EMAIL_REPLY_TO
  delete process.env.UBLDA_EMAIL_BCC
  delete process.env.UBLDA_EMAIL_DOMAIN_VERIFIED
  delete process.env.UBLDA_REQUIRE_BOOKING_EMAIL
  delete process.env.UBLDA_ENABLE_TEST_SIGNUPS
  delete process.env.VERCEL_ENV
  process.env.UBLDA_LOCAL_DATA_FILE = dataPath

  try {
    await run(dataPath)
  } finally {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    })
    await rm(dir, { recursive: true, force: true })
  }
}

const createMemoryBlobClient = () => {
  type BlobEntry = {
    body: Buffer
    contentType: string
    etag: string
  }
  const blobs = new Map<string, BlobEntry>()
  let version = 0
  const conflict = () => new Error('precondition failed')
  const toBuffer = async (body: unknown) => {
    if (Buffer.isBuffer(body)) return body
    if (body instanceof Uint8Array) return Buffer.from(body)
    if (typeof body === 'string') return Buffer.from(body)
    if (body instanceof Blob) return Buffer.from(await body.arrayBuffer())
    return Buffer.from(String(body || ''))
  }

  return {
    keys: () => Array.from(blobs.keys()),
    client: {
      async get(pathname: string) {
        const entry = blobs.get(pathname)
        if (!entry) return null
        return {
          statusCode: 200,
          stream: new Blob([entry.body]).stream(),
          blob: { etag: entry.etag },
        }
      },
      async put(pathname: string, body: unknown, options: { allowOverwrite?: boolean; ifMatch?: string; contentType?: string } = {}) {
        const existing = blobs.get(pathname)
        if (options.ifMatch && existing?.etag !== options.ifMatch) throw conflict()
        if (!options.allowOverwrite && existing) throw conflict()
        const nextBody = await toBuffer(body)
        blobs.set(pathname, {
          body: nextBody,
          contentType: options.contentType || 'application/octet-stream',
          etag: `etag-${version += 1}`,
        })
        return { pathname, url: `memory://${pathname}` }
      },
      async del(pathname: string) {
        blobs.delete(pathname)
      },
    },
  }
}

const withBlobBookingStore = async (run: (blob: ReturnType<typeof createMemoryBlobClient>) => Promise<void>) => {
  const originalEnv = {
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    UBLDA_EMAIL_FROM: process.env.UBLDA_EMAIL_FROM,
    UBLDA_EMAIL_REPLY_TO: process.env.UBLDA_EMAIL_REPLY_TO,
    UBLDA_EMAIL_BCC: process.env.UBLDA_EMAIL_BCC,
    UBLDA_EMAIL_DOMAIN_VERIFIED: process.env.UBLDA_EMAIL_DOMAIN_VERIFIED,
    UBLDA_REQUIRE_BOOKING_EMAIL: process.env.UBLDA_REQUIRE_BOOKING_EMAIL,
    UBLDA_ENABLE_TEST_SIGNUPS: process.env.UBLDA_ENABLE_TEST_SIGNUPS,
    UBLDA_LOCAL_DATA_FILE: process.env.UBLDA_LOCAL_DATA_FILE,
    VERCEL_ENV: process.env.VERCEL_ENV,
  }
  const blob = createMemoryBlobClient()

  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_test_token'
  delete process.env.RESEND_API_KEY
  delete process.env.UBLDA_EMAIL_FROM
  delete process.env.UBLDA_EMAIL_REPLY_TO
  delete process.env.UBLDA_EMAIL_BCC
  delete process.env.UBLDA_EMAIL_DOMAIN_VERIFIED
  delete process.env.UBLDA_REQUIRE_BOOKING_EMAIL
  delete process.env.UBLDA_ENABLE_TEST_SIGNUPS
  delete process.env.UBLDA_LOCAL_DATA_FILE
  delete process.env.VERCEL_ENV
  setRecruitingBlobClientForTests(blob.client)

  try {
    await run(blob)
  } finally {
    setRecruitingBlobClientForTests()
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    })
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

const slotLockId = (slotValue: string) => createHash('sha256').update(slotValue).digest('base64url')

const localSlotLockPath = (dataPath: string, slotValue: string) => (
  path.join(path.dirname(dataPath), 'slot-locks', `${slotLockId(slotValue)}.json`)
)

const blobSlotLockPath = (slotValue: string) => `recruiting/slot-locks/${slotLockId(slotValue)}.json`

const staleLockPayload = (slotValue: string) => `${JSON.stringify({
  slotValue,
  email: 'stale-lock@example.com',
  submissionId: 'booking_stale_lock',
  createdAt: new Date(Date.now() - (11 * 60 * 1000)).toISOString(),
}, null, 2)}\n`

type PublicSlotRow = {
  value: string
  isBooked: boolean
  isAvailable: boolean
  interviewerCount: number
}

const publicSlots = async () => {
  const { res, result } = createResponse()
  await handler({ method: 'GET', body: null, headers: {} }, res)

  assert.equal(result().statusCode, 200)
  return (result().payload as { slots: PublicSlotRow[] }).slots
}

const bookSlot = async (slotValue: string, index: number, overrides: Partial<{ firstName: string; lastName: string; email: string }> = {}) => {
  const response = createResponse()
  await handler({
    method: 'POST',
    headers: {
      'user-agent': 'booking-test',
      'x-forwarded-for': `198.51.100.${index + 1}`,
    },
    body: {
      firstName: overrides.firstName || 'Candidate',
      lastName: overrides.lastName || `Tester${index}`,
      email: overrides.email || `candidate.${index}@example.com`,
      slotValue,
      rolePreferences: functionPreferences,
      resumeFile,
      conflicts: '',
      website: '',
    },
  }, response.res)

  assert.equal(response.result().statusCode, 200)
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

test('public booking slots mark booked covered slots as occupied without exposing the interviewee', async () => {
  await withBookingStore(async () => {
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')

    const booking = createResponse()
    await handler({
      method: 'POST',
      headers: { 'user-agent': 'booking-test' },
      body: {
        firstName: 'Priya',
        lastName: 'Rao',
        email: 'priya@example.com',
        slotValue: INTERVIEW_SLOTS[0].value,
        rolePreferences: functionPreferences,
        resumeFile,
        conflicts: '',
        website: '',
      },
    }, booking.res)
    assert.equal(booking.result().statusCode, 200)

    const { res, result } = createResponse()
    await handler({ method: 'GET', body: null, headers: {} }, res)

    const payload = result().payload as { slots: Array<Record<string, unknown>> }
    const occupiedSlot = payload.slots.find((slot) => slot.value === INTERVIEW_SLOTS[0].value)
    assert.equal(occupiedSlot?.isBooked, true)
    assert.equal(occupiedSlot?.isAvailable, false)
    assert.equal(occupiedSlot?.interviewerCount, 1)
    assert.equal('bookedBy' in (occupiedSlot || {}), false)
    assert.equal('candidateEmail' in (occupiedSlot || {}), false)
  })
})

test('public booking slots keep occupied slots visible and open covered slots available', async () => {
  await withBookingStore(async () => {
    const coveredSlots = INTERVIEW_SLOTS.slice(0, 5)
    for (const [index, slot] of coveredSlots.entries()) {
      await saveCoverage(`coverage${index}@umich.edu`, 'Coverage', `Tester${index}`, slot.value)
    }

    const occupiedSlots = [coveredSlots[0], coveredSlots[2], coveredSlots[4]]
    for (const [index, slot] of occupiedSlots.entries()) {
      await bookSlot(slot.value, index)
    }

    const rows = await publicSlots()
    const rowByValue = new Map(rows.map((slot) => [slot.value, slot]))

    for (const slot of occupiedSlots) {
      const row = rowByValue.get(slot.value)
      assert.ok(row, `expected occupied slot ${slot.value} to remain visible`)
      assert.equal(row.isBooked, true)
      assert.equal(row.isAvailable, false)
      assert.equal(row.interviewerCount, 1)
    }

    for (const slot of [coveredSlots[1], coveredSlots[3]]) {
      const row = rowByValue.get(slot.value)
      assert.ok(row, `expected open covered slot ${slot.value} to remain visible`)
      assert.equal(row.isBooked, false)
      assert.equal(row.isAvailable, true)
      assert.equal(row.interviewerCount, 1)
    }
  })
})

test('seeded low-demand and placeholder bookings leave other covered slots open', async () => {
  await withBookingStore(async () => {
    process.env.UBLDA_ENABLE_TEST_SIGNUPS = 'true'

    const seededRows = await publicSlots()
    const seededBookedValues = new Set(seededRows.filter((slot) => slot.isBooked).map((slot) => slot.value))
    assert.ok(seededBookedValues.size >= 6)

    const testSlots = seededRows.filter((slot) => !seededBookedValues.has(slot.value)).slice(0, 6)
    assert.equal(testSlots.length, 6)

    for (const [index, slot] of testSlots.entries()) {
      await saveCoverage(`placeholder-coverage${index}@umich.edu`, 'Placeholder', `Coverage${index}`, slot.value)
    }

    const placeholderBookings = [
      { firstName: 'Andrew', lastName: 'Placeholder', email: 'andrew.placeholder@example.com' },
      { firstName: 'Solomon', lastName: 'Placeholder', email: 'solomon.placeholder@example.com' },
      { firstName: 'Shado', lastName: 'Placeholder', email: 'shado.placeholder@example.com' },
    ]
    for (const [index, candidate] of placeholderBookings.entries()) {
      await bookSlot(testSlots[index].value, index, candidate)
    }

    const rows = await publicSlots()
    const rowByValue = new Map(rows.map((slot) => [slot.value, slot]))

    for (const slot of testSlots.slice(0, placeholderBookings.length)) {
      const row = rowByValue.get(slot.value)
      assert.ok(row, `expected placeholder slot ${slot.value} to remain visible`)
      assert.equal(row.isBooked, true)
      assert.equal(row.isAvailable, false)
    }

    for (const slot of testSlots.slice(placeholderBookings.length)) {
      const row = rowByValue.get(slot.value)
      assert.ok(row, `expected open covered slot ${slot.value} to remain visible`)
      assert.equal(row.isBooked, false)
      assert.equal(row.isAvailable, true)
      assert.equal(row.interviewerCount, 1)
    }

    const openCoveredSlots = rows.filter((slot) => slot.isAvailable)
    assert.ok(openCoveredSlots.length >= testSlots.length - placeholderBookings.length)
  })
})

test('seeded low-demand and Shado placeholders are not persisted by unrelated writes', async () => {
  await withBookingStore(async (dataPath) => {
    process.env.UBLDA_ENABLE_TEST_SIGNUPS = 'true'

    const seededRows = await publicSlots()
    assert.equal(seededRows.filter((slot) => slot.isBooked).length, 7)

    await saveCoverage('still-open@umich.edu', 'Still', 'Open', INTERVIEW_SLOTS[3].value)

    const raw = JSON.parse(await readFile(dataPath, 'utf8')) as {
      candidates: Record<string, unknown>
      interviewerAvailability: Record<string, { notes?: string }>
    }
    assert.equal(raw.candidates['shado-preserved-slot@example.com'], undefined)
    assert.equal(raw.candidates['low-demand-test-1@example.com'], undefined)
    assert.equal(raw.candidates['low-demand-test-6@example.com'], undefined)
    assert.notEqual(raw.interviewerAvailability['sbodine@umich.edu']?.notes, 'Low-demand test signup coverage')
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
        resumeFile,
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
    assert.equal(candidate?.resumeUrl, '/api/resume?candidate=priya%40example.com')

    const savedResume = await createLocalRecruitingStore().readCandidateResume('priya@example.com')
    assert.equal(savedResume?.fileName, 'candidate-resume.pdf')
    assert.equal(savedResume?.content.toString('utf8'), 'resume')

    const raw = JSON.parse(await readFile(dataPath, 'utf8')) as { candidates: Record<string, unknown> }
    assert.ok(raw.candidates['priya@example.com'])
  })
})

test('sends booking confirmation email through Resend when launch email is configured', async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; init?: RequestInit }> = []

  try {
    await withBookingStore(async () => {
      process.env.RESEND_API_KEY = 're_test_key'
      process.env.UBLDA_EMAIL_FROM = 'UBLDA Interviews <interviews@ublda.org>'
      process.env.UBLDA_EMAIL_DOMAIN_VERIFIED = 'true'
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify({ id: 'email_123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as typeof fetch

      await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')

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
          resumeFile,
          conflicts: '',
          website: '',
        },
      }, res)

      assert.equal(result().statusCode, 200)
      const payload = result().payload as { email?: { sent?: boolean; provider?: string; id?: string } }
      assert.equal(payload.email?.sent, true)
      assert.equal(payload.email?.provider, 'resend')
      assert.equal(payload.email?.id, 'email_123')
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url, 'https://api.resend.com/emails')
      assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer re_test_key')
      assert.match(String((calls[0].init?.headers as Record<string, string>)['Idempotency-Key']), /^interview-booking\/booking_/)

      const body = JSON.parse(String(calls[0].init?.body)) as {
        from: string
        to: string
        subject: string
        text: string
      }
      assert.equal(body.from, 'UBLDA Interviews <interviews@ublda.org>')
      assert.equal(body.to, 'priya@example.com')
      assert.match(body.subject, /UBLDA interview confirmed/)
      assert.match(body.text, /Function preferences/)
      assert.match(body.text, /Backup role check/)
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('books interview without automated email when confirmation email is optional', async () => {
  await withBookingStore(async () => {
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')

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
        resumeFile,
        conflicts: '',
        website: '',
      },
    }, res)

    assert.equal(result().statusCode, 200)
    const payload = result().payload as { email?: { sent?: boolean; provider?: string } }
    assert.equal(payload.email?.sent, false)
    assert.equal(payload.email?.provider, 'disabled')

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    const candidate = dashboard.candidates?.find((row) => row.email === 'priya@example.com')
    assert.equal(candidate?.assignedSlot, INTERVIEW_SLOTS[0].value)
  })
})

test('books interview with only a first-choice function preference', async () => {
  await withBookingStore(async () => {
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')

    const { res, result } = createResponse()
    await handler({
      method: 'POST',
      headers: { 'user-agent': 'booking-test' },
      body: {
        firstName: 'Priya',
        lastName: 'Rao',
        email: 'priya@example.com',
        slotValue: INTERVIEW_SLOTS[0].value,
        rolePreferences: ['Events and Programming', '', ''],
        resumeFile,
        conflicts: '',
        website: '',
      },
    }, res)

    assert.equal(result().statusCode, 200)

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    const candidate = dashboard.candidates?.find((row) => row.email === 'priya@example.com')
    assert.deepEqual(candidate?.rolePreferences, ['Events and Programming'])
  })
})

test('fails closed before booking when confirmation email is explicitly required but missing launch config', async () => {
  await withBookingStore(async () => {
    process.env.UBLDA_REQUIRE_BOOKING_EMAIL = 'true'
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')

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
        resumeFile,
        conflicts: '',
        website: '',
      },
    }, res)

    assert.equal(result().statusCode, 503)
    const payload = result().payload as { missing?: string[] }
    assert.ok(payload.missing?.includes('RESEND_API_KEY'))

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    assert.equal(dashboard.candidates?.some((row) => row.email === 'priya@example.com'), false)
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
      resumeFile,
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

test('recovers a stale local slot lock before accepting an otherwise open booking', async () => {
  await withBookingStore(async (dataPath) => {
    const slotValue = INTERVIEW_SLOTS[0].value
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine', slotValue)

    const lockPath = localSlotLockPath(dataPath, slotValue)
    await mkdir(path.dirname(lockPath), { recursive: true })
    await writeFile(lockPath, staleLockPayload(slotValue))

    await bookSlot(slotValue, 0, { firstName: 'Fresh', lastName: 'Applicant', email: 'fresh@example.com' })

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    const candidate = dashboard.candidates?.find((row) => row.email === 'fresh@example.com')
    assert.equal(candidate?.assignedSlot, slotValue)
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
        resumeFile,
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
        resumeFile,
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
          resumeFile,
          conflicts: '',
          website: '',
        },
      }, response.res)
      statuses.push(response.result().statusCode)
    }

    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 429])
  })
})

test('rejects oversized encoded resume content even when reported size is small', async () => {
  await withBookingStore(async () => {
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')
    const oversizedResume = {
      ...resumeFile,
      size: 1,
      contentBase64: Buffer.alloc((2 * 1024 * 1024) + 1).toString('base64'),
    }

    const { res, result } = createResponse()
    await handler({
      method: 'POST',
      headers: {},
      body: {
        firstName: 'Large',
        lastName: 'Resume',
        email: 'large.resume@example.com',
        slotValue: INTERVIEW_SLOTS[0].value,
        rolePreferences: functionPreferences,
        resumeFile: oversizedResume,
        conflicts: '',
        website: '',
      },
    }, res)

    assert.equal(result().statusCode, 400)
    const payload = result().payload as { error?: string }
    assert.equal(payload.error, 'Resume file must be 2 MB or smaller.')

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    assert.equal(dashboard.candidates?.some((row) => row.email === 'large.resume@example.com'), false)
  })
})

test('production Blob booking marks occupied slots and stores only the winning resume', async () => {
  await withBlobBookingStore(async (blob) => {
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine')

    const winner = createResponse()
    await handler({
      method: 'POST',
      headers: { 'user-agent': 'blob-booking-test', 'x-forwarded-for': '203.0.113.10' },
      body: {
        firstName: 'Winner',
        lastName: 'Candidate',
        email: 'winner@example.com',
        slotValue: INTERVIEW_SLOTS[0].value,
        rolePreferences: functionPreferences,
        resumeFile,
        conflicts: '',
        website: '',
      },
    }, winner.res)
    assert.equal(winner.result().statusCode, 200)

    const updatedResume = {
      name: 'updated-resume.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 3,
      contentBase64: 'bmV3',
    }
    const update = createResponse()
    await handler({
      method: 'POST',
      headers: { 'user-agent': 'blob-booking-test', 'x-forwarded-for': '203.0.113.10' },
      body: {
        firstName: 'Winner',
        lastName: 'Candidate',
        email: 'winner@example.com',
        slotValue: INTERVIEW_SLOTS[0].value,
        rolePreferences: ['Events and Programming'],
        resumeFile: updatedResume,
        conflicts: 'Updated resume.',
        website: '',
      },
    }, update.res)
    assert.equal(update.result().statusCode, 200)

    const loser = createResponse()
    await handler({
      method: 'POST',
      headers: { 'user-agent': 'blob-booking-test', 'x-forwarded-for': '203.0.113.11' },
      body: {
        firstName: 'Late',
        lastName: 'Candidate',
        email: 'late@example.com',
        slotValue: INTERVIEW_SLOTS[0].value,
        rolePreferences: functionPreferences,
        resumeFile,
        conflicts: '',
        website: '',
      },
    }, loser.res)
    assert.equal(loser.result().statusCode, 409)

    const publicSlots = createResponse()
    await handler({ method: 'GET', body: null, headers: {} }, publicSlots.res)
    const slot = (publicSlots.result().payload as { slots: Array<Record<string, unknown>> }).slots.find((row) => row.value === INTERVIEW_SLOTS[0].value)
    assert.equal(slot?.isBooked, true)
    assert.equal(slot?.isAvailable, false)
    assert.equal('candidateEmail' in (slot || {}), false)

    const resumeKeys = blob.keys().filter((key) => key.startsWith('recruiting/resumes/'))
    assert.equal(resumeKeys.length, 1)
    assert.match(resumeKeys[0], /recruiting\/resumes\/winner\//)

    const savedResume = await createLocalRecruitingStore().readCandidateResume('winner@example.com')
    assert.equal(savedResume?.fileName, 'updated-resume.docx')
    assert.equal(savedResume?.content.toString('utf8'), 'new')
    assert.equal(await createLocalRecruitingStore().readCandidateResume('late@example.com'), null)
  })
})

test('production Blob booking recovers a stale slot lock before writing the booking', async () => {
  await withBlobBookingStore(async (blob) => {
    const slotValue = INTERVIEW_SLOTS[0].value
    await saveCoverage('sbodine@umich.edu', 'Sam', 'Bodine', slotValue)
    await blob.client.put(blobSlotLockPath(slotValue), staleLockPayload(slotValue), {
      access: 'private',
      allowOverwrite: false,
      addRandomSuffix: false,
      contentType: 'application/json',
    })

    await bookSlot(slotValue, 0, { firstName: 'Blob', lastName: 'Fresh', email: 'blob.fresh@example.com' })

    const dashboard = await createLocalRecruitingStore().leadershipDashboardData()
    const candidate = dashboard.candidates?.find((row) => row.email === 'blob.fresh@example.com')
    assert.equal(candidate?.assignedSlot, slotValue)
    assert.equal(blob.keys().some((key) => key === blobSlotLockPath(slotValue)), false)
  })
})

test('production Blob slot reads retry a transient storage failure', async () => {
  await withBlobBookingStore(async (blob) => {
    const state = {
      version: 1,
      accounts: {},
      sessions: {},
      candidates: {},
      interviewerAvailability: {
        'sbodine@umich.edu': {
          name: 'Sam Bodine',
          role: 'Super Admin',
          email: 'sbodine@umich.edu',
          uniqname: 'sbodine',
          availability: [INTERVIEW_SLOTS[0].value],
          availabilitySummary: `${INTERVIEW_SLOTS[0].dayLabel}: 1 slot`,
          maxInterviews: '2',
          notes: '',
          updatedAt: new Date().toISOString(),
          submissionCount: 1,
        },
      },
      calendarEvents: {},
      rateLimits: {},
      resumes: {},
    }
    await blob.client.put('recruiting/state.json', `${JSON.stringify(state)}\n`, {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json',
    })

    let remainingFailures = 1
    setRecruitingBlobClientForTests({
      ...blob.client,
      async get(pathname: string) {
        if (remainingFailures > 0) {
          remainingFailures -= 1
          throw new Error('Blob store is warming back up')
        }
        return blob.client.get(pathname)
      },
    })

    const { res, result } = createResponse()
    await handler({ method: 'GET', body: null, headers: {} }, res)

    assert.equal(result().statusCode, 200)
    const slot = (result().payload as { slots: Array<Record<string, unknown>> }).slots.find((row) => row.value === INTERVIEW_SLOTS[0].value)
    assert.equal(slot?.interviewerCount, 1)
    assert.deepEqual(slot?.interviewers, ['Sam Bodine'])
  })
})

test('production Blob slot reads fail closed instead of returning fake empty coverage', async () => {
  await withBlobBookingStore(async (blob) => {
    setRecruitingBlobClientForTests({
      ...blob.client,
      async get() {
        throw new Error('Blob store is paused')
      },
    })

    const { res, result } = createResponse()
    await handler({ method: 'GET', body: null, headers: {} }, res)

    assert.equal(result().statusCode, 503)
    assert.deepEqual(result().payload, {
      error: 'Recruiting storage is temporarily unavailable. Please refresh in a minute.',
    })
  })
})
