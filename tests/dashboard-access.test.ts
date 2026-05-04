import assert from 'node:assert/strict'
import { test } from 'node:test'
import { roleForEmail, scopesForEmail } from '../src/lib/dashboardAccess.ts'
import { buildMemberProfile } from '../src/lib/memberData.ts'

test('makes Sam Bodine the only super admin in the local role roster', () => {
  assert.equal(roleForEmail('sbodine@umich.edu'), 'super-admin')
  assert.equal(roleForEmail('atchiang@umich.edu'), 'exec')
  assert.equal(roleForEmail('member@umich.edu'), 'member')
  assert.ok(scopesForEmail('sbodine@umich.edu').includes('system'))
})

test('builds member profiles with account-backed dashboard roles', () => {
  const profile = buildMemberProfile({
    firstName: 'Sam',
    lastName: 'Bodine',
    uniqname: 'sbodine',
    email: 'sbodine@umich.edu',
  })

  assert.equal(profile.role, 'super-admin')
  assert.equal(profile.memberStatus, 'Super admin')
  assert.ok(profile.adminScopes.includes('recruiting'))
})
