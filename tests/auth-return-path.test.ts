import assert from 'node:assert/strict'
import test from 'node:test'
import {
  rememberLeadershipReturnTo,
  safeLeadershipReturnPath,
  takeLeadershipReturnTo,
  type LeadershipReturnPathStorage,
} from '../src/features/decisions/authReturnPath.ts'

const memoryStorage = (): LeadershipReturnPathStorage => {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

test('allows protected workspace, decision, and scheduling return paths', () => {
  assert.equal(safeLeadershipReturnPath('/workspace'), '/workspace')
  assert.equal(safeLeadershipReturnPath('/decision?from=email'), '/decision?from=email')
  assert.equal(safeLeadershipReturnPath('/d/private-slug?view=ballot'), '/d/private-slug?view=ballot')
  assert.equal(safeLeadershipReturnPath('/s/private-slug/results'), '/s/private-slug/results')
})

test('rejects callback, public, protocol-relative, and backslash paths', () => {
  assert.equal(safeLeadershipReturnPath('/auth/callback?code=secret'), null)
  assert.equal(safeLeadershipReturnPath('/about'), null)
  assert.equal(safeLeadershipReturnPath('//attacker.example/workspace'), null)
  assert.equal(safeLeadershipReturnPath('/\\attacker.example/workspace'), null)
  assert.equal(safeLeadershipReturnPath('https://attacker.example/workspace'), null)
})

test('stores, consumes, and removes a safe per-tab return path', () => {
  const storage = memoryStorage()
  rememberLeadershipReturnTo('/decisions/new?template=quick', storage)
  assert.equal(takeLeadershipReturnTo(storage), '/decisions/new?template=quick')
  assert.equal(takeLeadershipReturnTo(storage), '/workspace')
})

test('storage policy failures fall back to the workspace', () => {
  const blockedStorage: LeadershipReturnPathStorage = {
    getItem: () => { throw new Error('blocked') },
    removeItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
  }
  assert.doesNotThrow(() => rememberLeadershipReturnTo('/workspace', blockedStorage))
  assert.equal(takeLeadershipReturnTo(blockedStorage), '/workspace')
})
