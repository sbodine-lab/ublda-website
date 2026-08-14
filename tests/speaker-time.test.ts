import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAnnArborTime, formatSpeakerTime } from '../src/lib/speakerTime.ts'

test('formats proposed slots in Ann Arbor and speaker-local time zones', () => {
  const value = '2026-10-01T18:30:00-04:00'
  assert.match(formatAnnArborTime(value), /6:30 PM EDT/)
  assert.match(formatSpeakerTime(value, 'America/Toronto') || '', /6:30 PM EDT/)
  assert.match(formatSpeakerTime(value, 'Europe/London') || '', /11:30 PM GMT\+1/)
})

test('returns no speaker-local value for blank or invalid IANA time zones', () => {
  assert.equal(formatSpeakerTime('2026-10-01T18:30:00-04:00', ''), null)
  assert.equal(formatSpeakerTime('2026-10-01T18:30:00-04:00', 'Not/A_Timezone'), null)
})
