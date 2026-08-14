export const FIXED_ADMIN_EMAILS = [
  'sbodine@umich.edu',
  'atchiang@umich.edu',
  'cooperry@umich.edu',
] as const

export type FixedAdminEmail = typeof FIXED_ADMIN_EMAILS[number]

export const normalizePolicyEmail = (email: string) => email.trim().toLowerCase()

export const isFixedAdminEmail = (email: string): email is FixedAdminEmail => (
  (FIXED_ADMIN_EMAILS as readonly string[]).includes(normalizePolicyEmail(email))
)

export const effectiveLeadershipRole = (
  storedRole: 'admin' | 'member',
  signedInEmail: string,
): 'admin' | 'member' => (
  storedRole === 'admin' && isFixedAdminEmail(signedInEmail) ? 'admin' : 'member'
)

export const canHoldAdminRole = (emails: readonly string[]) => {
  const normalized = [...new Set(emails.map(normalizePolicyEmail).filter(Boolean))]
  return normalized.length === 1 && isFixedAdminEmail(normalized[0]!)
}

export const memberAuthorityViolation = ({
  currentEmails,
  nextEmails,
  nextRole,
  nextStatus,
}: {
  currentEmails: readonly string[]
  nextEmails: readonly string[]
  nextRole: 'admin' | 'member'
  nextStatus: 'active' | 'inactive'
}): string | null => {
  const currentFixed = [...new Set(currentEmails.map(normalizePolicyEmail).filter(isFixedAdminEmail))].sort()
  const nextFixed = [...new Set(nextEmails.map(normalizePolicyEmail).filter(isFixedAdminEmail))].sort()
  const protectedIdentity = currentFixed.length > 0 || nextFixed.length > 0

  if (protectedIdentity && (nextRole !== 'admin' || nextStatus !== 'active')) {
    return 'Sam, Alexa, and Cooper must remain active administrators.'
  }
  if (currentFixed.length > 0 && currentFixed.join('|') !== nextFixed.join('|')) {
    return 'A fixed administrator identity cannot be removed or replaced.'
  }
  if (nextRole === 'admin' && !canHoldAdminRole(nextEmails)) {
    return 'Only the fixed Sam, Alexa, and Cooper email identities can hold administrator access.'
  }
  return null
}
