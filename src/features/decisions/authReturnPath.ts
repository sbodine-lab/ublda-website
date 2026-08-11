const RETURN_TO_KEY = 'ublda-leadership-return-to'

const isSafeInternalPath = (value: string) => value.startsWith('/') && !value.startsWith('//')

export function rememberLeadershipReturnTo(path: string) {
  if (isSafeInternalPath(path)) sessionStorage.setItem(RETURN_TO_KEY, path)
}

export function takeLeadershipReturnTo() {
  const path = sessionStorage.getItem(RETURN_TO_KEY) || ''
  sessionStorage.removeItem(RETURN_TO_KEY)
  return isSafeInternalPath(path) ? path : '/workspace'
}
