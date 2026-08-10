import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { validateApplicantAccountPayload } from './src/lib/applicantAccount.ts'
import { buildApplicationSubmission, validateApplicationPayload } from './src/lib/application.ts'
import { buildInterviewAssignmentSubmission, validateInterviewAssignmentPayload } from './src/lib/interviewAssignment.ts'
import { buildInterviewBookingSubmission, validateInterviewBookingPayload } from './src/lib/interviewBooking.ts'
import { buildInterviewerAvailabilitySubmission, validateInterviewerAvailabilityPayload } from './src/lib/interviewerAvailability.ts'
import { bookingEmailLaunchError, sendBookingConfirmationEmail } from './server/bookingEmail.ts'
import { createLocalRecruitingStore } from './server/localRecruitingStore.js'
import { buildRecruitingExport, parseRecruitingExportType } from './server/recruitingExport.ts'
import { housingApiPayloadForRoute } from './server/housingApi.ts'

const store = createLocalRecruitingStore()

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

      const body = await readJsonBody(req)
      const result = validateApplicantAccountPayload(body)

      if (!result.success) {
        sendJson(res, 400, { error: result.errors[0], errors: result.errors })
        return
      }

      if (result.data.action === 'session') {
        const session = await store.restoreSession(result.data.sessionToken)

        if (!session) {
          sendJson(res, 401, { success: false, error: 'Local preview session expired. Sign in again.' })
          return
        }

        sendJson(res, 200, { success: true, ...session })
        return
      }

      if (result.data.action === 'requestMagicLink') {
        const session = await store.restoreSession('local-preview-session-token')
        sendJson(res, 200, {
          success: true,
          magicLinkSent: Boolean(session),
          ...(session || {}),
        })
        return
      }

      if (result.data.action === 'googleSignIn') {
        const profile = result.data.profile
        const fallbackEmail = profile?.email || 'preview.member@umich.edu'
        const uniqname = fallbackEmail.replace(/@.*$/, '')
        // Mirror the production handler: Google is a verified provider, so an officer's
        // account resolves to their roster role. Without this, dev can never reach /dashboard.
        const session = await store.upsertAccount({
          firstName: profile?.firstName || 'Preview',
          lastName: profile?.lastName || 'Member',
          uniqname,
          email: fallbackEmail,
          verifiedVia: 'google',
        })

        sendJson(res, 200, { success: true, ...session, localPreview: true })
        return
      }

      if (result.data.action === 'signIn') {
        const session = await store.signIn(result.data.email, result.data.password)

        if (!session) {
          sendJson(res, 401, { success: false, error: 'Invalid uniqname or password.' })
          return
        }

        sendJson(res, 200, { success: true, ...session })
        return
      }

      if (result.data.action === 'logout') {
        await store.deleteSession(result.data.sessionToken)
        sendJson(res, 200, { success: true })
        return
      }

      if (result.data.action === 'create') {
        const session = await store.upsertAccount(result.data.account, result.data.password)
        sendJson(res, 200, { success: true, ...session })
        return
      }

      sendJson(res, 400, { error: 'Applicant account action is invalid.' })
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

      const body = await readJsonBody(req)
      const result = validateInterviewAssignmentPayload(body)

      if (!result.success) {
        sendJson(res, 400, { error: result.errors[0], errors: result.errors })
        return
      }

      const submission = buildInterviewAssignmentSubmission(result.data, req.headers['user-agent'] || '')
      const saved = await store.saveInterviewAssignment(submission)
      sendJson(res, 200, {
        success: true,
        updatedCandidate: saved.updatedCandidate,
        localPreview: true,
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
      const sessionToken = (url.searchParams.get('sessionToken') || '').trim()

      if (!candidateEmail) {
        sendJson(res, 400, { error: 'Candidate email is required.' })
        return
      }

      if (sessionToken !== 'local-preview-session-token') {
        const dashboard = await store.dashboardData(sessionToken)
        if (dashboard?.role !== 'super-admin' && dashboard?.role !== 'exec') {
          sendJson(res, 401, { error: 'A recruiting admin session is required.' })
          return
        }
      }

      const resume = await store.readCandidateResume(candidateEmail)
      if (!resume) {
        sendJson(res, 404, { error: 'Resume was not found.' })
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', resume.mimeType || 'application/octet-stream')
      res.setHeader('Content-Disposition', `inline; filename="${resume.fileName.replace(/["\r\n]/g, '') || 'resume.pdf'}"`)
      res.setHeader('Content-Length', String(resume.content.length))
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      res.end(resume.content)
    })

    server.middlewares.use('/api/recruiting-export', async (req, res) => {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const url = new URL(req.url || '/', 'http://localhost')
      const sessionToken = (url.searchParams.get('sessionToken') || '').trim()
      const exportType = parseRecruitingExportType((url.searchParams.get('type') || '').trim())

      if (!exportType) {
        sendJson(res, 400, { error: 'Choose a valid export type.' })
        return
      }

      if (sessionToken !== 'local-preview-session-token') {
        const dashboard = await store.dashboardData(sessionToken)
        if (dashboard?.role !== 'super-admin' && dashboard?.role !== 'exec') {
          sendJson(res, 401, { error: 'A recruiting admin session is required.' })
          return
        }
      }

      const csv = buildRecruitingExport(exportType, await store.leadershipDashboardData())
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${csv.fileName}"`)
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      res.end(csv.content)
    })

    server.middlewares.use('/api/dashboard-data', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readJsonBody(req)
      const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim() : ''
      if (sessionToken === 'local-preview-session-token') {
        sendJson(res, 200, {
          success: true,
          dashboardData: await store.leadershipDashboardData(),
          localPreview: true,
        })
        return
      }

      const dashboard = await store.dashboardData(sessionToken)

      if (!dashboard) {
        sendJson(res, 401, { error: 'A valid local preview member session is required.' })
        return
      }

      sendJson(res, 200, { success: true, ...dashboard })
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
