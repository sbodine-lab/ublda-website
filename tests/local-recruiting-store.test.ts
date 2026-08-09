import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import {
  buildInterviewerAvailabilitySubmission,
  validateInterviewerAvailabilityPayload,
} from '../src/lib/interviewerAvailability.ts'
import { INTERVIEW_SLOTS } from '../src/lib/interviews.ts'

test('persists public e-board availability into the local dashboard store across restarts', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-store-'))
  const dataPath = path.join(dir, 'recruiting.json')

  try {
    const store = createLocalRecruitingStore(dataPath)
    await store.upsertAccount({
      firstName: 'Sam',
      lastName: 'Bodine',
      uniqname: 'sbodine',
      email: 'sbodine@umich.edu',
    }, 'Bodine06lentz1$')
    const result = validateInterviewerAvailabilityPayload({
      firstName: 'Sam',
      lastName: 'Bodine',
      uniqname: 'sbodine',
      availability: [INTERVIEW_SLOTS[0].value, INTERVIEW_SLOTS[1].value],
      maxInterviews: '2',
    })

    assert.equal(result.success, true)
    await store.saveInterviewerAvailability(buildInterviewerAvailabilitySubmission(result.data!, 'node-test-agent'))

    const restartedStore = createLocalRecruitingStore(dataPath)
    const dashboard = await restartedStore.leadershipDashboardData()

    assert.equal(dashboard.interviewerAvailability?.length, 1)
    assert.equal(dashboard.interviewerAvailability?.[0].name, 'Sam Bodine')
    assert.deepEqual(dashboard.interviewerAvailability?.[0].availability, [
      INTERVIEW_SLOTS[0].value,
      INTERVIEW_SLOTS[1].value,
    ])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('does not grant admin role to password accounts that only match an admin email', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-store-'))
  const dataPath = path.join(dir, 'recruiting.json')

  try {
    const store = createLocalRecruitingStore(dataPath)
    const account = await store.upsertAccount({
      firstName: 'Alexa',
      lastName: 'Chiang',
      uniqname: 'atchiang',
      email: 'atchiang@umich.edu',
    }, 'password-from-public-form')

    assert.equal(account.account.role, 'member')

    const dashboard = await store.dashboardData(account.sessionToken)
    assert.equal(dashboard?.role, 'member')
    assert.equal(dashboard?.dashboardData.candidates, undefined)
    assert.equal(dashboard?.dashboardData.interviewerAvailability, undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('stores new local account passwords with bcrypt hashes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-store-'))
  const dataPath = path.join(dir, 'recruiting.json')

  try {
    const store = createLocalRecruitingStore(dataPath)
    await store.upsertAccount({
      firstName: 'Regular',
      lastName: 'Member',
      uniqname: 'regular',
      email: 'regular@example.com',
    }, 'regular-password')

    const raw = await readFile(dataPath, 'utf8')
    const data = JSON.parse(raw) as { accounts: Record<string, { passwordSalt: string; passwordHash: string }> }
    const stored = data.accounts['regular@example.com']

    assert.equal(stored.passwordSalt, 'bcrypt')
    assert.match(stored.passwordHash, /^\$2[aby]\$/)
    assert.equal(stored.passwordHash.includes('regular-password'), false)
    assert.ok(await store.signIn('regular@example.com', 'regular-password'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
