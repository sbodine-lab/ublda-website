import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import type { VercelRequest, VercelResponse } from '../server/types.ts'
import {
  acceptsHoneypot,
  bodyRecord,
  getString,
  methodNotAllowed,
  setApiSecurityHeaders,
} from '../server/apiUtils.ts'
import { postJsonWithTimeout } from '../server/googleScript.ts'
import {
  APPLY_LIMITS,
  APPLY_ROLE_OPTIONS,
  APPLY_YEARS,
  applyWindow,
  emailFormatOk,
  isUmichEmail,
  resumeUrlOk,
  type ApplyPayload,
  type ApplyRoleInterest,
} from '../src/lib/applyForm.ts'

const submitReference = makeFunctionReference<
  'mutation',
  ApplyPayload,
  { ok: boolean; resubmission: boolean }
>('applications:submit')

const roleValues = new Set<string>(APPLY_ROLE_OPTIONS.map((option) => option.value))
const yearValues = new Set<string>(APPLY_YEARS)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setApiSecurityHeaders(res)

  if (req.method !== 'POST') {
    return methodNotAllowed(res)
  }

  // Bots that fill every field trip the honeypot; answer as if it worked.
  if (acceptsHoneypot(req.body)) {
    return res.status(200).json({ success: true })
  }

  const window = applyWindow(Date.now())
  if (window === 'before') {
    return res.status(400).json({ error: 'Applications open September 9.' })
  }
  if (window === 'closed') {
    return res.status(400).json({ error: 'Applications closed September 22. Email sbodine@umich.edu about late submissions.' })
  }

  const body = bodyRecord(req.body)
  const fullName = getString(body, 'fullName')
  const email = getString(body, 'email').toLowerCase()
  const year = getString(body, 'year')
  const schoolMajor = getString(body, 'schoolMajor')
  const roleInterest = getString(body, 'roleInterest')
  const whyJoin = getString(body, 'whyJoin')
  const experience = getString(body, 'experience')
  const resumeUrl = getString(body, 'resumeUrl', { stripMarkup: false })
  const accommodations = getString(body, 'accommodations')
  const availabilityConfirmed = body.availabilityConfirmed === true

  if (!fullName || !email || !year || !schoolMajor || !whyJoin || !experience) {
    return res.status(400).json({ error: 'Please fill in every required field.' })
  }
  if (fullName.length > APPLY_LIMITS.name || schoolMajor.length > APPLY_LIMITS.schoolMajor) {
    return res.status(400).json({ error: 'One or more fields is too long.' })
  }
  if (!emailFormatOk(email) || email.length > APPLY_LIMITS.email) {
    return res.status(400).json({ error: 'Please use a valid email address.' })
  }
  if (!isUmichEmail(email)) {
    return res.status(400).json({ error: 'Please apply with your @umich.edu email.' })
  }
  if (!yearValues.has(year)) {
    return res.status(400).json({ error: 'Please choose your year.' })
  }
  if (!roleValues.has(roleInterest)) {
    return res.status(400).json({ error: 'Please choose a role option.' })
  }
  if (whyJoin.length > APPLY_LIMITS.essay || experience.length > APPLY_LIMITS.essay) {
    return res.status(400).json({ error: 'Please keep each answer to about 150 words.' })
  }
  if (resumeUrl && (resumeUrl.length > APPLY_LIMITS.resumeUrl || !resumeUrlOk(resumeUrl))) {
    return res.status(400).json({ error: 'The resume link should be a full http(s) URL.' })
  }
  if (accommodations.length > APPLY_LIMITS.accommodations) {
    return res.status(400).json({ error: 'The accommodations note is too long.' })
  }
  if (!availabilityConfirmed) {
    return res.status(400).json({ error: 'Please confirm your interview and weekly availability.' })
  }

  const convexUrl = process.env.CONVEX_URL?.trim() || process.env.VITE_CONVEX_URL?.trim()
  if (!convexUrl) {
    return res.status(500).json({ error: 'Form backend not configured' })
  }

  const client = new ConvexHttpClient(convexUrl, { logger: false })

  try {
    const result = await client.mutation(submitReference, {
      fullName,
      email,
      year,
      schoolMajor,
      roleInterest: roleInterest as ApplyRoleInterest,
      whyJoin,
      experience,
      resumeUrl: resumeUrl || undefined,
      availabilityConfirmed,
      accommodations: accommodations || undefined,
    })
    // Every applicant is also enrolled as a general member (one form covers both).
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL
    if (scriptUrl) {
      const [firstName, ...restName] = fullName.split(/\s+/)
      try {
        await postJsonWithTimeout(scriptUrl, {
          formType: 'generalMember',
          firstName,
          lastName: restName.join(' ') || firstName,
          uniqname: email.replace(/@umich\.edu$/i, ''),
          year,
          college: schoolMajor,
        }, 'Member enrollment failed')
      } catch {
        // Best-effort: a member-list hiccup must not fail the application.
      }
    }
    return res.status(200).json({ success: true, resubmission: result.resubmission })
  } catch (error) {
    if (error instanceof ConvexError) {
      const data = error.data as { message?: string } | string | undefined
      const message = typeof data === 'string' ? data : data?.message
      return res.status(400).json({ error: message || 'Your application could not be submitted.' })
    }
    return res.status(500).json({ error: 'Failed to submit. Please try again or email sbodine@umich.edu.' })
  }
}
