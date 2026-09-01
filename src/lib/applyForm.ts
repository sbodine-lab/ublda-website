/* Shared contract for the Fall 2026 consulting application form.
   Used by src/pages/Apply.tsx (client) and api/apply.ts (server); the
   Convex mutation in convex/applications.ts re-checks the same caps. */

export const APPLY_TERM_LABEL = 'Fall 2026'
export const APPLY_OPENS_LABEL = 'Wednesday, September 2 at 12:00 PM ET'
export const APPLY_DEADLINE_LABEL = 'Sunday, September 20 at 11:30 PM ET'

/* The application and membership sign-up both open Wednesday Sep 2 at 12 PM ET
   (ahead of Festifall that afternoon), and the application closes Sunday Sep 20
   at 11:30 PM ET with a small server-side grace period. Times below are UTC. */
export const APPLY_OPENS_AT_MS = Date.UTC(2026, 8, 2, 16, 0, 0) // Sep 2, 12:00 PM ET
export const APPLY_CLOSES_AT_MS = Date.UTC(2026, 8, 21, 3, 59, 0) // Sep 20, 11:59 PM ET (grace past the 11:30 label)

/* Membership (the /join form) opens at the same moment as the application. */
export const MEMBERSHIP_OPENS_AT_MS = APPLY_OPENS_AT_MS
export const MEMBERSHIP_OPENS_LABEL = 'Wednesday, September 2 at 12:00 PM ET'

export type ApplyWindow = 'before' | 'open' | 'closed'

export const applyWindow = (now: number): ApplyWindow => (
  now < APPLY_OPENS_AT_MS ? 'before' : now < APPLY_CLOSES_AT_MS ? 'open' : 'closed'
)

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
