import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { validateApplicantAccountPayload } from './src/lib/applicantAccount.ts'
import { buildApplicationSubmission, validateApplicationPayload } from './src/lib/application.ts'
import { buildInterviewAssignmentSubmission, validateInterviewAssignmentPayload } from './src/lib/interviewAssignment.ts'
import { buildInterviewerAvailabilitySubmission, validateInterviewerAvailabilityPayload } from './src/lib/interviewerAvailability.ts'
import { createLocalRecruitingStore } from './server/localRecruitingStore.ts'

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
  res.end(JSON.stringify(payload))
}

const devApiPlugin = () => ({
  name: 'ublda-dev-api',
  configureServer(server: import('vite').ViteDevServer) {
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
        const session = await store.upsertAccount({
          firstName: profile?.firstName || 'Preview',
          lastName: profile?.lastName || 'Member',
          uniqname,
          email: fallbackEmail,
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

      const session = await store.upsertAccount(result.data.account, result.data.password)
      sendJson(res, 200, { success: true, ...session })
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

    server.middlewares.use('/api/dashboard-data', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readJsonBody(req)
      const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken.trim() : ''
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
  plugins: [react(), devApiPlugin()],
})
