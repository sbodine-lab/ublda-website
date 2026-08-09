import type { InterviewBookingSubmission } from '../src/lib/interviewBooking.ts'
import type { InterviewSlot } from '../src/lib/interviews.ts'
import type { Candidate } from '../src/lib/memberData.ts'

export type BookingEmailDelivery = {
  sent: boolean
  provider: 'resend' | 'disabled'
  id?: string
  reason?: string
  code?: string
}

export type BookingEmailLaunchStatus = {
  required: boolean
  canAttemptSend: boolean
  readyForLaunch: boolean
  missing: string[]
  from: string
  replyTo: string
}

type BookingEmailInput = {
  submission: InterviewBookingSubmission
  slot: InterviewSlot
  interviewers: string[]
  candidate: Pick<Candidate, 'name' | 'email' | 'rolePreferences'>
}

type RecruitingFailureAlertInput = {
  workflow: string
  name: string
  email: string
  slotLabel?: string
  resumeFileName?: string
  resumeFileSize?: number
  errorCode?: string
  errorMessage: string
  submissionId?: string
}

type ResendResponse = {
  id?: string
  data?: {
    id?: string
  }
  error?: {
    name?: string
    message?: string
  } | string
  message?: string
}

const DEFAULT_EMAIL_FROM = 'UBLDA Interviews <interviews@ublda.org>'
const DEFAULT_REPLY_TO = 'sbodine@umich.edu'
const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails'

const envValue = (key: string) => process.env[key]?.trim() || ''

const isProduction = () => process.env.VERCEL_ENV === 'production'

export const bookingEmailRequired = () => (
  process.env.UBLDA_REQUIRE_BOOKING_EMAIL === 'true' || isProduction()
)

const domainVerified = () => process.env.UBLDA_EMAIL_DOMAIN_VERIFIED === 'true'

const emailFrom = () => envValue('UBLDA_EMAIL_FROM') || DEFAULT_EMAIL_FROM

const emailReplyTo = () => envValue('UBLDA_EMAIL_REPLY_TO') || DEFAULT_REPLY_TO

const emailBccList = () => (
  envValue('UBLDA_EMAIL_BCC')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
)

export const bookingEmailLaunchStatus = (): BookingEmailLaunchStatus => {
  const missing: string[] = []
  const apiKey = envValue('RESEND_API_KEY')
  const from = emailFrom()
  const replyTo = emailReplyTo()

  if (!apiKey) missing.push('RESEND_API_KEY')
  if (!from) missing.push('UBLDA_EMAIL_FROM')
  if (!domainVerified()) missing.push('UBLDA_EMAIL_DOMAIN_VERIFIED=true')

  return {
    required: bookingEmailRequired(),
    canAttemptSend: Boolean(apiKey && from),
    readyForLaunch: missing.length === 0,
    missing,
    from,
    replyTo,
  }
}

export const bookingEmailDisabledResult = (): BookingEmailDelivery => ({
  sent: false,
  provider: 'disabled',
  reason: 'Confirmation email provider is not configured for this environment.',
})

export const bookingEmailLaunchError = () => {
  const status = bookingEmailLaunchStatus()
  if (!status.required || status.readyForLaunch) return null

  return {
    error: 'Interview booking is temporarily closed because confirmation email is not launch-ready.',
    missing: status.missing,
  }
}

const escapeHtml = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
)

const roleLines = (preferences: string[]) => {
  const roles = preferences.slice(0, 3)
  return roles.map((role, index) => `${index + 1}. ${role}`)
}

const alertRecipients = () => {
  const bcc = emailBccList()
  return bcc.length ? bcc : [emailReplyTo()].filter(Boolean)
}

const buildEmailText = ({ candidate, slot, interviewers }: BookingEmailInput) => {
  const interviewerLine = interviewers.length
    ? `Interviewers: ${interviewers.join(', ')}`
    : 'Interviewers: UBLDA e-board'
  const roles = roleLines(candidate.rolePreferences)

  return [
    `Hi ${candidate.name.split(' ')[0] || candidate.name},`,
    '',
    `Your UBLDA interview is confirmed for ${slot.label}.`,
    'Location: Google Meet',
    interviewerLine,
    '',
    'Function preferences:',
    ...roles,
    '',
    'Interview structure:',
    `- Main conversation: ${roles[0]?.replace(/^1\. /, '') || 'your first-choice function'}`,
    '- Backup role check: short transferability questions for choices 2 and 3',
    '- Close: your questions and next steps',
    '',
    'If you need to reschedule, reply to this email as soon as possible.',
    '',
    'UBLDA',
  ].join('\n')
}

const buildEmailHtml = (input: BookingEmailInput) => {
  const roles = roleLines(input.candidate.rolePreferences)
  const interviewerLine = input.interviewers.length
    ? input.interviewers.join(', ')
    : 'UBLDA e-board'

  return `
    <div style="font-family: Arial, sans-serif; color: #172033; line-height: 1.5; max-width: 640px;">
      <p>Hi ${escapeHtml(input.candidate.name.split(' ')[0] || input.candidate.name)},</p>
      <p>Your UBLDA interview is confirmed.</p>
      <table style="border-collapse: collapse; margin: 20px 0; width: 100%;">
        <tr><td style="padding: 8px 0; color: #5f6b7a;">Time</td><td style="padding: 8px 0;"><strong>${escapeHtml(input.slot.label)}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #5f6b7a;">Location</td><td style="padding: 8px 0;">Google Meet</td></tr>
        <tr><td style="padding: 8px 0; color: #5f6b7a;">Interviewers</td><td style="padding: 8px 0;">${escapeHtml(interviewerLine)}</td></tr>
      </table>
      <p><strong>Function preferences</strong></p>
      <ol>
        ${roles.map((role) => `<li>${escapeHtml(role.replace(/^[0-9]+\. /, ''))}</li>`).join('')}
      </ol>
      <p><strong>Interview structure</strong></p>
      <ul>
        <li>Main conversation: ${escapeHtml(roles[0]?.replace(/^1\. /, '') || 'your first-choice function')}</li>
        <li>Backup role check: short transferability questions for choices 2 and 3</li>
        <li>Close: your questions and next steps</li>
      </ul>
      <p>If you need to reschedule, reply to this email as soon as possible.</p>
      <p>UBLDA</p>
    </div>
  `
}

const resendErrorMessage = (payload: ResendResponse | null, statusCode: number) => {
  if (typeof payload?.error === 'string') return payload.error
  if (payload?.error?.message) return payload.error.message
  if (payload?.message) return payload.message
  return `Resend returned ${statusCode}.`
}

export const sendBookingConfirmationEmail = async (input: BookingEmailInput): Promise<BookingEmailDelivery> => {
  const status = bookingEmailLaunchStatus()
  if (!status.canAttemptSend) {
    return bookingEmailDisabledResult()
  }

  const payload = {
    from: status.from,
    to: input.candidate.email,
    subject: `UBLDA interview confirmed: ${input.slot.label}`,
    html: buildEmailHtml(input),
    text: buildEmailText(input),
    reply_to: status.replyTo,
    ...(emailBccList().length ? { bcc: emailBccList() } : {}),
    tags: [
      { name: 'workflow', value: 'interview-booking' },
      { name: 'submission', value: input.submission.submissionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) },
    ],
  }

  try {
    const response = await fetch(RESEND_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${envValue('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `interview-booking/${input.submission.submissionId}`.slice(0, 256),
      },
      body: JSON.stringify(payload),
    })
    const responsePayload = await response.json().catch(() => null) as ResendResponse | null

    if (!response.ok) {
      return {
        sent: false,
        provider: 'resend',
        reason: resendErrorMessage(responsePayload, response.status),
        code: String(response.status),
      }
    }

    return {
      sent: true,
      provider: 'resend',
      id: responsePayload?.id || responsePayload?.data?.id,
    }
  } catch (error) {
    return {
      sent: false,
      provider: 'resend',
      reason: error instanceof Error ? error.message : 'Confirmation email could not be sent.',
    }
  }
}

export const sendRecruitingFailureAlertEmail = async (input: RecruitingFailureAlertInput): Promise<BookingEmailDelivery> => {
  const status = bookingEmailLaunchStatus()
  const recipients = alertRecipients()
  if (!status.canAttemptSend || recipients.length === 0) {
    return bookingEmailDisabledResult()
  }

  const details = [
    `Workflow: ${input.workflow}`,
    `Name: ${input.name || 'Unknown'}`,
    `Email: ${input.email || 'Unknown'}`,
    input.slotLabel ? `Slot: ${input.slotLabel}` : '',
    input.resumeFileName ? `Resume: ${input.resumeFileName} (${input.resumeFileSize || 0} bytes)` : '',
    input.errorCode ? `Error code: ${input.errorCode}` : '',
    `Error: ${input.errorMessage}`,
  ].filter(Boolean)
  const htmlDetails = details.map((line) => `<li>${escapeHtml(line)}</li>`).join('')
  const idempotencyKey = [
    'recruiting-failure',
    input.workflow,
    input.submissionId || input.email || Date.now(),
  ].join('/').replace(/[^a-zA-Z0-9/_-]/g, '_').slice(0, 256)

  try {
    const response = await fetch(RESEND_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${envValue('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: status.from,
        to: recipients,
        subject: `UBLDA recruiting submission needs recovery: ${input.workflow}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #172033; line-height: 1.5; max-width: 640px;">
            <p>A recruiting submission could not be saved. Follow up with the person below and ask them to resubmit their resume if needed.</p>
            <ul>${htmlDetails}</ul>
          </div>
        `,
        text: [
          'A recruiting submission could not be saved. Follow up with the person below and ask them to resubmit their resume if needed.',
          '',
          ...details,
        ].join('\n'),
        reply_to: status.replyTo,
        tags: [
          { name: 'workflow', value: 'recruiting-failure' },
          { name: 'source', value: input.workflow.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) },
        ],
      }),
    })
    const responsePayload = await response.json().catch(() => null) as ResendResponse | null

    if (!response.ok) {
      return {
        sent: false,
        provider: 'resend',
        reason: resendErrorMessage(responsePayload, response.status),
        code: String(response.status),
      }
    }

    return {
      sent: true,
      provider: 'resend',
      id: responsePayload?.id || responsePayload?.data?.id,
    }
  } catch (error) {
    return {
      sent: false,
      provider: 'resend',
      reason: error instanceof Error ? error.message : 'Recovery alert email could not be sent.',
    }
  }
}
