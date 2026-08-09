type ScriptJson = Record<string, unknown>

export const shouldMirrorToLegacyScript = () => (
  process.env.UBLDA_RECRUITING_WRITE_MODE === 'legacy-script'
)

export const postRawJsonWithTimeout = async (
  url: string,
  body: ScriptJson,
  timeoutMs = 8000,
) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null) as ScriptJson | null

    return {
      response,
      payload,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export const postJsonWithTimeout = async (
  url: string,
  body: ScriptJson,
  fallbackError: string,
  timeoutMs = 8000,
) => {
  const result = await postRawJsonWithTimeout(url, body, timeoutMs)

  if (!result.response.ok || result.payload?.success === false) {
    throw new Error(String(result.payload?.error || fallbackError))
  }

  return result
}

export const postGoogleScript = async (
  body: ScriptJson,
  fallbackError: string,
) => {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) return null
  return postJsonWithTimeout(scriptUrl, body, fallbackError)
}
