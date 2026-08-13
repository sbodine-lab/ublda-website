import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

test('retired recruiting routes and implementation files stay removed', () => {
  const retiredFiles = [
    'api/apply.ts',
    'api/interview-booking.ts',
    'api/recruiting.ts',
    'server/localRecruitingStore.ts',
    'src/pages/Apply.tsx',
    'src/pages/InterviewBooking.tsx',
    'src/pages/InterviewerAvailability.tsx',
    'src/styles/portal.css',
  ]

  for (const file of retiredFiles) {
    assert.equal(existsSync(resolve(root, file)), false, `${file} should remain deleted`)
  }

  const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8')
  const footer = readFileSync(resolve(root, 'src/components/Footer.tsx'), 'utf8')
  const vercel = readFileSync(resolve(root, 'vercel.json'), 'utf8')

  for (const route of ['/apply', '/portal', '/interview-booking', '/interviewer-availability']) {
    assert.equal(app.includes(route), false, `${route} should not be routed by the app`)
  }
  assert.equal(footer.includes('Interview Portal'), false)
  assert.equal(vercel.includes('/api/recruiting'), false)
  assert.equal(vercel.includes('/api/resume'), false)
})
