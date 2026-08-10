import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_DECISION_TIME_ZONE,
  DECISION_AGENT_OPERATIONS,
  DECISION_AGENT_SCOPES,
  createDraftSchema,
  sanitizeAggregateResults,
  sanitizeResponseStatus,
} from '../server/decisionAgent/contracts.ts'
import {
  ConvexDecisionAgentClient,
  DecisionAgentGatewayError,
  type DecisionAgentClient,
} from '../server/decisionAgent/convexClient.ts'
import { createDecisionAgentHandler } from '../server/decisionAgent/gateway.ts'

const TEST_TOKEN = 'ublda_decision_test_token_abcdefghijklmnopqrstuvwxyz'
const TEST_GATEWAY_SECRET = 'test_gateway_secret_abcdefghijklmnopqrstuvwxyz'

const createResponse = () => {
  let statusCode = 0
  let payload: unknown
  const headers = new Map<string, string>()

  const res = {
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value)
      return this
    },
    status(code: number) {
      statusCode = code
      return this
    },
    json(value: unknown) {
      payload = value
      return this
    },
    send(value: unknown) {
      payload = value
      return this
    },
  }

  return {
    res,
    result: () => ({ statusCode, payload, headers }),
  }
}

const createFakeClient = (scopes: string[] = Object.values(DECISION_AGENT_SCOPES)) => {
  const authorizations: Array<Record<string, unknown>> = []
  const executions: Array<Record<string, unknown>> = []
  const client: DecisionAgentClient = {
    async authorize(context) {
      authorizations.push(context)
      return {
        tokenId: 'token_1',
        memberId: 'member_1',
        clientName: 'Test agent',
        scopes,
      }
    },
    async execute(operation, input, context) {
      executions.push({ operation, input, context })
      return { ok: true, operation, input }
    },
    requiredScope(operation) {
      if (operation === DECISION_AGENT_OPERATIONS.aggregateResults) return DECISION_AGENT_SCOPES.results
      if (
        operation === DECISION_AGENT_OPERATIONS.close
        || operation === DECISION_AGENT_OPERATIONS.responseStatus
      ) {
        return DECISION_AGENT_SCOPES.manage
      }
      if (operation === DECISION_AGENT_OPERATIONS.createDraft) return DECISION_AGENT_SCOPES.write
      if (operation === DECISION_AGENT_OPERATIONS.publish) return DECISION_AGENT_SCOPES.publish
      return DECISION_AGENT_SCOPES.read
    },
  }

  return { client, authorizations, executions }
}

test('REST draft creation requires and forwards an idempotency key', async () => {
  const fake = createFakeClient()
  const handler = createDecisionAgentHandler({ client: fake.client })

  const missingKeyResponse = createResponse()
  await handler({
    method: 'POST',
    url: '/api/decision-agent/v1/decisions/drafts',
    query: {},
    headers: { authorization: `Bearer ${TEST_TOKEN}` },
    body: {
      title: 'Choose the event date',
      overview: 'Pick the date that works for the board.',
      responseType: 'yes_no_other',
    },
  }, missingKeyResponse.res)

  assert.equal(missingKeyResponse.result().statusCode, 400)
  assert.deepEqual(missingKeyResponse.result().payload, {
    error: {
      code: 'idempotency_key_required',
      message: 'An Idempotency-Key header is required for this operation.',
      requestId: missingKeyResponse.result().headers.get('x-request-id'),
    },
  })
  assert.equal(fake.authorizations.length, 0)

  const response = createResponse()
  await handler({
    method: 'POST',
    url: '/api/decision-agent/v1/decisions/drafts',
    query: {},
    headers: {
      authorization: `Bearer ${TEST_TOKEN}`,
      'idempotency-key': 'draft-2026-08-09-001',
    },
    body: {
      title: 'Choose the event date',
      overview: 'Pick the date that works for the board.',
      responseType: 'yes_no_other',
    },
  }, response.res)

  assert.equal(response.result().statusCode, 201)
  assert.equal(fake.authorizations[0].requiredScope, DECISION_AGENT_SCOPES.write)
  assert.equal(fake.executions[0].operation, DECISION_AGENT_OPERATIONS.createDraft)
  assert.equal(
    (fake.executions[0].input as Record<string, unknown>).timeZone,
    DEFAULT_DECISION_TIME_ZONE,
  )
  assert.equal(
    (fake.executions[0].context as Record<string, unknown>).idempotencyKey,
    'draft-2026-08-09-001',
  )
})

test('agent deadlines require an unambiguous ISO timezone', () => {
  const base = {
    title: 'Choose the event date',
    overview: 'Pick the date that works for the board.',
    responseType: 'yes_no_other' as const,
  }
  assert.equal(createDraftSchema.safeParse({ ...base, deadline: '2026-08-12T17:00:00' }).success, false)
  assert.equal(createDraftSchema.safeParse({ ...base, deadline: '2026-08-12T17:00:00-04:00' }).success, true)
})

test('draft time zones default consistently and reject invalid or non-canonical names', async () => {
  const base = {
    title: 'Choose the event date',
    overview: 'Pick the date that works for the board.',
    responseType: 'yes_no_other' as const,
  }
  const defaulted = createDraftSchema.parse(base)
  assert.equal(defaulted.timeZone, DEFAULT_DECISION_TIME_ZONE)
  assert.equal(createDraftSchema.safeParse({ ...base, timeZone: 'America/Detroit' }).success, true)
  assert.equal(createDraftSchema.safeParse({ ...base, timeZone: 'America/Detriot' }).success, false)
  assert.equal(createDraftSchema.safeParse({ ...base, timeZone: 'US/Eastern' }).success, false)
  assert.equal(createDraftSchema.safeParse({ ...base, timeZone: 'america/detroit' }).success, false)
  assert.equal(createDraftSchema.safeParse({ ...base, timeZone: `America/${'x'.repeat(73)}` }).success, false)

  const fake = createFakeClient()
  const handler = createDecisionAgentHandler({ client: fake.client })
  const response = createResponse()
  await handler({
    method: 'POST',
    url: '/api/decision-agent/v1/decisions/drafts',
    query: {},
    headers: {
      authorization: `Bearer ${TEST_TOKEN}`,
      'idempotency-key': 'draft-invalid-time-zone-001',
    },
    body: { ...base, timeZone: 'America/Detriot' },
  }, response.res)

  assert.equal(response.result().statusCode, 400)
  assert.equal(fake.authorizations.length, 0)
  assert.equal(fake.executions.length, 0)
  assert.match(
    String((response.result().payload as { error?: { message?: string } }).error?.message),
    /canonical IANA time zone/i,
  )
})

test('response status uses the manage scope and aggregate output strips private fields', async () => {
  const fake = createFakeClient()
  const handler = createDecisionAgentHandler({ client: fake.client })
  const response = createResponse()

  await handler({
    method: 'GET',
    url: '/api/decision-agent/v1/decisions/decision_1/response-status',
    query: {},
    headers: { authorization: `Bearer ${TEST_TOKEN}` },
  }, response.res)

  assert.equal(response.result().statusCode, 200)
  assert.equal(fake.authorizations[0].requiredScope, DECISION_AGENT_SCOPES.manage)

  assert.deepEqual(sanitizeAggregateResults({
    turnout: 4,
    counts: { yes: 3, no: 1 },
    ballots: [{ memberName: 'Private member', choice: 'yes' }],
    nested: { comments: ['private'], total: 4 },
  }), {
    turnout: 4,
    counts: { yes: 3, no: 1 },
    nested: { total: 4 },
  })

  assert.deepEqual(sanitizeAggregateResults({
    response_count: 4,
    named_ballots: [{ member_name: 'Private member' }],
    nested: { individual_responses: [{ choice: 'yes' }] },
  }), {
    response_count: 4,
    nested: {},
  })

  assert.deepEqual(sanitizeResponseStatus({
    missingMembers: [{ displayName: 'Board member' }],
    respondedMembers: [{
      displayName: 'Another member',
      email: 'private@example.com',
      token_identifier: 'private-token-subject',
      identities: [{ providerSubject: 'private-provider-subject' }],
      selections: ['yes'],
      reasoning: 'Private',
    }],
  }), {
    missingMembers: [{ displayName: 'Board member' }],
    respondedMembers: [{ displayName: 'Another member' }],
  })
})

test('browser CORS is deny-by-default while same-origin requests are allowed', async () => {
  const fake = createFakeClient()
  const handler = createDecisionAgentHandler({ client: fake.client })
  const denied = createResponse()

  await handler({
    method: 'GET',
    url: '/api/decision-agent/v1/decisions',
    query: {},
    headers: {
      authorization: `Bearer ${TEST_TOKEN}`,
      host: 'decisions.ublda.org',
      origin: 'https://attacker.example',
    },
  }, denied.res)

  assert.equal(denied.result().statusCode, 403)
  assert.equal(denied.result().headers.has('access-control-allow-origin'), false)
  assert.equal(fake.authorizations.length, 0)

  const allowed = createResponse()
  await handler({
    method: 'OPTIONS',
    url: '/api/decision-agent/v1/decisions',
    query: {},
    headers: {
      host: 'decisions.ublda.org',
      origin: 'https://decisions.ublda.org',
    },
  }, allowed.res)

  assert.equal(allowed.result().statusCode, 204)
  assert.equal(allowed.result().headers.get('access-control-allow-origin'), 'https://decisions.ublda.org')
})

test('oversized bodies are rejected before token authorization', async () => {
  const fake = createFakeClient()
  const handler = createDecisionAgentHandler({ client: fake.client })
  const response = createResponse()

  await handler({
    method: 'POST',
    url: '/api/decision-agent/v1/decisions/drafts',
    query: {},
    headers: {
      authorization: `Bearer ${TEST_TOKEN}`,
      'content-length': String(70 * 1024),
    },
    body: {},
  }, response.res)

  assert.equal(response.result().statusCode, 413)
  assert.equal(fake.authorizations.length, 0)
})

test('Convex proxy redacts bearer and gateway secrets from upstream errors', async () => {
  const client = new ConvexDecisionAgentClient({
    siteUrl: 'https://decision-test.convex.site',
    gatewaySecret: TEST_GATEWAY_SECRET,
    fetchImpl: async () => new Response(JSON.stringify({
      error: {
        code: 'invalid_token',
        message: `Token ${TEST_TOKEN} is revoked; gateway ${TEST_GATEWAY_SECRET}`,
      },
    }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
  })

  await assert.rejects(
    client.authorize({
      token: TEST_TOKEN,
      requestId: 'request-redaction-test',
      operation: 'mcp',
      method: 'POST',
      path: '/mcp',
    }),
    (error: unknown) => {
      assert.equal(error instanceof DecisionAgentGatewayError, true)
      assert.equal((error as Error).message.includes(TEST_TOKEN), false)
      assert.equal((error as Error).message.includes(TEST_GATEWAY_SECRET), false)
      assert.equal((error as Error).message.includes('[REDACTED]'), true)
      return true
    },
  )
})

test('Convex proxy removes named responses and comments from aggregate results', async () => {
  const client = new ConvexDecisionAgentClient({
    siteUrl: 'https://decision-test.convex.site',
    gatewaySecret: TEST_GATEWAY_SECRET,
    fetchImpl: async (url, init) => {
      assert.equal(String(url).endsWith('/decision-agent/aggregate-results'), true)
      assert.equal(
        new Headers(init?.headers).get('x-ublda-gateway-secret'),
        TEST_GATEWAY_SECRET,
      )
      return Response.json({
        turnout: 4,
        counts: { yes: 3, no: 1 },
        ballots: [{ memberName: 'Private', choice: 'yes' }],
        comments: ['Private comment'],
      })
    },
  })

  const result = await client.execute(
    DECISION_AGENT_OPERATIONS.aggregateResults,
    { decisionId: 'decision_1' },
    { token: TEST_TOKEN, requestId: 'request-aggregate-test' },
  )

  assert.deepEqual(result, {
    turnout: 4,
    counts: { yes: 3, no: 1 },
  })
})

test('Convex millisecond expiry is normalized for MCP AuthInfo', async () => {
  const client = new ConvexDecisionAgentClient({
    siteUrl: 'https://decision-test.convex.site',
    gatewaySecret: TEST_GATEWAY_SECRET,
    fetchImpl: async () => Response.json({
      authorized: true,
      principal: {
        tokenId: 'token_1',
        memberId: 'member_1',
        scopes: [DECISION_AGENT_SCOPES.read],
        expiresAt: 1_786_320_000_000,
      },
    }),
  })

  const principal = await client.authorize({
    token: TEST_TOKEN,
    requestId: 'request-expiry-test',
    operation: DECISION_AGENT_OPERATIONS.list,
    requiredScope: DECISION_AGENT_SCOPES.read,
    method: 'GET',
    path: '/v1/decisions',
  })

  assert.equal(principal.expiresAt, 1_786_320_000)
})

test('Convex proxy fails closed without a valid gateway secret', () => {
  assert.throws(
    () => new ConvexDecisionAgentClient({
      siteUrl: 'https://decision-test.convex.site',
      gatewaySecret: 'too-short',
    }),
    (error: unknown) => {
      assert.equal(error instanceof DecisionAgentGatewayError, true)
      assert.equal((error as DecisionAgentGatewayError).status, 503)
      assert.equal((error as DecisionAgentGatewayError).code, 'gateway_not_configured')
      assert.equal((error as Error).message.includes('too-short'), false)
      return true
    },
  )
})
