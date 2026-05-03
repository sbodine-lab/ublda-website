import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { validateApplicantAccountPayload } from './src/lib/applicantAccount.ts'
import { buildApplicationSubmission, validateApplicationPayload } from './src/lib/application.ts'

type DevAccount = {
  firstName: string
  lastName: string
  uniqname: string
  email: string
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
            firstName: account.firstName,
            lastName: account.lastName,
            uniqname: account.uniqname,
            email: account.email,
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
          account: {
            firstName: account.firstName,
            lastName: account.lastName,
            uniqname: account.uniqname,
            email: account.email,
          },
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
          account: {
            firstName: account.firstName,
            lastName: account.lastName,
            uniqname: account.uniqname,
            email: account.email,
          },
          application: account.application,
          localPreview: true,
        })
        return
      }

      const sessionToken = createDevSessionToken()
      const account: DevAccount = {
        ...result.data.account,
        sessionToken,
        application: devAccounts.get(result.data.account.email)?.application || null,
      }
      devAccounts.set(account.email, account)
      devSessions.set(sessionToken, account.email)

      sendJson(res, 200, {
        success: true,
        sessionToken,
        account: {
          firstName: account.firstName,
          lastName: account.lastName,
          uniqname: account.uniqname,
          email: account.email,
        },
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

      if (account) {
        account.application = {
          status: submission.status,
          interviewSlot: submission.interviewSlot.label,
          resumeUrl: `local-preview://${submission.resumeFile.name}`,
          updatedAt: submission.submittedAt,
          submissionCount: (account.application?.submissionCount || 0) + 1,
        }
      }

      sendJson(res, 200, {
        success: true,
        status: submission.status,
        calendarEventCreated: submission.status !== 'Future role pool',
        localPreview: true,
      })
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApiPlugin()],
})
