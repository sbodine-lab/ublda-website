const RETURN_TO_KEY = 'ublda-leadership-return-to'

const EXACT_LEADERSHIP_PATHS = new Set([
  '/workspace',
  '/calendar',
  '/projects',
  '/people',
  '/leadership/speakers',
  '/speaker-ops',
  '/operations',
  '/decision',
  '/decisions',
  '/results',
  '/scheduling',
  '/schedule',
])

const LEADERSHIP_PATH_PREFIXES = ['/d/', '/decisions/', '/scheduling/', '/s/']

export type LeadershipReturnPathStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

const browserSessionStorage = (): LeadershipReturnPathStorage | undefined => {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

export function safeLeadershipReturnPath(value: string): string | null {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const parsed = new URL(value, 'https://ublda.local')
    if (parsed.origin !== 'https://ublda.local' || parsed.username || parsed.password) return null
    const allowed = EXACT_LEADERSHIP_PATHS.has(parsed.pathname)
      || LEADERSHIP_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))
    return allowed ? `${parsed.pathname}${parsed.search}` : null
  } catch {
    return null
  }
}

export function rememberLeadershipReturnTo(
  path: string,
  storage = browserSessionStorage(),
) {
  const safePath = safeLeadershipReturnPath(path)
  if (!safePath || !storage) return
  try {
    storage.setItem(RETURN_TO_KEY, safePath)
  } catch {
    // Private browsing and storage policy failures must not block sign-in.
  }
}

export function takeLeadershipReturnTo(storage = browserSessionStorage()) {
  if (!storage) return '/workspace'
  let path = ''
  try {
    path = storage.getItem(RETURN_TO_KEY) || ''
  } catch {
    return '/workspace'
  } finally {
    try {
      storage.removeItem(RETURN_TO_KEY)
    } catch {
      // The callback still has a safe fallback when cleanup is blocked.
    }
  }
  return safeLeadershipReturnPath(path) ?? '/workspace'
}
