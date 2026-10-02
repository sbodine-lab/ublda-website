import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalPublicPath, isClubPath } from '../src/lib/publicRoutes.ts'

test('public URL variants reach the current club design', () => {
  for (const path of ['/about', '/events', '/team', '/join', '/brand', '/links']) {
    assert.equal(canonicalPublicPath(`${path}/`), path)
    assert.equal(canonicalPublicPath(`${path.toUpperCase()}///`), path)
    assert.ok(isClubPath(canonicalPublicPath(`${path}/`)))
  }
  assert.equal(canonicalPublicPath('/'), '/')
})

test('consulting URL variants retain their destination', () => {
  assert.equal(canonicalPublicPath('/Consulting/'), '/consulting')
  assert.equal(canonicalPublicPath('/consulting/services/Strategy/'), '/consulting/services/strategy')
  assert.equal(canonicalPublicPath('/Advisory/'), '/advisory')
})

test('unrelated routes and case-sensitive identifiers remain untouched', () => {
  for (const path of ['/workspace/', '/auth/callback/', '/d/CaseSensitiveToken/', '/about-us/', '/consulting-private/']) {
    assert.equal(canonicalPublicPath(path), path)
    assert.equal(isClubPath(path), false)
  }
})
