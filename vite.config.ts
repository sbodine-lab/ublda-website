import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { buildApplicationSubmission, validateApplicationPayload } from './src/lib/application.ts'
import { buildInterviewBookingSubmission, validateInterviewBookingPayload } from './src/lib/interviewBooking.ts'
import { buildInterviewerAvailabilitySubmission, validateInterviewerAvailabilityPayload } from './src/lib/interviewerAvailability.ts'
import { bookingEmailLaunchError, sendBookingConfirmationEmail } from './server/bookingEmail.ts'
import { createLocalRecruitingStore } from './server/localRecruitingStore.js'
import { parseRecruitingExportType } from './server/recruitingExport.ts'
import { housingApiPayloadForRoute } from './server/housingApi.ts'
import {
  handleSpeakerOpsRequest,
  type SpeakerOpsIdentityVerifier,
} from './server/speakerOpsService.ts'

const store = createLocalRecruitingStore()
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

const bookingStatusCode = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === 'SLOT_TAKEN' || code === 'ALREADY_BOOKED' || code === 'NO_INTERVIEWER_COVERAGE') return 409
  if (code === 'INVALID_SLOT') return 400
  return 500
}

const devApiPlugin = () => ({
  name: 'ublda-dev-api',
  configureServer(server: import('vite').ViteDevServer) {
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

    server.middlewares.use('/api/applicant-account', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      sendJson(res, 410, {
        success: false,
        error: 'Applicant account authentication is retired. Public application and interview booking remain available.',
      })
    })

    server.middlewares.use('/api/apply', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readJsonBody(req)

      if (typeof body.website === 'string' && body.website.trim()) {
        sendJson(res, 200, { success: true })
        return
      }

      const result = validateApplicationPayload(body)

      if (!result.success) {
        sendJson(res, 400, { error: result.errors[0], errors: result.errors })
        return
      }

      const submission = buildApplicationSubmission(result.data, req.headers['user-agent'] || '')
      await store.saveApplication(submission)
      sendJson(res, 200, {
        success: true,
        status: submission.status,
        calendarEventCreated: false,
        localPreview: true,
      })
    })

    server.middlewares.use('/api/interviewer-availability', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readJsonBody(req)

      if (typeof body.website === 'string' && body.website.trim()) {
        sendJson(res, 200, { success: true })
        return
      }

      const result = validateInterviewerAvailabilityPayload(body)

      if (!result.success) {
        sendJson(res, 400, { error: result.errors[0], errors: result.errors })
        return
      }

      const submission = buildInterviewerAvailabilitySubmission(result.data, req.headers['user-agent'] || '')
      const saved = await store.saveInterviewerAvailability(submission)
      sendJson(res, 200, {
        success: true,
        availabilitySummary: submission.availabilitySummary,
        updatedExistingSubmission: saved.updatedExistingSubmission,
        localPreview: true,
      })
    })

    server.middlewares.use('/api/interview-assignment', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      sendJson(res, 401, {
        error: 'Legacy recruiting administration is retired. Use the leadership workspace.',
      })
    })

    server.middlewares.use('/api/interview-booking', async (req, res) => {
      if (req.method === 'GET') {
        const slots = await store.publicInterviewSlots()
        sendJson(res, 200, {
          success: true,
          timeZone: 'Eastern Time (ET, Ann Arbor)',
          slots,
          localPreview: true,
        })
        return
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readJsonBody(req)

      if (typeof body.website === 'string' && body.website.trim()) {
        sendJson(res, 200, { success: true })
        return
      }

      const result = validateInterviewBookingPayload(body)

      if (!result.success) {
        sendJson(res, 400, { error: result.errors[0], errors: result.errors })
        return
      }

      const emailLaunchError = bookingEmailLaunchError()
      if (emailLaunchError) {
        sendJson(res, 503, emailLaunchError)
        return
      }

      try {
        const submission = buildInterviewBookingSubmission(result.data, req.headers['user-agent'] || '')
        const booking = await store.bookInterviewSlot(submission)
        const email = await sendBookingConfirmationEmail({
          submission,
          slot: booking.slot,
          interviewers: booking.interviewers,
          candidate: booking.candidate,
        })

        sendJson(res, 200, {
          success: true,
          candidate: booking.candidate,
          slot: booking.slot,
          interviewers: booking.interviewers,
          email,
          localPreview: true,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not book that interview slot.'
        sendJson(res, bookingStatusCode(error), { success: false, error: message })
      }
    })

    server.middlewares.use('/api/resume', async (req, res) => {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const url = new URL(req.url || '/', 'http://localhost')
      const candidateEmail = (url.searchParams.get('candidate') || '').trim().toLowerCase()

      if (!candidateEmail) {
        sendJson(res, 400, { error: 'Candidate email is required.' })
        return
      }

      sendJson(res, 401, { error: 'Legacy recruiting administration is retired. Use the leadership workspace.' })
    })

    server.middlewares.use('/api/recruiting-export', async (req, res) => {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const url = new URL(req.url || '/', 'http://localhost')
      const exportType = parseRecruitingExportType((url.searchParams.get('type') || '').trim())

      if (!exportType) {
        sendJson(res, 400, { error: 'Choose a valid export type.' })
        return
      }

      sendJson(res, 401, { error: 'Legacy recruiting administration is retired. Use the leadership workspace.' })
    })

    server.middlewares.use('/api/dashboard-data', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      sendJson(res, 410, {
        success: false,
        error: 'Legacy dashboard authentication is retired. Use the leadership workspace.',
      })
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
