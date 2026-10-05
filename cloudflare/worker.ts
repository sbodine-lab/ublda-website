import type { VercelRequest, VercelResponse } from '../server/types.ts'
import vercelConfig from '../vercel.json' with { type: 'json' }

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown
type Environment = { BLOB_READ_WRITE_TOKEN?: string }
type CloudflareRequest = Request & {
  cf?: { latitude?: string; longitude?: string; city?: string }
}

// Reuse the production handlers, including their authorization, validation,
// conditional Blob writes, and outbound service calls. No data is copied here.
const handlers: Record<string, () => Promise<{ default: ApiHandler }>> = {
  '/api/apply': () => import('../api/apply.ts'),
  '/api/bba-mtc': () => import('../api/bba-mtc.ts'),
  '/api/contact': () => import('../api/contact.ts'),
  '/api/craft-night': () => import('../api/craft-night.ts'),
  '/api/decision-agent': () => import('../api/decision-agent.ts'),
  '/api/housing': () => import('../api/housing.ts'),
  '/api/join': () => import('../api/join.ts'),
  '/api/operations': () => import('../api/operations.ts'),
  '/api/speaker-ops': () => import('../api/speaker-ops.ts'),
  '/api/weather': () => import('../api/weather.ts'),
}

const blobRoutes = new Set(['/api/bba-mtc', '/api/craft-night', '/api/operations', '/api/speaker-ops'])
const MAX_BODY_BYTES = 1024 * 1024

export function apiRoute(url: URL) {
  for (const rewrite of vercelConfig.rewrites) {
    if (!rewrite.source.startsWith('/api/') && rewrite.source !== '/mcp') continue
    const names: string[] = []
    const pattern = rewrite.source.split('/').map((part) => {
      if (!part.startsWith(':')) return part
      names.push(part.slice(1).replace(/\*$/, ''))
      return part.endsWith('*') ? '(.*)' : '([^/]+)'
    }).join('/')
    const match = url.pathname.match(new RegExp(`^${pattern}$`))
    if (!match) continue
    let destination = rewrite.destination
    names.forEach((name, index) => {
      destination = destination.replace(`:${name}*`, match[index + 1]).replace(`:${name}`, match[index + 1])
    })
    const target = new URL(destination, url.origin)
    const query = new URLSearchParams(url.searchParams)
    target.searchParams.forEach((value, name) => query.set(name, value))
    return { pathname: target.pathname, query }
  }
  return { pathname: url.pathname, query: url.searchParams }
}

function securityHeaders() {
  const headers = new Headers()
  for (const rule of vercelConfig.headers) {
    if (rule.source === '/(.*)') {
      rule.headers.forEach(({ key, value }) => headers.set(key, value))
    }
  }
  headers.set('Cache-Control', 'no-store, max-age=0')
  return headers
}

function errorResponse(status: number, message: string) {
  const headers = securityHeaders()
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify({ error: message }), { status, headers })
}

async function readBody(request: Request) {
  if (!request.body) return undefined
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new RangeError('body')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new RangeError('body')
    }
    chunks.push(value)
  }
  const buffer = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength }
  const text = new TextDecoder().decode(buffer)
  if (!text) return undefined
  if (request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return JSON.parse(text) as unknown
  }
  return text
}

export async function handleApiRequest(request: CloudflareRequest, env: Environment) {
  const url = new URL(request.url)
  const route = apiRoute(url)
  const load = handlers[route.pathname]
  if (!load) return errorResponse(404, 'Not found')

  // Workers' filesystem is ephemeral. Never serve an empty local roster or
  // acknowledge a signup that would disappear when the isolate is replaced.
  if (blobRoutes.has(route.pathname) && !env.BLOB_READ_WRITE_TOKEN) {
    return errorResponse(503, 'Persistent storage is not configured.')
  }

  let body: unknown
  try {
    body = await readBody(request)
  } catch (error) {
    return errorResponse(error instanceof RangeError ? 413 : 400,
      error instanceof RangeError ? 'Request body is too large.' : 'Invalid JSON body.')
  }

  const headers = Object.fromEntries(request.headers.entries())
  // Only trust Cloudflare's connection and location metadata, never visitor-
  // supplied forwarding or Vercel geolocation headers.
  headers['x-forwarded-for'] = request.headers.get('cf-connecting-ip') || 'unknown'
  headers['x-forwarded-host'] = url.host
  headers['x-forwarded-proto'] = url.protocol.slice(0, -1)
  headers.host = url.host
  for (const key of ['x-vercel-ip-latitude', 'x-vercel-ip-longitude', 'x-vercel-ip-city']) delete headers[key]
  if (request.cf?.latitude) headers['x-vercel-ip-latitude'] = request.cf.latitude
  if (request.cf?.longitude) headers['x-vercel-ip-longitude'] = request.cf.longitude
  if (request.cf?.city) headers['x-vercel-ip-city'] = encodeURIComponent(request.cf.city)
  const query: Record<string, string | string[]> = {}
  for (const key of new Set(route.query.keys())) {
    const values = route.query.getAll(key)
    query[key] = values.length === 1 ? values[0] : values
  }
  const req: VercelRequest = {
    method: request.method, headers, body, query,
    url: `${url.pathname}${url.search}`,
    socket: { remoteAddress: headers['x-forwarded-for'] },
  }
  const responseHeaders = securityHeaders()
  let status = 200
  let responseBody: string | null = null
  const res: VercelResponse = {
    setHeader(name, value) { responseHeaders.set(name, value); return res },
    status(code) { status = code; return res },
    json(value) {
      responseHeaders.set('Content-Type', 'application/json; charset=utf-8')
      responseBody = JSON.stringify(value)
      return res
    },
    send(value) { responseBody = value == null ? null : String(value); return res },
  }
  try {
    await (await load()).default(req, res)
    return new Response(request.method === 'HEAD' || status === 204 || status === 304 ? null : responseBody,
      { status, headers: responseHeaders })
  } catch {
    return errorResponse(500, 'Something went wrong. Please try again.')
  }
}

export default { fetch: handleApiRequest }
