import assert from 'node:assert/strict'
import test from 'node:test'
import { events, isPastEvent } from '../src/lib/events.ts'

const event = events.find(event => event.id === 'alli-hirt-microsoft')!

test('an event leaves upcoming listings at its advertised ending, across visitor timezones', () => {
  assert.equal(isPastEvent(event, Date.parse('2026-10-01T19:59:59-04:00')), false)
  assert.equal(isPastEvent(event, Date.parse('2026-10-02T00:00:00Z')), true)
  assert.equal(isPastEvent(event, Date.parse('2026-10-01T17:00:00-07:00')), true)
})

test('date-only listings remain current until the event timezone passes midnight', () => {
  const allDay = { ...event, endsAt: undefined }
  assert.equal(isPastEvent(allDay, Date.parse('2026-10-02T03:59:59Z')), false)
  assert.equal(isPastEvent(allDay, Date.parse('2026-10-02T04:00:00Z')), true)
})

test('existing recaps remain archived and past events cannot return to upcoming', () => {
  for (const recap of events.filter(event => event.past)) {
    assert.equal(isPastEvent(recap, Date.parse('2026-09-17T12:00:00-04:00')), true)
  }
  assert.equal(isPastEvent(event, Date.parse('2027-01-01T00:00:00Z')), true)
})
