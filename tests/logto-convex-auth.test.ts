import assert from 'node:assert/strict'
import test from 'node:test'
import { logtoIsLoadingForConvex } from '../src/features/decisions/logtoConvexAuth.ts'

test('reports loading while Logto resolves the initial signed-out session', () => {
  assert.equal(logtoIsLoadingForConvex(true, false), true)
})

test('does not restart Convex auth for authenticated Logto token operations', () => {
  assert.equal(logtoIsLoadingForConvex(true, true), false)
})

test('reports settled state after Logto finishes loading', () => {
  assert.equal(logtoIsLoadingForConvex(false, false), false)
  assert.equal(logtoIsLoadingForConvex(false, true), false)
})
