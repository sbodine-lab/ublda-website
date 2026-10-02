const clubPaths = new Set(['/', '/about', '/events', '/team', '/join', '/brand', '/links'])

/** Match React Router's public URLs without exposing the retired page shells. */
export function canonicalPublicPath(pathname: string): string {
  const candidate = pathname.replace(/\/+$/, '').toLowerCase() || '/'
  return clubPaths.has(candidate) || candidate === '/consulting' || candidate.startsWith('/consulting/') || candidate === '/advisory'
    ? candidate
    : pathname
}

export const isClubPath = (pathname: string) => clubPaths.has(pathname)
