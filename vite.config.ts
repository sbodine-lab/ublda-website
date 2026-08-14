import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { housingApiPayloadForRoute } from './server/housingApi.ts'
import {
  handleSpeakerOpsRequest,
  type SpeakerOpsIdentityVerifier,
} from './server/speakerOpsService.ts'
import { handleOperationsRequest } from './server/operationsService.ts'
import { getLocalWeather } from './server/weatherService.ts'

const LOCAL_LEADERSHIP_PREVIEW_TOKEN = 'ublda-local-leadership-preview'
const verifyLocalSpeakerOpsIdentity: SpeakerOpsIdentityVerifier = async (idToken) => {
  if (idToken !== LOCAL_LEADERSHIP_PREVIEW_TOKEN) {
    throw new Error('Invalid local leadership preview token.')
  }
  return {
    memberId: 'local-preview-member',
    displayName: 'Sam Bodine',
    email: 'sbodine@umich.edu',
    role: 'admin',
  }
}

const readJsonBody = (req: IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) as Record<string, unknown> : {})
      } catch {
        resolve({})
      }
    })
  })

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  // setApiSecurityHeaders sets this in production; dev has to match or a header-sniffing bug
  // only shows up after deploy.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(payload))
}

const devApiPlugin = () => ({
  name: 'ublda-dev-api',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/api/weather', async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) {
          const firstValue = Array.isArray(value) ? value[0] : value
          if (firstValue) headers.set(name, firstValue)
        }
        sendJson(res, 200, await getLocalWeather(headers))
      } catch (error) {
        console.error('Local weather unavailable', error)
        sendJson(res, 503, { error: 'Local weather is temporarily unavailable.' })
      }
    })

    server.middlewares.use('/api/speaker-ops', async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readJsonBody(req)
      const forwarded = req.headers['x-forwarded-for']
      const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
        || req.socket.remoteAddress
        || 'local-preview'
      const result = await handleSpeakerOpsRequest(body, ip, {
        verifyIdentity: verifyLocalSpeakerOpsIdentity,
      })
      sendJson(res, result.status, { ...result.body, localPreview: true })
    })

    server.middlewares.use('/api/operations', async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readJsonBody(req)
      const forwarded = req.headers['x-forwarded-for']
      const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
        || req.socket.remoteAddress
        || 'local-preview'
      const result = await handleOperationsRequest(body, ip, {
        verifyIdentity: verifyLocalSpeakerOpsIdentity,
      })
      sendJson(res, result.status, { ...result.body, localPreview: true })
    })

    server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const housingPath = url.pathname
      const isHousingApi = [
        /^\/facilities(?:\/|$)/,
        /^\/map\/layers(?:\/|$)/,
        /^\/analytics\/geographies(?:\/|$)/,
        /^\/provider\/claim-facility$/,
        /^\/submissions\/facility-correction$/,
        /^\/referrals$/,
        /^\/admin\/review-queue$/,
        /^\/housing(?:\/|$)/,
      ].some((pattern) => pattern.test(housingPath))

      if (!isHousingApi) {
        next()
        return
      }

      const body = req.method && ['GET', 'HEAD'].includes(req.method) ? undefined : await readJsonBody(req)
      const query = Object.fromEntries(url.searchParams.entries())
      const payload = housingApiPayloadForRoute(req.method, housingPath, {
        query,
        body,
        headers: req.headers as Record<string, string | string[] | undefined>,
      })

      sendJson(res, payload.status, payload)
    })

  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
