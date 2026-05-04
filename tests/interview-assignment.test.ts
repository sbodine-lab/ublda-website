import test from 'node:test'
import assert from 'node:assert/strict'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'
import {
  buildInterviewAssignmentSubmission,
  validateInterviewAssignmentPayload,
} from '../src/lib/interviewAssignment.ts'

test('validates an interview assignment update', () => {
  const result = validateInterviewAssignmentPayload({
    email: 'candidate@umich.edu',
    assignedSlot: INTERVIEW_SLOTS[0].value,
    interviewers: ['Sam Bodine', 'Alexa Chiang'],
    interviewStatus: 'Invited',
    feedback: 'Invite sent. Needs scorecard after interview.',
    sessionToken: 'session-token-session-token-session',
  })

  assert.equal(result.success, true)
  assert.equal(result.data?.email, 'candidate@umich.edu')
  assert.equal(result.data?.assignedSlot?.label, 'Thu, May 7, 8:00 AM-8:20 AM ET')
  assert.deepEqual(result.data?.interviewers, ['Sam Bodine', 'Alexa Chiang'])
})

test('rejects invalid assignment status and slot values', () => {
  const result = validateInterviewAssignmentPayload({
    email: 'candidate@umich.edu',
    assignedSlot: 'not-a-slot',
    interviewStatus: 'Maybe',
    sessionToken: 'session-token-session-token-session',
  })

  assert.equal(result.success, false)
  assert.match(result.errors.join(' '), /Assigned slot is invalid/)
  assert.match(result.errors.join(' '), /Interview status is invalid/)
})

test('builds an interview assignment submission for Apps Script', () => {
  const result = validateInterviewAssignmentPayload({
    uniqname: 'candidate',
    assignedSlot: INTERVIEW_SLOTS[0].value,
    interviewStatus: 'Matched',
    interviewers: ['Sam Bodine'],
    sessionToken: 'session-token-session-token-session',
  })

  assert.equal(result.success, true)

  const submission = buildInterviewAssignmentSubmission(result.data!, 'node-test-agent')

  assert.equal(submission.formType, 'interviewAssignment')
  assert.equal(submission.email, 'candidate@umich.edu')
  assert.equal(submission.userAgent, 'node-test-agent')
  assert.match(submission.submissionId, /^assignment_/)
})

test('requires sane interviewer assignments for matched slots', () => {
  const missingSlot = validateInterviewAssignmentPayload({
    email: 'candidate@umich.edu',
    interviewers: ['Sam Bodine'],
    interviewStatus: 'Matched',
    sessionToken: 'session-token-session-token-session',
  })
  const missingInterviewer = validateInterviewAssignmentPayload({
    email: 'candidate@umich.edu',
    assignedSlot: INTERVIEW_SLOTS[0].value,
    interviewStatus: 'Matched',
    sessionToken: 'session-token-session-token-session',
  })
  const tooManyInterviewers = validateInterviewAssignmentPayload({
    email: 'candidate@umich.edu',
    assignedSlot: INTERVIEW_SLOTS[0].value,
    interviewers: ['Sam Bodine', 'Alexa Chiang', 'Cooper Ryan'],
    interviewStatus: 'Matched',
    sessionToken: 'session-token-session-token-session',
  })

  assert.equal(missingSlot.success, false)
  assert.match(missingSlot.errors.join(' '), /assigned slot/i)
  assert.equal(missingInterviewer.success, false)
  assert.match(missingInterviewer.errors.join(' '), /at least one interviewer/i)
  assert.equal(tooManyInterviewers.success, false)
  assert.match(tooManyInterviewers.errors.join(' '), /no more than two/i)
})
