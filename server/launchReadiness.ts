import { bookingEmailLaunchStatus } from './bookingEmail.ts'

export type LaunchReadinessCheck = {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

export type LaunchReadiness = {
  overall: 'pass' | 'warn' | 'fail'
  generatedAt: string
  checks: LaunchReadinessCheck[]
}

const overallStatus = (checks: LaunchReadinessCheck[]): LaunchReadiness['overall'] => {
  if (checks.some((check) => check.status === 'fail')) return 'fail'
  if (checks.some((check) => check.status === 'warn')) return 'warn'
  return 'pass'
}

export const buildLaunchReadiness = (): LaunchReadiness => {
  const email = bookingEmailLaunchStatus()
  const checks: LaunchReadinessCheck[] = [
    {
      id: 'recruiting-store',
      label: 'Recruiting store',
      status: process.env.BLOB_READ_WRITE_TOKEN ? 'pass' : 'warn',
      detail: process.env.BLOB_READ_WRITE_TOKEN
        ? 'Private Vercel Blob storage is configured for recruiting data and resumes.'
        : 'Using local preview storage. Add BLOB_READ_WRITE_TOKEN before production launch.',
    },
    {
      id: 'booking-email',
      label: 'Confirmation email',
      status: email.readyForLaunch ? 'pass' : email.required ? 'fail' : 'warn',
      detail: email.readyForLaunch
        ? `Resend sender is ready: ${email.from}.`
        : email.required
          ? `Required email config is missing: ${email.missing.join(', ') || 'email provider'}.`
          : 'Automated confirmation email is optional; manual follow-up is expected.',
    },
    {
      id: 'resume-storage',
      label: 'Resume uploads',
      status: process.env.BLOB_READ_WRITE_TOKEN ? 'pass' : 'warn',
      detail: process.env.BLOB_READ_WRITE_TOKEN
        ? 'Uploaded resumes are stored privately in Vercel Blob and served only to recruiting admins.'
        : 'Resume uploads work locally, but production should use private Vercel Blob.',
    },
  ]

  return {
    overall: overallStatus(checks),
    generatedAt: new Date().toISOString(),
    checks,
  }
}
