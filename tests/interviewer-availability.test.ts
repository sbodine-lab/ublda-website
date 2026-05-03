import test from 'node:test'
import assert from 'node:assert/strict'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'
import {
  buildInterviewerAvailabilitySubmission,
  validateInterviewerAvailabilityPayload,
} from '../src/lib/interviewerAvailability.ts'

test('accepts e-board interviewer availability across many interview blocks', () => {
  const result = validateInterviewerAvailabilityPayload({
    firstName: 'Alexa',
    lastName: 'Chiang',
    uniqname: 'atchiang',
    availability: [INTERVIEW_SLOTS[0].value, INTERVIEW_SLOTS[1].value, INTERVIEW_SLOTS[42].value],
    maxInterviews: '3',
    notes: 'Prefer to pair with one other interviewer.',
  })

  assert.equal(result.success, true)
  assert.equal(result.data?.email, 'atchiang@umich.edu')
  assert.equal(result.data?.availability.length, 3)
  assert.match(result.data?.availabilitySummary || '', /Thursday, May 7/)
})

test('requires at least one e-board availability block', () => {
  const result = validateInterviewerAvailabilityPayload({
    firstName: 'Alexa',
    lastName: 'Chiang',
    uniqname: 'atchiang',
    availability: [],
  })

  assert.equal(result.success, false)
  assert.match(result.errors[0], /interview block/i)
})

test('builds an interviewer availability submission for Apps Script', () => {
  const result = validateInterviewerAvailabilityPayload({
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    availability: [INTERVIEW_SLOTS[0].value],
  })

  assert.equal(result.success, true)

  const submission = buildInterviewerAvailabilitySubmission(result.data!, 'node-test-agent')

  assert.equal(submission.formType, 'interviewerAvailability')
  assert.equal(submission.dedupeKey, 'sbodine@umich.edu')
  assert.equal(submission.userAgent, 'node-test-agent')
  assert.match(submission.submissionId, /^interviewer_/)
})
