import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { validateApplicantAccountPayload } from './src/lib/applicantAccount.ts'
import { buildApplicationSubmission, validateApplicationPayload } from './src/lib/application.ts'
import { adminAccountForEmail, ADMIN_ACCOUNTS, roleForEmail } from './src/lib/dashboardAccess.ts'
import { buildInterviewAssignmentSubmission, validateInterviewAssignmentPayload } from './src/lib/interviewAssignment.ts'
import { buildInterviewerAvailabilitySubmission, validateInterviewerAvailabilityPayload } from './src/lib/interviewerAvailability.ts'
import type { Candidate, InterviewerAvailability, MemberSignup } from './src/lib/memberData.ts'

type DevAccount = {
  firstName: string
  lastName: string
  uniqname: string
  email: string
  password?: string
  sessionToken: string
  application: {
    status: string
    interviewSlot: string
    resumeUrl: string
    updatedAt: string
    submissionCount: number
  } | null
}

const devAccounts = new Map<string, DevAccount>()
const devSessions = new Map<string, string>()
const devCandidates = new Map<string, Candidate>()
const devInterviewerAvailability = new Map<string, InterviewerAvailability>()

const readJsonBody = (req: IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        resolve({})
      }
    })
  })

const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const createDevSessionToken = () => `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`

const publicAccount = (account: DevAccount) => ({
  firstName: account.firstName,
  lastName: account.lastName,
  uniqname: account.uniqname,
  email: account.email,
})

const memberSignupsFromDevAccounts = (): MemberSignup[] => (
  Array.from(devAccounts.values()).map((account) => ({
    id: account.email,
    name: `${account.firstName} ${account.lastName}`.trim() || account.email,
    email: account.email,
    uniqname: account.uniqname,
    status: account.application?.status || 'Local preview account',
    source: 'Local preview accounts',
    updatedAt: account.application?.updatedAt || '',
    detail: account.application ? `Submissions: ${account.application.submissionCount}` : '',
  }))
)

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
        const email = devSessions.get(result.data.sessionToken)
        const account = email ? devAccounts.get(email) : null

        if (!account) {
          sendJson(res, 400, { success: false, error: 'Applicant session not found in local preview.' })
          return
        }

        sendJson(res, 200, {
          success: true,
          account: {
            ...publicAccount(account),
          },
          application: account.application,
        })
        return
      }

      if (result.data.action === 'requestMagicLink') {
        const account = devAccounts.get(result.data.email)

        if (!account) {
          sendJson(res, 400, { success: false, error: 'No local preview account found for that uniqname yet. Create an account first.' })
          return
        }

        sendJson(res, 200, {
          success: true,
          magicLinkSent: true,
          account: publicAccount(account),
          sessionToken: account.sessionToken,
          application: account.application,
        })
        return
      }

      if (result.data.action === 'googleSignIn') {
        const profile = result.data.profile
        const fallbackEmail = profile?.email || 'preview.member@umich.edu'
        const uniqname = fallbackEmail.replace(/@.*$/, '')
        const existingAccount = devAccounts.get(fallbackEmail)
        const sessionToken = existingAccount?.sessionToken || createDevSessionToken()
        const account: DevAccount = {
          firstName: profile?.firstName || existingAccount?.firstName || 'Preview',
          lastName: profile?.lastName || existingAccount?.lastName || 'Member',
          uniqname,
          email: fallbackEmail,
          sessionToken,
          application: existingAccount?.application || null,
        }

        devAccounts.set(account.email, account)
        devSessions.set(sessionToken, account.email)

        sendJson(res, 200, {
          success: true,
          sessionToken,
          account: publicAccount(account),
          application: account.application,
          localPreview: true,
        })
        return
      }

      if (result.data.action === 'signIn') {
        const account = devAccounts.get(result.data.email)

        if (!account || account.password !== result.data.password) {
          sendJson(res, 401, { success: false, error: 'Invalid uniqname or password.' })
          return
        }

        sendJson(res, 200, {
          success: true,
          sessionToken: account.sessionToken,
          account: publicAccount(account),
          application: account.application,
        })
        return
      }

      const sessionToken = createDevSessionToken()
      const account: DevAccount = {
        ...result.data.account,
        password: result.data.password,
        sessionToken,
        application: devAccounts.get(result.data.account.email)?.application || null,
      }
      devAccounts.set(account.email, account)
      devSessions.set(sessionToken, account.email)

      sendJson(res, 200, {
        success: true,
        sessionToken,
        account: publicAccount(account),
        application: account.application,
      })
    })

    server.middlewares.use('/api/apply', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readJsonBody(req)
      const result = validateApplicationPayload(body)

      if (!result.success) {
        sendJson(res, 400, { error: result.errors[0], errors: result.errors })
        return
      }

      const submission = buildApplicationSubmission(result.data, req.headers['user-agent'] || '')
      const account = devAccounts.get(submission.email)
      const existingCandidate = devCandidates.get(submission.email)

      if (account) {
        account.application = {
          status: submission.status,
          interviewSlot: submission.interviewSlot.label,
          resumeUrl: `local-preview://${submission.resumeFile.name}`,
          updatedAt: submission.submittedAt,
          submissionCount: (account.application?.submissionCount || 0) + 1,
        }
      }
      devCandidates.set(submission.email, {
        id: submission.uniqname,
        name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
        program: [submission.college, submission.year].filter(Boolean).join(' · '),
        email: submission.email,
        rolePreferences: submission.rolePreferences,
        status: existingCandidate?.status || (submission.status === 'Future role pool' ? 'Hold' : 'Needs match'),
        availability: submission.availability.map((slot) => slot.value),
        resumeUrl: `local-preview://${submission.resumeFile.name}`,
        assignedSlot: existingCandidate?.assignedSlot || '',
        interviewers: existingCandidate?.interviewers || [],
        feedback: existingCandidate?.feedback || '',
      })

      sendJson(res, 200, {
        success: true,
        status: submission.status,
        calendarEventCreated: submission.status !== 'Future role pool',
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
      const admin = adminAccountForEmail(submission.email)
      const updatedExistingSubmission = devInterviewerAvailability.has(submission.email)
      devInterviewerAvailability.set(submission.email, {
        name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
        role: admin?.title || 'E-board',
        availability: submission.availability.map((slot) => slot.value),
        maxInterviews: submission.maxInterviews || 'As needed',
      })

      sendJson(res, 200, {
        success: true,
        availabilitySummary: submission.availabilitySummary,
        updatedExistingSubmission,
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
      const candidate = devCandidates.get(submission.email)

      if (candidate) {
        candidate.assignedSlot = submission.assignedSlot?.value || ''
        candidate.interviewers = submission.interviewers
        candidate.status = submission.interviewStatus
        candidate.feedback = submission.feedback
      }

      sendJson(res, 200, {
        success: true,
        updatedCandidate: Boolean(candidate),
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
      const email = sessionToken ? devSessions.get(sessionToken) : ''
      const account = email ? devAccounts.get(email) : null

      if (!account) {
        sendJson(res, 401, { error: 'A valid local preview member session is required.' })
        return
      }

      const role = roleForEmail(account.email)
      const dashboardData = {
        backendStatus: {
          source: 'preview',
          message: 'Loaded from the local preview backend. Submissions reset when the dev server restarts.',
          updatedAt: new Date().toISOString(),
        },
        ...(role === 'super-admin' || role === 'exec' ? {
          candidates: Array.from(devCandidates.values()),
          interviewerAvailability: Array.from(devInterviewerAvailability.values()),
          memberSignups: memberSignupsFromDevAccounts(),
          adminAccounts: ADMIN_ACCOUNTS,
        } : {
          memberSignups: memberSignupsFromDevAccounts().filter((member) => member.email === account.email),
        }),
      }

      sendJson(res, 200, {
        success: true,
        account: publicAccount(account),
        role,
        dashboardData,
      })
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApiPlugin()],
})
