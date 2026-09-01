/* Shared contract for the Fall 2026 consulting application form.
   Used by src/pages/Apply.tsx (client) and api/apply.ts (server); the
   Convex mutation in convex/applications.ts re-checks the same caps. */

export const APPLY_TERM_LABEL = 'Fall 2026'
export const APPLY_OPENS_LABEL = 'Wednesday, September 9'
export const APPLY_DEADLINE_LABEL = 'Tuesday, September 22 at 11:59 PM ET'

/* The application opens the morning after BBA Meet the Clubs (Sep 8) so both
   tabling events feed the same window, and closes Tuesday Sep 22 at 11:59 PM ET (two weeks after BBA Meet the Clubs)
   with a small server-side grace period. Times below are UTC. */
export const APPLY_OPENS_AT_MS = Date.UTC(2026, 8, 9, 4, 0, 0) // Sep 9, 12:00 AM ET
export const APPLY_CLOSES_AT_MS = Date.UTC(2026, 8, 23, 8, 0, 0) // Sep 23, 4:00 AM ET

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
