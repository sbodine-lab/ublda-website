/* Shared contract for the Fall 2026 consulting application form.
   Used by src/pages/Apply.tsx (client) and api/apply.ts (server); the
   Convex mutation in convex/applications.ts re-checks the same caps. */

export const APPLY_TERM_LABEL = 'Fall 2026'
export const APPLY_DEADLINE_LABEL = 'Sunday, September 13 at 11:59 PM ET'

export const APPLY_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior'] as const

export const APPLY_ROLE_OPTIONS = [
  {
    value: 'analyst',
    label: 'Analyst',
    detail: 'Client work on the Fall 2026 project team.',
  },
  {
    value: 'analyst_future_pm',
    label: 'Analyst, interested in future PM roles',
    detail: 'Same analyst seat now, with interest in leading a project down the road.',
  },
] as const

export type ApplyRoleInterest = (typeof APPLY_ROLE_OPTIONS)[number]['value']

export const APPLY_LIMITS = {
  name: 120,
  email: 254,
  schoolMajor: 160,
  essay: 1200, // ~150-180 words of typed text
  resumeUrl: 600,
  accommodations: 2000,
} as const

export const APPLY_ESSAY_WORD_TARGET = 150

export const emailFormatOk = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export const isUmichEmail = (email: string) => /@umich\.edu$/i.test(email.trim())

export const resumeUrlOk = (url: string) => /^https?:\/\/\S+$/i.test(url.trim())

export const countWords = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0

export type ApplyPayload = {
  fullName: string
  email: string
  year: string
  schoolMajor: string
  roleInterest: ApplyRoleInterest
  whyJoin: string
  experience: string
  resumeUrl?: string
  availabilityConfirmed: boolean
  accommodations?: string
}
