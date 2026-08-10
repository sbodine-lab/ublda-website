import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DECISION_AGENT_SCOPES } from '../server/decisionAgent/contracts.ts'
import type { DecisionAgentClient } from '../server/decisionAgent/convexClient.ts'
import { createDecisionAgentHandler } from '../server/decisionAgent/gateway.ts'

const TEST_TOKEN = 'ublda_decision_test_token_abcdefghijklmnopqrstuvwxyz'

const createResponse = () => {
  let statusCode = 0
  let payload = ''
  const headers = new Map<string, string>()
  return {
    res: {
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value)
        return this
      },
      status(code: number) {
        statusCode = code
        return this
      },
      json(value: unknown) {
        payload = JSON.stringify(value)
        return this
      },
      send(value: unknown) {
        payload = String(value ?? '')
        return this
      },
    },
    result: () => ({ statusCode, payload, headers }),
  }
}

const jsonRpcBody = (payload: string) => {
  if (payload.startsWith('{')) return JSON.parse(payload) as Record<string, unknown>
  const data = payload.split('\n').find((line) => line.startsWith('data: '))?.slice(6)
  return data ? JSON.parse(data) as Record<string, unknown> : {}
}

test('MCP uses a per-request v2 factory and authorizes the bearer token server-side', async () => {
  const authorizations: Array<Record<string, unknown>> = []
  const client: DecisionAgentClient = {
    async authorize(context) {
      authorizations.push(context)
      return {
        tokenId: 'token_1',
        memberId: 'member_1',
        scopes: [DECISION_AGENT_SCOPES.read, DECISION_AGENT_SCOPES.results],
      }
    },
    async execute() {
      return { ok: true }
    },
    requiredScope() {
      return DECISION_AGENT_SCOPES.read
    },
  }
  const handler = createDecisionAgentHandler({ client })
  const response = createResponse()

  await handler({
    method: 'POST',
    url: '/api/decision-agent/mcp',
    query: {},
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${TEST_TOKEN}`,
      'content-type': 'application/json',
      host: 'decisions.ublda.org',
    },
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'gateway-test', version: '1.0.0' },
      },
    },
  }, response.res)

  assert.equal(response.result().statusCode, 200)
  const rpc = jsonRpcBody(response.result().payload)
  assert.equal(rpc.jsonrpc, '2.0')
  assert.equal(rpc.id, 1)
  assert.equal(authorizations.length, 1)
  assert.equal(authorizations[0].operation, 'mcp')
  assert.equal(authorizations[0].token, TEST_TOKEN)

  const toolsResponse = createResponse()
  await handler({
    method: 'POST',
    url: '/api/decision-agent/mcp',
    query: {},
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${TEST_TOKEN}`,
      'content-type': 'application/json',
      host: 'decisions.ublda.org',
      'mcp-method': 'tools/list',
      'mcp-protocol-version': '2026-07-28',
    },
    body: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    },
  }, toolsResponse.res)

  assert.equal(toolsResponse.result().statusCode, 200)
  const toolsRpc = jsonRpcBody(toolsResponse.result().payload) as {
    result?: { tools?: Array<{ name: string }> }
  }
  assert.deepEqual(toolsRpc.result?.tools?.map(({ name }) => name), [
    'ublda_decisions_list',
    'ublda_decision_get',
    'ublda_decision_aggregate_results',
  ])
})

test('MCP refuses malformed bearer tokens before creating a server', async () => {
  let authorizationCalls = 0
  const client: DecisionAgentClient = {
    async authorize() {
      authorizationCalls += 1
      throw new Error('must not run')
    },
    async execute() {
      throw new Error('must not run')
    },
    requiredScope() {
      return DECISION_AGENT_SCOPES.read
    },
  }
  const handler = createDecisionAgentHandler({ client })
  const response = createResponse()

  await handler({
    method: 'POST',
    url: '/api/decision-agent/mcp',
    query: {},
    headers: {
      authorization: 'Bearer short',
      'content-type': 'application/json',
    },
    body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  }, response.res)

  assert.equal(response.result().statusCode, 401)
  assert.equal(response.result().headers.has('www-authenticate'), true)
  assert.equal(authorizationCalls, 0)
  assert.equal(response.result().payload.includes('short'), false)
})

test('MCP draft creation requires an idempotency key in tool input and forwards it separately', async () => {
  const executions: Array<Record<string, unknown>> = []
  const client: DecisionAgentClient = {
    async authorize() {
      return {
        tokenId: 'token_2',
        memberId: 'member_2',
        scopes: [DECISION_AGENT_SCOPES.write],
      }
    },
    async execute(operation, input, context) {
      executions.push({ operation, input, context })
      return { decisionId: 'decision_2', slug: 'choose-event-date' }
    },
    requiredScope() {
      return DECISION_AGENT_SCOPES.write
    },
  }
  const handler = createDecisionAgentHandler({ client })
  const response = createResponse()

  await handler({
    method: 'POST',
    url: '/api/decision-agent/mcp',
    query: {},
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${TEST_TOKEN}`,
      'content-type': 'application/json',
    },
    body: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'ublda_decision_create_draft',
        arguments: {
          title: 'Choose the event date',
          overview: 'Pick the date that works for the board.',
          responseType: 'yes_no_other',
          idempotencyKey: 'mcp-draft-2026-08-09-001',
        },
      },
    },
  }, response.res)

  assert.equal(response.result().statusCode, 200)
  const rpc = jsonRpcBody(response.result().payload) as {
    result?: { isError?: boolean; structuredContent?: { result?: { decisionId?: string } } }
  }
  assert.equal(rpc.result?.isError, undefined)
  assert.equal(rpc.result?.structuredContent?.result?.decisionId, 'decision_2')
  assert.equal(executions.length, 1)
  assert.equal((executions[0].input as Record<string, unknown>).idempotencyKey, undefined)
  assert.equal(
    (executions[0].context as Record<string, unknown>).idempotencyKey,
    'mcp-draft-2026-08-09-001',
  )
})

test('MCP management scope does not imply read, write, publish, or results scopes', async () => {
  const client: DecisionAgentClient = {
    async authorize() {
      return {
        tokenId: 'token_manage',
        memberId: 'member_manage',
        scopes: [DECISION_AGENT_SCOPES.manage],
      }
    },
    async execute() {
      return { ok: true }
    },
    requiredScope() {
      return DECISION_AGENT_SCOPES.manage
    },
  }
  const handler = createDecisionAgentHandler({ client })
  const response = createResponse()

  await handler({
    method: 'POST',
    url: '/api/decision-agent/mcp',
    query: {},
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${TEST_TOKEN}`,
      'content-type': 'application/json',
    },
    body: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/list',
      params: {},
    },
  }, response.res)

  const rpc = jsonRpcBody(response.result().payload) as {
    result?: { tools?: Array<{ name: string }> }
  }
  assert.deepEqual(rpc.result?.tools?.map(({ name }) => name), [
    'ublda_decision_response_status',
    'ublda_decision_close',
  ])
})
