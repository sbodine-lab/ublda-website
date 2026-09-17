import test from 'node:test'
import assert from 'node:assert/strict'
import { sendContactInquiry } from '../server/contactService.ts'
import handler from '../api/contact.ts'
import type { VercelResponse } from '../server/types.ts'

const input = { name: 'Test Visitor', email: 'visitor@example.com', organization: 'Example', message: 'A question about consulting.' }
const config = { apiKey: 'test-only', from: 'UBLDA Consulting <contact@mail.ublda.org>' }

test('contact sends only to the designated team, with visitor Reply-To and retry deduplication', async () => {
  const calls: RequestInit[] = []
  const fetcher = (async (_url: unknown, init: RequestInit) => { calls.push(init); return Response.json({ id: 'test-id' }) }) as typeof fetch
  for (let i = 0; i < 2; i++) {
    const result = await sendContactInquiry({ ...input, to: ['attacker@example.com'], cc: ['attacker@example.com'], from: 'attacker@example.com' }, 'routing-test', { ...config, fetcher })
    assert.equal(result.status, 200)
  }
  const payload = JSON.parse(calls[0].body as string)
  assert.deepEqual(payload.to, ['alexfors@umich.edu'])
  assert.deepEqual(payload.cc, ['cooperry@umich.edu', 'atchiang@umich.edu', 'sbodine@umich.edu'])
  assert.equal(payload.from, config.from)
  assert.equal(payload.reply_to, input.email)
  assert.match(payload.text, /A question about consulting\./)
  assert.equal(new Headers(calls[0].headers).get('Idempotency-Key'), new Headers(calls[1].headers).get('Idempotency-Key'))
})

test('invalid fields and honeypot never call the email provider', async () => {
  const fetcher = (async () => { throw new Error('Provider must not be called') }) as typeof fetch
  for (const body of [{}, { ...input, email: 'x@example.com\r\nBcc: a@example.com' }, { ...input, message: ' ' }, { ...input, name: 'Injected\nHeader' }, { ...input, message: 'x'.repeat(4001) }]) {
    assert.equal((await sendContactInquiry(body, 'validation-test', { ...config, fetcher })).status, 400)
  }
  assert.deepEqual(await sendContactInquiry({ website: 'spam' }, 'bot-test', { ...config, fetcher }), { status: 200, body: { success: true } })
})

test('contact preserves message text and does not treat visitor markup as HTML', async () => {
  const fetcher = (async (_url: unknown, init: RequestInit) => {
    const payload = JSON.parse(init.body as string)
    assert.equal(payload.html, undefined)
    assert.match(payload.text, /<script>not executable<\/script>/)
    return Response.json({ id: 'test-id' })
  }) as typeof fetch
  assert.equal((await sendContactInquiry({ ...input, message: '<script>not executable</script>' }, 'text-test', { ...config, fetcher })).status, 200)
})

test('provider rejection, malformed success and timeout never report success', async () => {
  for (const fetcher of [async () => Response.json({ message: 'Secret provider diagnostic' }, { status: 403 }), async () => Response.json({}), async () => { throw new Error('timeout') }]) {
    const result = await sendContactInquiry(input, 'failure-test', { ...config, fetcher: fetcher as typeof fetch })
    assert.equal(result.status, 502)
    assert.equal('success' in result.body, false)
    assert.doesNotMatch(JSON.stringify(result.body), /Secret/)
  }
})

test('missing sender config fails without sending', async () => {
  assert.equal((await sendContactInquiry(input, 'config-test', { ...config, from: '' })).status, 503)
})

test('burst guard blocks the sixth attempt and expires', async () => {
  let calls = 0
  const fetcher = (async () => { calls++; return Response.json({ id: 'test-id' }) }) as typeof fetch
  const now = Date.now()
  for (let i = 0; i < 5; i++) assert.equal((await sendContactInquiry(input, 'burst-test', { ...config, fetcher, now })).status, 200)
  assert.equal((await sendContactInquiry(input, 'burst-test', { ...config, fetcher, now })).status, 429)
  assert.equal(calls, 5)
  assert.equal((await sendContactInquiry(input, 'burst-test', { ...config, fetcher, now: now + 600001 })).status, 200)
})

test('contact endpoint rejects other methods, foreign origins and non-JSON input', async () => {
  for (const [method, headers, expected] of [
    ['GET', {}, 405],
    ['POST', { origin: 'https://example.com', 'content-type': 'application/json' }, 403],
    ['POST', { origin: 'https://ublda.org', 'content-type': 'text/plain' }, 415],
  ] as const) {
    let status = 0
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json() { return this }, send() { return this } } as VercelResponse
    await handler({ method, headers, body: input }, res)
    assert.equal(status, expected)
  }
})
