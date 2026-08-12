import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SignJWT,
  calculateJwkThumbprint,
  createLocalJWKSet,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
  type JSONWebKeySet,
} from 'jose'
import {
  authBridgeConfig,
  exchangeLogtoIdToken,
  exchangeLogtoIdTokenWithIdentity,
  verifiedLogtoIdentity,
  type AuthBridgeConfig,
} from '../server/convexAuthBridge.ts'

const fixture = async () => {
  const logtoKeys = await generateKeyPair('ES384', { extractable: true })
  const bridgeKeys = await generateKeyPair('RS256', { extractable: true })
  const logtoPublic = await exportJWK(logtoKeys.publicKey)
  const bridgePublic = await exportJWK(bridgeKeys.publicKey)
  const logtoKid = await calculateJwkThumbprint(logtoPublic)
  const bridgeKid = await calculateJwkThumbprint(bridgePublic)
  const logtoJwks: JSONWebKeySet = {
    keys: [{ ...logtoPublic, alg: 'ES384', use: 'sig', kid: logtoKid }],
  }
  const publicJwks: JSONWebKeySet = {
    keys: [{ ...bridgePublic, alg: 'RS256', use: 'sig', kid: bridgeKid }],
  }
  const config: AuthBridgeConfig = {
    logtoIssuer: 'https://example.logto.app/oidc',
    logtoAppId: 'logto-app',
    logtoJwksUrl: 'https://example.logto.app/oidc/jwks',
    bridgeIssuer: 'https://example.org/api/convex-auth',
    bridgeAppId: 'ublda-convex',
    signingPrivateKey: await exportPKCS8(bridgeKeys.privateKey),
    publicJwks,
    allowedOrigins: new Set(['https://example.org']),
  }
  return { logtoKeys, logtoKid, logtoJwks, bridgeKeys, publicJwks, config }
}

const environmentFor = (
  setup: Awaited<ReturnType<typeof fixture>>,
  overrides: Record<string, string> = {},
) => ({
  LOGTO_ISSUER: setup.config.logtoIssuer,
  LOGTO_APP_ID: setup.config.logtoAppId,
  CONVEX_AUTH_ISSUER: setup.config.bridgeIssuer,
  CONVEX_AUTH_APP_ID: setup.config.bridgeAppId,
  CONVEX_AUTH_SIGNING_PRIVATE_KEY: setup.config.signingPrivateKey,
  CONVEX_AUTH_PUBLIC_JWKS: JSON.stringify(setup.publicJwks),
  CONVEX_AUTH_ALLOWED_ORIGINS: 'https://example.org',
  ...overrides,
})

test('exchanges a verified Logto ES384 token for a short-lived Convex RS256 token', async () => {
  const setup = await fixture()
  const idToken = await new SignJWT({
    email: 'SBodine@umich.edu',
    email_verified: true,
    name: 'Sam Bodine',
  })
    .setProtectedHeader({ alg: 'ES384', kid: setup.logtoKid })
    .setIssuer(setup.config.logtoIssuer)
    .setAudience(setup.config.logtoAppId)
    .setSubject('logto-user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(setup.logtoKeys.privateKey)

  const exchanged = await exchangeLogtoIdToken(
    idToken,
    setup.config,
    createLocalJWKSet(setup.logtoJwks),
  )
  const { payload, protectedHeader } = await jwtVerify(
    exchanged.token,
    createLocalJWKSet(setup.publicJwks),
    {
      issuer: setup.config.bridgeIssuer,
      audience: setup.config.bridgeAppId,
      algorithms: ['RS256'],
    },
  )

  assert.equal(protectedHeader.alg, 'RS256')
  assert.equal(payload.sub, 'logto-user-id')
  assert.equal(payload.email, 'sbodine@umich.edu')
  assert.equal(payload.email_verified, true)
  assert.equal(payload.name, 'Sam Bodine')
  assert.ok((payload.exp ?? 0) - (payload.iat ?? 0) <= 300)
  assert.equal(exchanged.expiresIn, 300)
})

test('rejects identities without a verified email', () => {
  assert.throws(
    () => verifiedLogtoIdentity({ sub: 'user', email: 'member@example.org', email_verified: false }),
    /verified email address/,
  )
})

test('can return the verified Logto identity with the bridge exchange', async () => {
  const setup = await fixture()
  const idToken = await new SignJWT({
    email: 'SBodine@umich.edu',
    email_verified: true,
    name: 'Sam Bodine',
  })
    .setProtectedHeader({ alg: 'ES384', kid: setup.logtoKid })
    .setIssuer(setup.config.logtoIssuer)
    .setAudience(setup.config.logtoAppId)
    .setSubject('logto-user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(setup.logtoKeys.privateKey)

  const exchanged = await exchangeLogtoIdTokenWithIdentity(
    idToken,
    setup.config,
    createLocalJWKSet(setup.logtoJwks),
  )
  assert.deepEqual(exchanged.identity, {
    subject: 'logto-user-id',
    email: 'sbodine@umich.edu',
    emailVerified: true,
    name: 'Sam Bodine',
    picture: undefined,
  })
  assert.equal(exchanged.expiresIn, 300)
  assert.ok(exchanged.token)
})

test('rejects an ID token issued for a different Logto application', async () => {
  const setup = await fixture()
  const idToken = await new SignJWT({ email: 'member@example.org', email_verified: true })
    .setProtectedHeader({ alg: 'ES384', kid: setup.logtoKid })
    .setIssuer(setup.config.logtoIssuer)
    .setAudience('another-app')
    .setSubject('logto-user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(setup.logtoKeys.privateKey)

  await assert.rejects(
    exchangeLogtoIdToken(idToken, setup.config, createLocalJWKSet(setup.logtoJwks)),
    /unexpected "aud" claim value/,
  )
})

test('requires issued-at and expiration claims on Logto ID tokens', async () => {
  const setup = await fixture()
  const withoutExpiration = await new SignJWT({
    email: 'member@example.org',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'ES384', kid: setup.logtoKid })
    .setIssuer(setup.config.logtoIssuer)
    .setAudience(setup.config.logtoAppId)
    .setSubject('logto-user-id')
    .setIssuedAt()
    .sign(setup.logtoKeys.privateKey)
  const withoutIssuedAt = await new SignJWT({
    email: 'member@example.org',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'ES384', kid: setup.logtoKid })
    .setIssuer(setup.config.logtoIssuer)
    .setAudience(setup.config.logtoAppId)
    .setSubject('logto-user-id')
    .setExpirationTime('5m')
    .sign(setup.logtoKeys.privateKey)
  const keySet = createLocalJWKSet(setup.logtoJwks)

  await assert.rejects(
    exchangeLogtoIdToken(withoutExpiration, setup.config, keySet),
    /exp.*required|required.*exp/i,
  )
  await assert.rejects(
    exchangeLogtoIdToken(withoutIssuedAt, setup.config, keySet),
    /iat.*required|required.*iat/i,
  )
})

test('rejects Logto ID tokens with stale, future, or excessive validity windows', async () => {
  const setup = await fixture()
  const now = Math.floor(Date.now() / 1_000)
  const createToken = (issuedAt: number, expiration: number) => new SignJWT({
    email: 'member@example.org',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'ES384', kid: setup.logtoKid })
    .setIssuer(setup.config.logtoIssuer)
    .setAudience(setup.config.logtoAppId)
    .setSubject('logto-user-id')
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiration)
    .sign(setup.logtoKeys.privateKey)
  const keySet = createLocalJWKSet(setup.logtoJwks)

  await assert.rejects(
    exchangeLogtoIdToken(await createToken(now - 3 * 60 * 60, now + 60), setup.config, keySet),
  )
  await assert.rejects(
    exchangeLogtoIdToken(await createToken(now + 60, now + 5 * 60), setup.config, keySet),
  )
  await assert.rejects(
    exchangeLogtoIdToken(await createToken(now, now + 3 * 60 * 60), setup.config, keySet),
    /invalid validity window/i,
  )
})

test('requires the Logto application as authorized party for multi-audience tokens', async () => {
  const setup = await fixture()
  const token = (azp?: string) => new SignJWT({
    email: 'member@example.org',
    email_verified: true,
    ...(azp ? { azp } : {}),
  })
    .setProtectedHeader({ alg: 'ES384', kid: setup.logtoKid })
    .setIssuer(setup.config.logtoIssuer)
    .setAudience([setup.config.logtoAppId, 'another-api'])
    .setSubject('logto-user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(setup.logtoKeys.privateKey)
  const keySet = createLocalJWKSet(setup.logtoJwks)

  await assert.rejects(
    exchangeLogtoIdToken(await token(), setup.config, keySet),
    /authorized party/i,
  )
  await assert.rejects(
    exchangeLogtoIdToken(await token('another-app'), setup.config, keySet),
    /authorized party/i,
  )
  await assert.doesNotReject(
    exchangeLogtoIdToken(await token(setup.config.logtoAppId), setup.config, keySet),
  )
})

test('publishes only allowlisted public RSA JWK fields', async () => {
  const setup = await fixture()
  const key = setup.publicJwks.keys[0]
  const config = authBridgeConfig(environmentFor(setup, {
    CONVEX_AUTH_PUBLIC_JWKS: JSON.stringify({
      keys: [{ ...key, x5u: 'https://metadata.example/key.pem', custom: 'ignored' }],
    }),
  }))

  assert.deepEqual(
    Object.keys(config.publicJwks.keys[0] || {}).sort(),
    ['alg', 'e', 'kid', 'kty', 'n', 'use'],
  )
})

test('rejects private key material in the public Convex JWKS', async () => {
  const setup = await fixture()
  const privateJwk = await exportJWK(setup.bridgeKeys.privateKey)

  assert.throws(
    () => authBridgeConfig(environmentFor(setup, {
      CONVEX_AUTH_PUBLIC_JWKS: JSON.stringify({
        keys: [{
          ...privateJwk,
          alg: 'RS256',
          use: 'sig',
          kid: setup.publicJwks.keys[0]?.kid,
        }],
      }),
    })),
    /invalid or private signing key/i,
  )
})

test('supports overlapping public keys while signing with the matching active private key', async () => {
  const setup = await fixture()
  const retiringKeys = await generateKeyPair('RS256', { extractable: true })
  const retiringPublic = await exportJWK(retiringKeys.publicKey)
  const retiringKid = await calculateJwkThumbprint(retiringPublic)
  const overlappingJwks: JSONWebKeySet = {
    keys: [
      { ...retiringPublic, alg: 'RS256', use: 'sig', kid: retiringKid },
      setup.publicJwks.keys[0]!,
    ],
  }
  const config = authBridgeConfig(environmentFor(setup, {
    CONVEX_AUTH_PUBLIC_JWKS: JSON.stringify(overlappingJwks),
  }))
  const idToken = await new SignJWT({
    email: 'member@example.org',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'ES384', kid: setup.logtoKid })
    .setIssuer(setup.config.logtoIssuer)
    .setAudience(setup.config.logtoAppId)
    .setSubject('logto-user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(setup.logtoKeys.privateKey)

  const exchanged = await exchangeLogtoIdToken(
    idToken,
    config,
    createLocalJWKSet(setup.logtoJwks),
  )
  const verified = await jwtVerify(exchanged.token, createLocalJWKSet(config.publicJwks), {
    issuer: config.bridgeIssuer,
    audience: config.bridgeAppId,
    algorithms: ['RS256'],
  })

  assert.equal(config.publicJwks.keys.length, 2)
  assert.equal(verified.protectedHeader.kid, setup.publicJwks.keys[0]?.kid)
})

test('fails deterministically when the signing key does not match the public JWKS', async () => {
  const setup = await fixture()
  const otherBridgeKeys = await generateKeyPair('RS256', { extractable: true })
  const idToken = await new SignJWT({
    email: 'member@example.org',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'ES384', kid: setup.logtoKid })
    .setIssuer(setup.config.logtoIssuer)
    .setAudience(setup.config.logtoAppId)
    .setSubject('logto-user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(setup.logtoKeys.privateKey)

  await assert.rejects(
    exchangeLogtoIdToken(
      idToken,
      {
        ...setup.config,
        signingPrivateKey: await exportPKCS8(otherBridgeKeys.privateKey),
      },
      createLocalJWKSet(setup.logtoJwks),
    ),
    /must match exactly one public JWKS key/i,
  )
})

test('loads a complete auth bridge configuration from environment values', async () => {
  const setup = await fixture()
  const config = authBridgeConfig(environmentFor(setup, {
    LOGTO_ISSUER: `${setup.config.logtoIssuer}/`,
    CONVEX_AUTH_ISSUER: `${setup.config.bridgeIssuer}/`,
    CONVEX_AUTH_ALLOWED_ORIGINS: 'https://example.org/, https://www.example.org',
  }))

  assert.equal(config.logtoJwksUrl, 'https://example.logto.app/oidc/jwks')
  assert.equal(config.bridgeIssuer, 'https://example.org/api/convex-auth')
  assert.deepEqual([...config.allowedOrigins], ['https://example.org', 'https://www.example.org'])
})
