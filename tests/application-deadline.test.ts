import assert from 'node:assert/strict'
import test from 'node:test'
import { APPLY_DEADLINE_AT_MS, APPLY_CLOSES_AT_MS, applyWindow } from '../src/lib/applyForm.ts'

test('public recruiting closes at 11:30 PM Eastern while submissions retain their grace period', () => {
  const deadline = Date.parse('2026-09-20T23:30:00-04:00')
  assert.equal(APPLY_DEADLINE_AT_MS, deadline)
  assert.equal(applyWindow(deadline - 1, APPLY_DEADLINE_AT_MS), 'open')
  assert.equal(applyWindow(deadline, APPLY_DEADLINE_AT_MS), 'closed')
  assert.equal(applyWindow(deadline), 'open')
  assert.equal(applyWindow(APPLY_CLOSES_AT_MS), 'closed')
})
