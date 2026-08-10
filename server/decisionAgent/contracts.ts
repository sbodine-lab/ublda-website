import { z } from 'zod'

export const DEFAULT_DECISION_TIME_ZONE = 'America/Detroit'
export const MAX_DECISION_TIME_ZONE_LENGTH = 80

export const isCanonicalIanaTimeZone = (value: string): boolean => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value })
      .resolvedOptions()
      .timeZone === value
  } catch {
    return false
  }
}

export const canonicalIanaTimeZoneSchema = z.string()
  .trim()
  .min(1)
  .max(MAX_DECISION_TIME_ZONE_LENGTH)
  .refine(isCanonicalIanaTimeZone, {
    message: 'Use a canonical IANA time zone such as America/Detroit.',
  })

export const DECISION_AGENT_SCOPES = {
  read: 'decisions:read',
  write: 'decisions:write',
  publish: 'decisions:publish',
  manage: 'decisions:manage',
  results: 'results:read',
} as const

export type DecisionAgentScope = typeof DECISION_AGENT_SCOPES[keyof typeof DECISION_AGENT_SCOPES]

export const DECISION_AGENT_OPERATIONS = {
  createDraft: 'create-draft',
  publish: 'publish',
  list: 'list',
  get: 'get',
  responseStatus: 'response-status',
  aggregateResults: 'aggregate-results',
  close: 'close',
} as const

export type DecisionAgentOperation = (
  typeof DECISION_AGENT_OPERATIONS[keyof typeof DECISION_AGENT_OPERATIONS]
)

export const OPERATION_SCOPES: Record<DecisionAgentOperation, DecisionAgentScope> = {
  [DECISION_AGENT_OPERATIONS.createDraft]: DECISION_AGENT_SCOPES.write,
  [DECISION_AGENT_OPERATIONS.publish]: DECISION_AGENT_SCOPES.publish,
  [DECISION_AGENT_OPERATIONS.list]: DECISION_AGENT_SCOPES.read,
  [DECISION_AGENT_OPERATIONS.get]: DECISION_AGENT_SCOPES.read,
  [DECISION_AGENT_OPERATIONS.responseStatus]: DECISION_AGENT_SCOPES.manage,
  [DECISION_AGENT_OPERATIONS.aggregateResults]: DECISION_AGENT_SCOPES.results,
  [DECISION_AGENT_OPERATIONS.close]: DECISION_AGENT_SCOPES.manage,
}

const safeIdentifier = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/, {
  message: 'Use only letters, numbers, periods, underscores, colons, or hyphens.',
})

export const idempotencyKeySchema = safeIdentifier.min(8).max(200)

export const decisionIdSchema = safeIdentifier

export const decisionOptionSchema = z.object({
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1_000).optional(),
})

export const createDraftSchema = z.object({
  title: z.string().trim().min(1).max(180),
  overview: z.string().trim().min(1).max(12_000),
  responseType: z.enum(['yes_no_other', 'single_choice', 'ranked_choice', 'input_only']),
  options: z.array(decisionOptionSchema).min(1).max(25).optional(),
  eligibleMemberIds: z.array(safeIdentifier).max(100).optional(),
  deadline: z.string().trim().max(80).optional(),
  timeZone: canonicalIanaTimeZoneSchema.default(DEFAULT_DECISION_TIME_ZONE),
  autoClose: z.boolean().default(false),
  minimumTurnout: z.number().int().min(1).max(100).optional(),
  approvalThreshold: z.number().positive().max(1).optional(),
  resultsVisibility: z.enum(['after_response', 'after_close', 'admins_only']).default('after_response'),
}).strict().superRefine((value, context) => {
  if (value.responseType === 'single_choice' || value.responseType === 'ranked_choice') {
    if (!value.options || value.options.length < 2) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Single-choice and ranked decisions need at least two options.',
      })
    }
  }

  if (
    value.deadline
    && (
      Number.isNaN(Date.parse(value.deadline))
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.deadline)
    )
  ) {
    context.addIssue({
      code: 'custom',
      path: ['deadline'],
      message: 'Deadline must be an ISO 8601 date and time.',
    })
  }
})

export const publishSchema = z.object({
  decisionId: decisionIdSchema,
}).strict()

export const listSchema = z.object({
  status: z.enum(['draft', 'open', 'closed', 'finalized']).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().max(500).optional(),
}).strict()

export const getSchema = z.object({
  decisionId: decisionIdSchema,
}).strict()

export const responseStatusSchema = getSchema

export const aggregateResultsSchema = getSchema

export const closeSchema = z.object({
  decisionId: decisionIdSchema,
  note: z.string().trim().max(2_000).optional(),
}).strict()

export const MCP_CREATE_DRAFT_SCHEMA = createDraftSchema.safeExtend({
  idempotencyKey: idempotencyKeySchema,
})

export const MCP_PUBLISH_SCHEMA = publishSchema.extend({
  idempotencyKey: idempotencyKeySchema,
})

export const authorizationResponseSchema = z.object({
  authorized: z.literal(true),
  principal: z.object({
    tokenId: z.string().min(1).max(200),
    memberId: z.string().min(1).max(200),
    clientName: z.string().max(200).optional(),
    scopes: z.array(z.string().max(100)).max(50),
    expiresAt: z.number().int().positive().optional(),
  }),
  retryAfterSeconds: z.number().int().positive().max(86_400).optional(),
})

export type DecisionAgentPrincipal = z.infer<typeof authorizationResponseSchema>['principal']

const PRIVATE_AGGREGATE_KEYS = new Set([
  'ballot',
  'ballots',
  'comment',
  'comments',
  'displayname',
  'email',
  'emails',
  'eligiblemembers',
  'electorate',
  'identities',
  'individualballots',
  'individualresponses',
  'memberid',
  'memberemails',
  'membername',
  'membernames',
  'missingmembers',
  'missingresponders',
  'namedballots',
  'othertext',
  'participantnames',
  'rationale',
  'reasoning',
  'respondedmembers',
  'respondents',
  'responsetext',
  'responses',
  'selection',
  'selections',
  'voters',
])

const PRIVATE_RESPONSE_STATUS_KEYS = new Set([
  'ballot',
  'ballots',
  'choice',
  'choices',
  'comment',
  'comments',
  'email',
  'emails',
  'identities',
  'normalizedemail',
  'othertext',
  'providersubject',
  'rationale',
  'reasoning',
  'responsetext',
  'selection',
  'selections',
  'tokenidentifier',
  'tokenidentifiers',
])

const normalizedPrivateKey = (key: string) => key.replace(/[-_]/g, '').toLowerCase()

const stripPrivateKeys = (value: unknown, keys: ReadonlySet<string>): unknown => {
  if (Array.isArray(value)) return value.map((item) => stripPrivateKeys(item, keys))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !keys.has(normalizedPrivateKey(key)))
      .map(([key, item]) => [key, stripPrivateKeys(item, keys)]),
  )
}

/**
 * Convex is the primary privacy boundary. This is a second, gateway-level
 * guard so the aggregate-results operation cannot accidentally return named
 * ballots, voter identities, or free-text comments if its upstream shape
 * later grows.
 */
export const sanitizeAggregateResults = (value: unknown): unknown => (
  stripPrivateKeys(value, PRIVATE_AGGREGATE_KEYS)
)

/** Response-status may include member names, but never their choices or prose. */
export const sanitizeResponseStatus = (value: unknown): unknown => (
  stripPrivateKeys(value, PRIVATE_RESPONSE_STATUS_KEYS)
)

export const hasScope = (scopes: readonly string[], required: DecisionAgentScope) => (
  scopes.includes(required)
)
