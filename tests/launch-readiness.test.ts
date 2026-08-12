import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildLaunchReadiness } from '../server/launchReadiness.ts'

test('launch readiness ignores retired shared-password configuration', () => {
  const originalPassword = process.env.UBLDA_SUPER_ADMIN_PASSWORD
  const originalSamPassword = process.env.SAM_BODINE_PASSWORD
  const originalFallback = process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK

  delete process.env.UBLDA_SUPER_ADMIN_PASSWORD
  delete process.env.SAM_BODINE_PASSWORD
  delete process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
  const withoutLegacySecrets = buildLaunchReadiness()

  process.env.UBLDA_SUPER_ADMIN_PASSWORD = 'retired-password'
  process.env.SAM_BODINE_PASSWORD = 'retired-password'
  process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = 'true'
  const withLegacySecrets = buildLaunchReadiness()

  try {
    assert.deepEqual(withLegacySecrets.checks, withoutLegacySecrets.checks)
    assert.equal(withLegacySecrets.overall, withoutLegacySecrets.overall)
    assert.equal(withLegacySecrets.checks.some((check) => check.id === 'admin-secret'), false)
  } finally {
    if (originalPassword === undefined) {
      delete process.env.UBLDA_SUPER_ADMIN_PASSWORD
    } else {
      process.env.UBLDA_SUPER_ADMIN_PASSWORD = originalPassword
    }
    if (originalSamPassword === undefined) {
      delete process.env.SAM_BODINE_PASSWORD
    } else {
      process.env.SAM_BODINE_PASSWORD = originalSamPassword
    }
    if (originalFallback === undefined) {
      delete process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK
    } else {
      process.env.UBLDA_ENABLE_LOCAL_ADMIN_FALLBACK = originalFallback
    }
  }
})
