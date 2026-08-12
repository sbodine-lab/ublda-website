import {
  SignJWT,
  createRemoteJWKSet,
  exportJWK,
  importPKCS8,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from 'jose'

const CONVEX_TOKEN_TTL_SECONDS = 5 * 60
const LOGTO_CLOCK_TOLERANCE_SECONDS = 10
const LOGTO_MAX_TOKEN_AGE_SECONDS = 2 * 60 * 60
const LOGTO_JWKS_TIMEOUT_MS = 5_000
const LOGTO_JWKS_COOLDOWN_MS = 30_000
const LOGTO_JWKS_CACHE_MAX_AGE_MS = 10 * 60 * 1_000
const MAX_CONVEX_PUBLIC_KEYS = 3
const acceptedLogtoAlgorithms = ['ES384', 'RS256'] as const

type Environment = Record<string, string | undefined>

export type AuthBridgeConfig = {
  logtoIssuer: string
  logtoAppId: string
  logtoJwksUrl: string
  bridgeIssuer: string
  bridgeAppId: string
  signingPrivateKey: string
  publicJwks: JSONWebKeySet
  allowedOrigins: Set<string>
}

export type VerifiedLogtoIdentity = {
  subject: string
  email: string
  emailVerified: true
  name?: string
  picture?: string
}

export class AuthBridgeTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthBridgeTokenError'
  }
}

const required = (environment: Environment, name: string) => {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`Missing ${name}.`)
  return value
}

const privateJwkParameters = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'] as const

const parsePublicJwks = (raw: string): JSONWebKeySet => {
  const parsed = JSON.parse(raw) as JSONWebKeySet
  const keys = Array.isArray(parsed.keys) ? parsed.keys : []
  if (keys.length < 1 || keys.length > MAX_CONVEX_PUBLIC_KEYS) {
    throw new Error(`CONVEX_AUTH_PUBLIC_JWKS must contain 1-${MAX_CONVEX_PUBLIC_KEYS} public RS256 signing keys.`)
  }

  const publicKeys = keys.map((key) => {
    const valid = key?.kty === 'RSA'
      && key?.alg === 'RS256'
      && key?.use === 'sig'
      && typeof key?.kid === 'string'
      && Boolean(key.kid.trim())
      && typeof key?.n === 'string'
      && Boolean(key.n)
      && typeof key?.e === 'string'
      && Boolean(key.e)
      && privateJwkParameters.every((parameter) => !(parameter in key))
    if (!valid) {
      throw new Error('CONVEX_AUTH_PUBLIC_JWKS contains an invalid or private signing key.')
    }

    return {
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: String(key.kid).trim(),
      n: String(key.n),
      e: String(key.e),
    }
  })
  if (new Set(publicKeys.map(({ kid }) => kid)).size !== publicKeys.length) {
    throw new Error('CONVEX_AUTH_PUBLIC_JWKS signing key IDs must be unique.')
  }

  // Only publish the public RSA fields Convex needs. This prevents a harmless
  // metadata addition (or, more importantly, private key material) from being
  // reflected by the public JWKS endpoint.
  return { keys: publicKeys }
}

const normalizedAllowedOrigin = (raw: string): string => {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error('CONVEX_AUTH_ALLOWED_ORIGINS contains an invalid origin.')
  }

  const localHttp = url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !localHttp)
    || url.username
    || url.password
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search
    || url.hash
  ) {
    throw new Error('CONVEX_AUTH_ALLOWED_ORIGINS must contain exact HTTPS origins.')
  }
  return url.origin
}

export const authBridgeConfig = (
  environment: Environment = process.env,
): AuthBridgeConfig => {
  const logtoIssuer = required(environment, 'LOGTO_ISSUER').replace(/\/$/, '')
  return {
    logtoIssuer,
    logtoAppId: required(environment, 'LOGTO_APP_ID'),
    logtoJwksUrl: `${logtoIssuer}/jwks`,
    bridgeIssuer: required(environment, 'CONVEX_AUTH_ISSUER').replace(/\/$/, ''),
    bridgeAppId: required(environment, 'CONVEX_AUTH_APP_ID'),
    signingPrivateKey: required(environment, 'CONVEX_AUTH_SIGNING_PRIVATE_KEY'),
    publicJwks: parsePublicJwks(required(environment, 'CONVEX_AUTH_PUBLIC_JWKS')),
    allowedOrigins: new Set(
      required(environment, 'CONVEX_AUTH_ALLOWED_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map(normalizedAllowedOrigin),
    ),
  }
}

const stringClaim = (payload: JWTPayload, name: string) => {
  const value = payload[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export const verifiedLogtoIdentity = (payload: JWTPayload): VerifiedLogtoIdentity => {
  const subject = stringClaim(payload, 'sub')
  const email = stringClaim(payload, 'email')?.toLowerCase()
  if (!subject || !email || payload.email_verified !== true) {
    throw new AuthBridgeTokenError('The Logto identity must contain a verified email address.')
  }

  return {
    subject,
    email,
    emailVerified: true,
    name: stringClaim(payload, 'name'),
    picture: stringClaim(payload, 'picture'),
  }
}

const remoteKeySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

const remoteKeySet = (url: string) => {
  const existing = remoteKeySets.get(url)
  if (existing) return existing
  const created = createRemoteJWKSet(new URL(url), {
    timeoutDuration: LOGTO_JWKS_TIMEOUT_MS,
    cooldownDuration: LOGTO_JWKS_COOLDOWN_MS,
    cacheMaxAge: LOGTO_JWKS_CACHE_MAX_AGE_MS,
  })
  remoteKeySets.set(url, created)
  return created
}

const validateLogtoTokenClaims = (payload: JWTPayload, logtoAppId: string) => {
  const audiences = Array.isArray(payload.aud)
    ? payload.aud
    : typeof payload.aud === 'string'
      ? [payload.aud]
      : []
  const authorizedParty = stringClaim(payload, 'azp')
  if (audiences.length > 1 && !authorizedParty) {
    throw new AuthBridgeTokenError('A multi-audience Logto ID token must identify its authorized party.')
  }
  if (authorizedParty && authorizedParty !== logtoAppId) {
    throw new AuthBridgeTokenError('The Logto ID token authorized party does not match this application.')
  }

  if (
    typeof payload.iat !== 'number'
    || typeof payload.exp !== 'number'
    || payload.exp <= payload.iat
    || payload.exp - payload.iat > LOGTO_MAX_TOKEN_AGE_SECONDS
  ) {
    throw new AuthBridgeTokenError('The Logto ID token has an invalid validity window.')
  }
}

let cachedPrivateKeySource = ''
let cachedPrivateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null
let cachedPublicKeyFingerprint = ''
let cachedSigningKeyMatch: Promise<{
  key: Awaited<ReturnType<typeof importPKCS8>>
  kid: string
}> | null = null

const signingKey = async (privateKey: string, publicJwks: JSONWebKeySet) => {
  const publicKeyFingerprint = publicJwks.keys
    .map((key) => `${key.kid || ''}:${key.n || ''}:${key.e || ''}`)
    .join('|')
  if (!cachedPrivateKey || cachedPrivateKeySource !== privateKey) {
    cachedPrivateKey = await importPKCS8(privateKey, 'RS256', { extractable: true })
    cachedPrivateKeySource = privateKey
    cachedSigningKeyMatch = null
  }
  if (cachedPublicKeyFingerprint !== publicKeyFingerprint) {
    cachedPublicKeyFingerprint = publicKeyFingerprint
    cachedSigningKeyMatch = null
  }

  cachedSigningKeyMatch ||= (async () => {
    const derived = await exportJWK(cachedPrivateKey!)
    const matches = publicJwks.keys.filter((published) => (
      derived.kty === 'RSA'
      && derived.n === published.n
      && derived.e === published.e
    ))
    if (matches.length !== 1 || !matches[0]?.kid) {
      throw new Error('The auth bridge signing key must match exactly one public JWKS key.')
    }
    return { key: cachedPrivateKey!, kid: matches[0].kid }
  })()
  return await cachedSigningKeyMatch
}

export const exchangeLogtoIdTokenWithIdentity = async (
  idToken: string,
  config: AuthBridgeConfig,
  keySet: Parameters<typeof jwtVerify>[1] = remoteKeySet(config.logtoJwksUrl),
) => {
  const { payload } = await jwtVerify(idToken, keySet, {
    issuer: config.logtoIssuer,
    audience: config.logtoAppId,
    algorithms: [...acceptedLogtoAlgorithms],
    requiredClaims: ['sub', 'iat', 'exp'],
    clockTolerance: LOGTO_CLOCK_TOLERANCE_SECONDS,
    maxTokenAge: LOGTO_MAX_TOKEN_AGE_SECONDS,
  })
  validateLogtoTokenClaims(payload, config.logtoAppId)
  const identity = verifiedLogtoIdentity(payload)
  const activeSigningKey = await signingKey(config.signingPrivateKey, config.publicJwks)

  const token = await new SignJWT({
    email: identity.email,
    email_verified: identity.emailVerified,
    ...(identity.name ? { name: identity.name } : {}),
    ...(identity.picture ? { picture: identity.picture } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid: activeSigningKey.kid, typ: 'JWT' })
    .setIssuer(config.bridgeIssuer)
    .setAudience(config.bridgeAppId)
    .setSubject(identity.subject)
    .setIssuedAt()
    .setExpirationTime(`${CONVEX_TOKEN_TTL_SECONDS}s`)
    .sign(activeSigningKey.key)

  return {
    identity,
    token,
    expiresIn: CONVEX_TOKEN_TTL_SECONDS,
  }
}

export const exchangeLogtoIdToken = async (
  idToken: string,
  config: AuthBridgeConfig,
  keySet: Parameters<typeof jwtVerify>[1] = remoteKeySet(config.logtoJwksUrl),
) => {
  const exchange = await exchangeLogtoIdTokenWithIdentity(
    idToken,
    config,
    keySet,
  )
  return {
    token: exchange.token,
    expiresIn: exchange.expiresIn,
  }
}
