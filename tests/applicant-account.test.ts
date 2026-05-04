import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateApplicantAccountPayload } from '../src/lib/applicantAccount.ts'

test('validates applicant account creation with a UMich identity', () => {
  const result = validateApplicantAccountPayload({
    action: 'create',
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'SBoDine@umich.edu',
    password: 'secure-password',
  })

  assert.equal(result.success, true)
  assert.equal(result.data?.action, 'create')
  assert.equal(result.data?.action === 'create' ? result.data.account.email : '', 'sbodine@umich.edu')
})

test('validates uniqname and password sign-in requests', () => {
  const result = validateApplicantAccountPayload({
    action: 'signIn',
    uniqname: 'SBoDine@umich.edu',
    password: 'secure-password',
  })

  assert.equal(result.success, true)
  assert.equal(result.data?.action, 'signIn')
  assert.equal(result.data?.action === 'signIn' ? result.data.email : '', 'sbodine@umich.edu')
})

test('validates passwordless sign-in link requests', () => {
  const result = validateApplicantAccountPayload({
    action: 'requestMagicLink',
    uniqname: 'alexchen',
  })

  assert.equal(result.success, true)
  assert.equal(result.data?.action, 'requestMagicLink')
  assert.equal(result.data?.action === 'requestMagicLink' ? result.data.email : '', 'alexchen@umich.edu')
})

test('requires a usable password for account access', () => {
  const result = validateApplicantAccountPayload({
    action: 'signIn',
    uniqname: 'sbodine',
    password: 'short',
  })

  assert.equal(result.success, false)
  assert.match(result.errors.join(' '), /password/i)
})

test('validates Google sign-in credentials with UMich profiles', () => {
  const result = validateApplicantAccountPayload({
    action: 'googleSignIn',
    credential: 'google-token-google-token-google-token',
    profile: {
      email: 'alexchen@umich.edu',
      firstName: 'Alex',
      lastName: 'Chen',
    },
  })

  assert.equal(result.success, true)
  assert.equal(result.data?.action, 'googleSignIn')
})

test('requires a session token for portal restore requests', () => {
  const result = validateApplicantAccountPayload({
    action: 'session',
    sessionToken: 'short',
  })

  assert.equal(result.success, false)
  assert.match(result.errors[0], /session/i)
})
