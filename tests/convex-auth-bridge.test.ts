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

test('loads a complete auth bridge configuration from environment values', async () => {
  const setup = await fixture()
  const config = authBridgeConfig({
    LOGTO_ISSUER: `${setup.config.logtoIssuer}/`,
    LOGTO_APP_ID: setup.config.logtoAppId,
    CONVEX_AUTH_ISSUER: `${setup.config.bridgeIssuer}/`,
    CONVEX_AUTH_APP_ID: setup.config.bridgeAppId,
    CONVEX_AUTH_SIGNING_PRIVATE_KEY: setup.config.signingPrivateKey,
    CONVEX_AUTH_PUBLIC_JWKS: JSON.stringify(setup.publicJwks),
    CONVEX_AUTH_ALLOWED_ORIGINS: 'https://example.org/, https://www.example.org',
  })

  assert.equal(config.logtoJwksUrl, 'https://example.logto.app/oidc/jwks')
  assert.equal(config.bridgeIssuer, 'https://example.org/api/convex-auth')
  assert.deepEqual([...config.allowedOrigins], ['https://example.org', 'https://www.example.org'])
})
