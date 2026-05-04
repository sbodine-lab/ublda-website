import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/apply.ts'
import { INTERVIEW_SLOTS } from '../src/lib/application.ts'

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

test('forwards validated leadership interest submissions to the configured script', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalFetch = globalThis.fetch
  let forwardedBody: Record<string, unknown> | null = null

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  globalThis.fetch = async (_url, init) => {
    forwardedBody = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({ success: true }), { status: 200 })
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
      calendarEventCreated: false,
    })
    assert.equal(forwardedBody?.formType, 'leadershipInterest')
    assert.equal(forwardedBody?.email, 'alexchen@umich.edu')
    assert.equal(forwardedBody?.dedupeKey, 'alexchen@umich.edu')
    assert.equal(forwardedBody?.status, 'Interview eligible')
    assert.deepEqual(forwardedBody?.rolePreferences, ['VP of Events & Programming', 'VP of Member Experience', 'VP of Marketing & Community'])
    assert.equal((forwardedBody?.availability as unknown[]).length, 2)
    assert.deepEqual(forwardedBody?.interviewSlot, {
      value: INTERVIEW_SLOTS[0].value,
      label: 'Thu, May 7, 8:00 AM-8:30 AM ET',
      dayLabel: 'Thursday, May 7',
      timeLabel: '8:00 AM-8:30 AM ET',
      bufferLabel: 'buffer until 8:50 AM ET',
      start: '2026-05-07T08:00:00-04:00',
      end: '2026-05-07T08:30:00-04:00',
      bufferEnd: '2026-05-07T08:50:00-04:00',
      startMinutes: 480,
    })
    assert.equal((forwardedBody?.resumeFile as Record<string, unknown>)?.name, 'alex-chen-resume.pdf')
    assert.match(String(forwardedBody?.submissionId), /^app_/)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    globalThis.fetch = originalFetch
  }
})
