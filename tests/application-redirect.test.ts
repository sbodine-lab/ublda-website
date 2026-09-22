import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('application links with email punctuation redirect to the canonical application route', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  const redirect = config.redirects.find((entry: { source: string }) => entry.source === '/apply.')

  assert.deepEqual(redirect, {
    source: '/apply.',
    destination: '/apply',
    permanent: true,
  })
})
