import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.ts'
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
    const account = await store.upsertAccount({
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
    const dashboard = await restartedStore.dashboardData(account.sessionToken)

    assert.equal(dashboard?.role, 'super-admin')
    assert.equal(dashboard?.dashboardData.interviewerAvailability?.length, 1)
    assert.equal(dashboard?.dashboardData.interviewerAvailability?.[0].name, 'Sam Bodine')
    assert.deepEqual(dashboard?.dashboardData.interviewerAvailability?.[0].availability, [
      INTERVIEW_SLOTS[0].value,
      INTERVIEW_SLOTS[1].value,
    ])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
