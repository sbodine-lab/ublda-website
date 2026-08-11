import {
  SignJWT,
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from 'jose'

const CONVEX_TOKEN_TTL_SECONDS = 5 * 60
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

const required = (environment: Environment, name: string) => {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`Missing ${name}.`)
  return value
}

const parsePublicJwks = (raw: string): JSONWebKeySet => {
  const parsed = JSON.parse(raw) as JSONWebKeySet
  const keys = Array.isArray(parsed.keys) ? parsed.keys : []
  const valid = keys.length === 1
    && keys[0]?.kty === 'RSA'
    && keys[0]?.alg === 'RS256'
    && keys[0]?.use === 'sig'
    && typeof keys[0]?.kid === 'string'
    && Boolean(keys[0].kid)
    && typeof keys[0]?.n === 'string'
    && typeof keys[0]?.e === 'string'

  if (!valid) throw new Error('CONVEX_AUTH_PUBLIC_JWKS must contain one RS256 signing key.')
  return { keys }
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
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean),
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
    throw new Error('The Logto identity must contain a verified email address.')
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
  const created = createRemoteJWKSet(new URL(url))
  remoteKeySets.set(url, created)
  return created
}

let cachedPrivateKeySource = ''
let cachedPrivateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null

const signingKey = async (privateKey: string) => {
  if (cachedPrivateKey && cachedPrivateKeySource === privateKey) return cachedPrivateKey
  cachedPrivateKey = await importPKCS8(privateKey, 'RS256')
  cachedPrivateKeySource = privateKey
  return cachedPrivateKey
}

export const exchangeLogtoIdToken = async (
  idToken: string,
  config: AuthBridgeConfig,
  keySet: Parameters<typeof jwtVerify>[1] = remoteKeySet(config.logtoJwksUrl),
) => {
  const { payload } = await jwtVerify(idToken, keySet, {
    issuer: config.logtoIssuer,
    audience: config.logtoAppId,
    algorithms: [...acceptedLogtoAlgorithms],
  })
  const identity = verifiedLogtoIdentity(payload)
  const kid = config.publicJwks.keys[0]?.kid
  if (!kid) throw new Error('The auth bridge signing key ID is missing.')

  const token = await new SignJWT({
    email: identity.email,
    email_verified: identity.emailVerified,
    ...(identity.name ? { name: identity.name } : {}),
    ...(identity.picture ? { picture: identity.picture } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .setIssuer(config.bridgeIssuer)
    .setAudience(config.bridgeAppId)
    .setSubject(identity.subject)
    .setIssuedAt()
    .setExpirationTime(`${CONVEX_TOKEN_TTL_SECONDS}s`)
    .sign(await signingKey(config.signingPrivateKey))

  return {
    token,
    expiresIn: CONVEX_TOKEN_TTL_SECONDS,
  }
}
