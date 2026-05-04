import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'
import type { Candidate, InterviewerAvailability } from '../src/lib/memberData.ts'
import {
  matchInterviewCandidate,
  matchOpenInterviewSlate,
} from '../src/lib/interviewMatching.ts'

const candidate = (overrides: Partial<Candidate>): Candidate => ({
  id: 'candidate',
  name: 'Candidate',
  program: 'Ross BBA',
  email: 'candidate@umich.edu',
  rolePreferences: ['VP of Events & Programming'],
  status: 'Needs match',
  availability: [INTERVIEW_SLOTS[0].value],
  resumeUrl: 'https://drive.google.com/',
  assignedSlot: '',
  interviewers: [],
  feedback: '',
  ...overrides,
})

const interviewer = (overrides: Partial<InterviewerAvailability>): InterviewerAvailability => ({
  name: 'Interviewer',
  role: 'E-board',
  availability: [INTERVIEW_SLOTS[0].value],
  maxInterviews: '3',
  ...overrides,
})

test('matches a candidate to up to two interviewers on a shared interview slot', () => {
  const match = matchInterviewCandidate(
    candidate({}),
    [
      interviewer({ name: 'Sam Bodine' }),
      interviewer({ name: 'Alexa Chiang' }),
      interviewer({ name: 'Cooper Perry', availability: [INTERVIEW_SLOTS[1].value] }),
    ],
    [],
  )

  assert.equal(match?.assignedSlot, INTERVIEW_SLOTS[0].value)
  assert.deepEqual(match?.interviewers, ['Alexa Chiang', 'Sam Bodine'])
})

test('avoids a biased interviewer when a candidate flags a conflict', () => {
  const match = matchInterviewCandidate(
    candidate({}),
    [
      interviewer({ name: 'Sam Bodine' }),
      interviewer({ name: 'Alexa Chiang' }),
    ],
    [],
    ['Sam Bodine'],
  )

  assert.equal(match?.assignedSlot, INTERVIEW_SLOTS[0].value)
  assert.deepEqual(match?.interviewers, ['Alexa Chiang'])
})

test('balances slate matching against interviewer capacity', () => {
  const candidates = [
    candidate({ id: 'a', email: 'a@umich.edu' }),
    candidate({ id: 'b', email: 'b@umich.edu' }),
  ]
  const interviewers = [
    interviewer({ name: 'Sam Bodine', maxInterviews: '1' }),
    interviewer({ name: 'Alexa Chiang', maxInterviews: '2' }),
  ]

  const result = matchOpenInterviewSlate(candidates, interviewers)

  assert.equal(result.matchedCount, 2)
  assert.deepEqual(result.candidates[0].interviewers, ['Alexa Chiang', 'Sam Bodine'])
  assert.deepEqual(result.candidates[1].interviewers, ['Alexa Chiang'])
})

test('ignores stale interviewer names on unslotted candidates when balancing load', () => {
  const match = matchInterviewCandidate(
    candidate({ id: 'open', email: 'open@umich.edu' }),
    [interviewer({ name: 'Sam Bodine', maxInterviews: '1' })],
    [
      candidate({
        id: 'stale',
        email: 'stale@umich.edu',
        assignedSlot: '',
        interviewers: ['Sam Bodine'],
      }),
    ],
  )

  assert.equal(match?.assignedSlot, INTERVIEW_SLOTS[0].value)
  assert.deepEqual(match?.interviewers, ['Sam Bodine'])
})
