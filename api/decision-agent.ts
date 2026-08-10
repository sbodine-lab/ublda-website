import type { VercelRequest, VercelResponse } from '../server/types.ts'
import { createDecisionAgentHandler } from '../server/decisionAgent/gateway.ts'

/**
 * One serverless function serves both the scoped REST API and stateless MCP.
 * `vercel.json` should rewrite `/api/decision-agent/:path*` to this function
 * with `decisionAgentPath=/:path*`; the query fallback also makes the handler
 * directly testable without framework-specific routing.
 */
const handler = createDecisionAgentHandler()

export default function decisionAgentHandler(req: VercelRequest, res: VercelResponse) {
  return handler(req, res)
}
