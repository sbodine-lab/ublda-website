import { createMcpHandler, McpServer, type AuthInfo } from '@modelcontextprotocol/server'
import {
  aggregateResultsSchema,
  closeSchema,
  DECISION_AGENT_OPERATIONS,
  DECISION_AGENT_SCOPES,
  getSchema,
  hasScope,
  listSchema,
  MCP_CREATE_DRAFT_SCHEMA,
  MCP_PUBLISH_SCHEMA,
  responseStatusSchema,
} from './contracts.ts'
import { DecisionAgentGatewayError, type DecisionAgentClient } from './convexClient.ts'

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return { value }
}

const successResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  structuredContent: { result: value },
})

const errorResult = (error: unknown) => {
  const safeError = error instanceof DecisionAgentGatewayError
    ? { code: error.code, message: error.message, status: error.status }
    : { code: 'decision_agent_error', message: 'The decision operation could not be completed.', status: 500 }

  return {
    isError: true,
    content: [{ type: 'text' as const, text: safeError.message }],
    structuredContent: { error: safeError },
  }
}

const requestContext = (authInfo: AuthInfo, idempotencyKey?: string) => ({
  token: authInfo.token,
  requestId: typeof authInfo.extra?.requestId === 'string' ? authInfo.extra.requestId : crypto.randomUUID(),
  clientIp: typeof authInfo.extra?.clientIp === 'string' ? authInfo.extra.clientIp : undefined,
  idempotencyKey,
})

const can = (authInfo: AuthInfo, scope: Parameters<typeof hasScope>[1]) => (
  hasScope(authInfo.scopes, scope)
)

export const createDecisionAgentMcpHandler = (client: DecisionAgentClient) => createMcpHandler(
  ({ authInfo }) => {
    if (!authInfo?.token) {
      throw new DecisionAgentGatewayError(401, 'missing_token', 'A decision agent token is required.')
    }

    const server = new McpServer({
      name: 'ublda-decision-center',
      version: '1.0.0',
    })

    if (can(authInfo, DECISION_AGENT_SCOPES.write)) {
      server.registerTool(
        'ublda_decision_create_draft',
        {
          title: 'Create UBLDA decision draft',
          description: 'Create a private draft decision. Publishing is a separate operation.',
          inputSchema: MCP_CREATE_DRAFT_SCHEMA,
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        async (input) => {
          try {
            const { idempotencyKey, ...draft } = input
            const value = await client.execute(
              DECISION_AGENT_OPERATIONS.createDraft,
              asObject(draft),
              requestContext(authInfo, idempotencyKey),
            )
            return successResult(value)
          } catch (error) {
            return errorResult(error)
          }
        },
      )
    }

    if (can(authInfo, DECISION_AGENT_SCOPES.publish)) {
      server.registerTool(
        'ublda_decision_publish',
        {
          title: 'Publish UBLDA decision',
          description: 'Publish an existing decision draft and make its ballot available to its electorate.',
          inputSchema: MCP_PUBLISH_SCHEMA,
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        async ({ decisionId, idempotencyKey }) => {
          try {
            const value = await client.execute(
              DECISION_AGENT_OPERATIONS.publish,
              { decisionId },
              requestContext(authInfo, idempotencyKey),
            )
            return successResult(value)
          } catch (error) {
            return errorResult(error)
          }
        },
      )
    }

    if (can(authInfo, DECISION_AGENT_SCOPES.read)) {
      server.registerTool(
        'ublda_decisions_list',
        {
          title: 'List UBLDA decisions',
          description: 'List decisions visible to this token.',
          inputSchema: listSchema,
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        async (input) => {
          try {
            return successResult(await client.execute(
              DECISION_AGENT_OPERATIONS.list,
              asObject(input),
              requestContext(authInfo),
            ))
          } catch (error) {
            return errorResult(error)
          }
        },
      )

      server.registerTool(
        'ublda_decision_get',
        {
          title: 'Get UBLDA decision',
          description: 'Get one decision and its non-private configuration.',
          inputSchema: getSchema,
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        async (input) => {
          try {
            return successResult(await client.execute(
              DECISION_AGENT_OPERATIONS.get,
              asObject(input),
              requestContext(authInfo),
            ))
          } catch (error) {
            return errorResult(error)
          }
        },
      )

    }

    if (can(authInfo, DECISION_AGENT_SCOPES.results)) {
      server.registerTool(
        'ublda_decision_aggregate_results',
        {
          title: 'Get aggregate UBLDA decision results',
          description: 'Get counts and turnout only. Named ballots and comments are deliberately excluded.',
          inputSchema: aggregateResultsSchema,
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        async (input) => {
          try {
            return successResult(await client.execute(
              DECISION_AGENT_OPERATIONS.aggregateResults,
              asObject(input),
              requestContext(authInfo),
            ))
          } catch (error) {
            return errorResult(error)
          }
        },
      )
    }

    if (can(authInfo, DECISION_AGENT_SCOPES.manage)) {
      server.registerTool(
        'ublda_decision_response_status',
        {
          title: 'Get UBLDA decision response status',
          description: 'Get who has or has not responded, without exposing ballot choices or comments.',
          inputSchema: responseStatusSchema,
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        async (input) => {
          try {
            return successResult(await client.execute(
              DECISION_AGENT_OPERATIONS.responseStatus,
              asObject(input),
              requestContext(authInfo),
            ))
          } catch (error) {
            return errorResult(error)
          }
        },
      )
    }

    if (can(authInfo, DECISION_AGENT_SCOPES.manage)) {
      server.registerTool(
        'ublda_decision_close',
        {
          title: 'Close UBLDA decision',
          description: 'Close an open decision so it no longer accepts responses.',
          inputSchema: closeSchema,
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        async (input) => {
          try {
            return successResult(await client.execute(
              DECISION_AGENT_OPERATIONS.close,
              asObject(input),
              requestContext(authInfo),
            ))
          } catch (error) {
            return errorResult(error)
          }
        },
      )
    }

    return server
  },
  {
    legacy: 'stateless',
    onerror: () => {
      // Intentionally quiet: request payloads and bearer tokens must never be logged.
    },
  },
)
