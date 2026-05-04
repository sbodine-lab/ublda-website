import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INTERVIEW_SLOTS,
  buildApplicationSubmission,
  normalizeUniqname,
  validateApplicationPayload,
} from '../src/lib/application.ts'

const resumeFile = {
  name: 'sam-bodine-resume.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  contentBase64: 'cmVzdW1l',
}

test('normalizes UMich uniqnames into a canonical email identity', () => {
  assert.equal(normalizeUniqname('  SBoDine@umich.edu  '), 'sbodine')
  assert.equal(normalizeUniqname('sbodine@personal.com'), 'sbodine')
})

test('accepts a complete Ross interview signup with a resume drop', () => {
  const result = validateApplicationPayload({
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    year: 'Junior',
    expectedGraduation: 'May 2028',
    college: 'Ross BBA',
    rossStatus: 'ross-bba',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    availability: [INTERVIEW_SLOTS[0].value, INTERVIEW_SLOTS[1].value, INTERVIEW_SLOTS[28].value],
    resumeFile,
  })

  assert.equal(result.success, true)
  assert.equal(result.data?.email, 'sbodine@umich.edu')
  assert.equal(result.data?.status, 'Interview eligible')
  assert.equal(result.data?.preferredRole, 'Events and Programming')
  assert.equal(result.data?.rolePreferences.length, 3)
  assert.equal(result.data?.availability.length, 3)
  assert.equal(result.data?.interviewSlot.label, 'Thu, May 7, 8:00 AM-8:30 AM ET')
  assert.equal(result.data?.resumeFile.name, 'sam-bodine-resume.pdf')
})

test('keeps non-Ross students in the future role pool instead of rejecting them', () => {
  const result = validateApplicationPayload({
    firstName: 'Alex',
    lastName: 'Kim',
    uniqname: 'alexkim',
    year: 'Sophomore',
    expectedGraduation: 'May 2029',
    college: 'LSA',
    rossStatus: 'non-ross',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    availability: [INTERVIEW_SLOTS[10].value],
    resumeFile,
  })

  assert.equal(result.success, true)
  assert.equal(result.data?.status, 'Future role pool')
})

test('strips raw markup delimiters from stored application text fields', () => {
  const result = validateApplicationPayload({
    firstName: '<script>Sam</script>',
    lastName: '<img src=x onerror=alert(1)>',
    uniqname: 'markup-probe',
    year: 'Junior',
    expectedGraduation: 'May 2028',
    college: '<b>Ross BBA</b>',
    rossStatus: 'ross-bba',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    availability: [INTERVIEW_SLOTS[0].value],
    notes: '<script>alert(1)</script>',
    resumeFile,
  })

  assert.equal(result.success, true)
  assert.equal(/[<>]/.test(`${result.data?.firstName} ${result.data?.lastName} ${result.data?.college} ${result.data?.notes}`), false)
})

test('requires at least one available interview slot because matching happens later', () => {
  const result = validateApplicationPayload({
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    year: 'Junior',
    expectedGraduation: 'May 2028',
    college: 'Ross BBA',
    rossStatus: 'ross-bba',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    resumeFile,
  })

  assert.equal(result.success, false)
  assert.match(result.errors[0], /interview slot/i)
})

test('requires all three ranked function preferences', () => {
  const result = validateApplicationPayload({
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    year: 'Junior',
    expectedGraduation: 'May 2028',
    college: 'Ross BBA',
    rossStatus: 'ross-bba',
    rolePreferences: ['Events and Programming'],
    availability: [INTERVIEW_SLOTS[0].value],
    resumeFile,
  })

  assert.equal(result.success, false)
  assert.match(result.errors[0], /function/i)
})

test('requires a valid resume file upload', () => {
  const missingResume = validateApplicationPayload({
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    year: 'Junior',
    expectedGraduation: 'May 2028',
    college: 'Ross BBA',
    rossStatus: 'ross-bba',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    availability: [INTERVIEW_SLOTS[0].value],
  })

  assert.equal(missingResume.success, false)
  assert.match(missingResume.errors[0], /resume/i)

  const invalidResume = validateApplicationPayload({
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    year: 'Junior',
    expectedGraduation: 'May 2028',
    college: 'Ross BBA',
    rossStatus: 'ross-bba',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    availability: [INTERVIEW_SLOTS[0].value],
    resumeFile: {
      name: 'resume.png',
      mimeType: 'image/png',
      size: 1024,
      contentBase64: 'cmVzdW1l',
    },
  })

  assert.equal(invalidResume.success, false)
  assert.match(invalidResume.errors[0], /PDF, DOC, or DOCX/i)

  const docxWithoutBrowserMime = validateApplicationPayload({
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    year: 'Junior',
    expectedGraduation: 'May 2028',
    college: 'Ross BBA',
    rossStatus: 'ross-bba',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    availability: [INTERVIEW_SLOTS[0].value],
    resumeFile: {
      name: 'resume.docx',
      mimeType: '',
      size: 1024,
      contentBase64: 'cmVzdW1l',
    },
  })

  assert.equal(docxWithoutBrowserMime.success, true)
})

test('builds a submission with a stable dedupe key and generated submission id', () => {
  const result = validateApplicationPayload({
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    year: 'Junior',
    expectedGraduation: 'May 2028',
    college: 'Ross BBA',
    rossStatus: 'ross-bba',
    rolePreferences: ['Events and Programming', 'Marketing and Social Media', 'Outreach and Partnerships'],
    availability: [INTERVIEW_SLOTS[17].value, INTERVIEW_SLOTS[18].value],
    resumeFile,
  })

  assert.equal(result.success, true)

  const submission = buildApplicationSubmission(result.data!, 'node-test-agent')

  assert.equal(submission.dedupeKey, 'sbodine@umich.edu')
  assert.equal(submission.userAgent, 'node-test-agent')
  assert.equal(submission.availability.length, 2)
  assert.equal(submission.interviewSlot.label, 'Fri, May 8, 8:00 AM-8:30 AM ET')
  assert.equal(submission.interviewSlot.bufferLabel, 'buffer until 8:50 AM ET')
  assert.equal(submission.resumeFile.name, 'sam-bodine-resume.pdf')
  assert.match(submission.submissionId, /^app_/)
})
