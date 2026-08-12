import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

type VercelConfig = {
  redirects?: Array<{
    source?: string
    destination?: string
    permanent?: boolean
    has?: Array<{ type?: string; value?: string }>
  }>
  headers?: Array<{
    source?: string
    headers?: Array<{ key?: string; value?: string }>
  }>
}

const config = async () => JSON.parse(
  await readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
) as VercelConfig

test('canonicalizes www before beginning an OAuth flow', async () => {
  const redirect = (await config()).redirects?.find((entry) => (
    entry.has?.some((condition) => condition.type === 'host' && condition.value === 'www.ublda.org')
  ))
  assert.equal(redirect?.destination, 'https://ublda.org/:path*')
  assert.equal(redirect?.permanent, true)
})

test('protects browser-stored Logto tokens with baseline response headers', async () => {
  const globalHeaders = (await config()).headers?.find((entry) => entry.source === '/(.*)')?.headers ?? []
  const byName = new Map(globalHeaders.map((header) => [header.key?.toLowerCase(), header.value]))
  const csp = byName.get('content-security-policy') ?? ''

  assert.match(csp, /script-src 'self'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-(?:inline|eval)'/)
  assert.equal(byName.get('x-frame-options'), 'DENY')
  assert.equal(byName.get('x-content-type-options'), 'nosniff')
  assert.equal(byName.get('referrer-policy'), 'strict-origin-when-cross-origin')
})
