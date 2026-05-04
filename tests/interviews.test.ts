import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INTERVIEW_BLOCK_MINUTES,
  INTERVIEW_BUFFER_MINUTES,
  INTERVIEW_SLOT_GROUPS,
  INTERVIEW_SLOT_INTERVAL_MINUTES,
  INTERVIEW_SLOTS,
  sortSlotValues,
} from '../src/lib/interviews.ts'

test('builds 30-minute interview slots with 20-minute buffers between starts', () => {
  assert.equal(INTERVIEW_BLOCK_MINUTES, 30)
  assert.equal(INTERVIEW_BUFFER_MINUTES, 20)
  assert.equal(INTERVIEW_SLOT_INTERVAL_MINUTES, 50)
  assert.equal(INTERVIEW_SLOTS.length, 68)
  assert.equal(INTERVIEW_SLOTS[0].timeLabel, '8:00 AM-8:30 AM ET')
  assert.equal(INTERVIEW_SLOTS[0].bufferLabel, 'buffer until 8:50 AM ET')
  assert.equal(INTERVIEW_SLOTS[1].timeLabel, '8:50 AM-9:20 AM ET')
})

test('groups slots into day parts for lower-friction availability picking', () => {
  const firstDay = INTERVIEW_SLOT_GROUPS[0]

  assert.equal(firstDay.parts.length, 3)
  assert.equal(firstDay.parts[0].label, 'Morning')
  assert.equal(firstDay.parts[0].slots.length, 5)
  assert.equal(firstDay.parts[1].slots.length, 6)
  assert.equal(firstDay.parts[2].slots.length, 6)
})

test('sorts selected slot values back into schedule order', () => {
  assert.deepEqual(
    sortSlotValues([INTERVIEW_SLOTS[5].value, INTERVIEW_SLOTS[0].value, INTERVIEW_SLOTS[2].value]),
    [INTERVIEW_SLOTS[0].value, INTERVIEW_SLOTS[2].value, INTERVIEW_SLOTS[5].value],
  )
})
