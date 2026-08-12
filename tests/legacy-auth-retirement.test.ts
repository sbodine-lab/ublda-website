import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  localSuperAdminDashboardPayload,
  verifyLocalSuperAdminSession,
} from '../server/adminSessions.ts'
import {
  canAccessRecruitingAdmin,
  recruitingAdminAccessForSession,
  recruitingAdminRoleForSession,
} from '../server/recruitingAdmin.ts'

const readSource = (relativePath: string) => readFile(
  new URL(`../${relativePath}`, import.meta.url),
  'utf8',
)

test('legacy shared secrets and HMAC administrator sessions stay retired', async () => {
  const [applicantSource, adminSessionSource, readinessSource] = await Promise.all([
    readSource('api/applicant-account.ts'),
    readSource('server/adminSessions.ts'),
    readSource('server/launchReadiness.ts'),
  ])

  assert.doesNotMatch(applicantSource, /UBLDA_SUPER_ADMIN_PASSWORD|SAM_BODINE_PASSWORD/)
  assert.doesNotMatch(applicantSource, /superAdminPasswordAccount|localSuperAdminAuthResponse/)
  assert.doesNotMatch(adminSessionSource, /process\.env|createHmac|timingSafeEqual|ublda_admin\./)
  assert.doesNotMatch(readinessSource, /UBLDA_SUPER_ADMIN_PASSWORD|SAM_BODINE_PASSWORD|admin-secret/)
  assert.equal(verifyLocalSuperAdminSession('ublda_admin.payload.signature'), false)
  assert.throws(localSuperAdminDashboardPayload, /retired/i)
})

test('Apps Script hard-retires applicant sessions and legacy recruiting administration', async () => {
  const source = await readSource('google-apps-script.js')
  const applicantStart = source.indexOf('function handleApplicantAccount(data)')
  const applicantEnd = source.indexOf('function syncApplicantAccountFromSubmission_', applicantStart)
  const assignmentStart = source.indexOf('function handleInterviewAssignment(data)')
  const assignmentEnd = source.indexOf('function sendInterviewAssignmentNotification_', assignmentStart)
  const applicantHandler = source.slice(applicantStart, applicantEnd)
  const assignmentHandler = source.slice(assignmentStart, assignmentEnd)

  assert.ok(applicantStart >= 0 && applicantEnd > applicantStart)
  assert.ok(assignmentStart >= 0 && assignmentEnd > assignmentStart)
  assert.match(applicantHandler, /Applicant account authentication is retired/)
  assert.doesNotMatch(applicantHandler, /sessionToken|googleSignIn|data\.account|createSessionToken_/)
  assert.match(assignmentHandler, /Legacy recruiting administration is retired/)
  assert.doesNotMatch(assignmentHandler, /sessionToken|authorizeDashboardSession_|setValues/)
  assert.doesNotMatch(source, /function (?:handleApplicantSession_|handleDashboardData_|sessionForToken_|authorizeDashboardSession_|createSessionToken_|verifyPassword_|sendApplicantPortalLink_)\b/)
})

test('dormant recruiting admin authorization rejects all legacy local and Apps Script sessions', async () => {
  const originalScriptUrl = process.env.GOOGLE_SCRIPT_URL
  const originalFetch = globalThis.fetch
  let fetchCalled = false

  process.env.GOOGLE_SCRIPT_URL = 'https://script.example.test/exec'
  globalThis.fetch = async () => {
    fetchCalled = true
    return new Response(JSON.stringify({ success: true, role: 'super-admin' }), { status: 200 })
  }

  try {
    for (const token of [
      'ublda_admin.retired-payload.retired-signature',
      'apps-script-session-token-apps-script-session-token',
      'local_existing-admin-session-token-that-was-already-issued',
    ]) {
      assert.equal(await recruitingAdminRoleForSession(token), '')
      assert.equal(await canAccessRecruitingAdmin(token), false)
      const access = await recruitingAdminAccessForSession(token)
      assert.equal(access.authorized, false)
      assert.equal(access.status, 401)
      assert.match(access.error, /retired/i)
    }
    assert.equal(fetchCalled, false)
  } finally {
    if (originalScriptUrl === undefined) {
      delete process.env.GOOGLE_SCRIPT_URL
    } else {
      process.env.GOOGLE_SCRIPT_URL = originalScriptUrl
    }
    globalThis.fetch = originalFetch
  }
})

test('dev middleware cannot revive applicant or recruiting administrator bypasses', async () => {
  const source = await readSource('vite.config.ts')
  const applicantStart = source.indexOf("server.middlewares.use('/api/applicant-account'")
  const applicantEnd = source.indexOf("server.middlewares.use('/api/apply'", applicantStart)
  const applicantHandler = source.slice(applicantStart, applicantEnd)

  assert.ok(applicantStart >= 0 && applicantEnd > applicantStart)
  assert.match(applicantHandler, /sendJson\(res, 410/)
  assert.match(applicantHandler, /Applicant account authentication is retired/)
  assert.doesNotMatch(applicantHandler, /store\.|verifiedVia|googleSignIn|sessionToken/)
  assert.doesNotMatch(source, /local-preview-session-token/)
  assert.match(source, /Legacy recruiting administration is retired/)
  assert.match(source, /Legacy dashboard authentication is retired/)
})
