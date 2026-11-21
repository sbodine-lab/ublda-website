import assert from 'node:assert/strict'
import test from 'node:test'
import { events, featuredEvent, isPastEvent } from '../src/lib/events.ts'
import { bannerVisible, MAX_IGNORED_IMPRESSIONS, popupMode, rsvpParamMatches } from '../src/lib/rsvpStatus.ts'

const panel = events.find(event => event.id === 'disability-business-opportunity-panel')!
const startsAt = Date.parse(panel.startsAt!)
const endsAt = Date.parse(panel.endsAt!)
const before = Date.parse('2026-11-21T12:00:00-05:00')

test('the December panel matches the announcement and is featured until it ends', () => {
  assert.equal(panel.rsvpUrl, 'https://forms.gle/FPsfLTchpQ5VecTCA')
  assert.equal(panel.startsAt, '2026-12-03T18:00:00-05:00')
  assert.equal(panel.endsAt, '2026-12-03T19:30:00-05:00')
  assert.match(panel.location, /R1210/)
  assert.equal(featuredEvent(before)?.id, panel.id)
  assert.equal(featuredEvent(endsAt - 1)?.id, panel.id)
  assert.equal(featuredEvent(endsAt), undefined)
  assert.equal(isPastEvent(panel, endsAt), true)
})

test('new visitors get the invitation; confirmed visitors never do', () => {
  assert.equal(popupMode(undefined, startsAt, before), 'invite')
  assert.equal(popupMode({ going: true }, startsAt, before), null)
  assert.equal(popupMode({ going: true, formOpenedAt: before }, startsAt, before), null)
})

test('a dismissed invitation stays dismissed', () => {
  assert.equal(popupMode({ popupDismissed: true }, startsAt, before), null)
})

test('opening the form leads to one follow-up question, then silence', () => {
  assert.equal(popupMode({ formOpenedAt: before }, startsAt, before), 'confirm')
  // Opening the form overrides an earlier dismissal: the visitor acted on it.
  assert.equal(popupMode({ formOpenedAt: before, popupDismissed: true }, startsAt, before), 'confirm')
  assert.equal(popupMode({ formOpenedAt: before, notYet: true, popupDismissed: true }, startsAt, before), null)
})

test('an ignored invitation retires after a few page loads', () => {
  assert.equal(popupMode({ impressions: MAX_IGNORED_IMPRESSIONS - 1 }, startsAt, before), 'invite')
  assert.equal(popupMode({ impressions: MAX_IGNORED_IMPRESSIONS }, startsAt, before), null)
})

test('no popup once the event starts; the banner stays until it ends unless hidden', () => {
  assert.equal(popupMode(undefined, startsAt, startsAt), null)
  assert.equal(bannerVisible(undefined, endsAt, startsAt), true)
  assert.equal(bannerVisible({ going: true }, endsAt, before), true)
  assert.equal(bannerVisible(undefined, endsAt, endsAt), false)
  assert.equal(bannerVisible({ bannerHidden: true }, endsAt, before), false)
})

test('the form confirmation link marks the visitor as going', () => {
  for (const value of ['done', 'DONE', '1', 'yes', panel.id]) assert.equal(rsvpParamMatches(value, panel.id), true)
  for (const value of [null, '', 'no', 'other-event']) assert.equal(rsvpParamMatches(value, panel.id), false)
})
