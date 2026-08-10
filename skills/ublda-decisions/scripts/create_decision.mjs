#!/usr/bin/env node

import { randomUUID } from "node:crypto"

const usage = `Create and optionally publish a UBLDA decision.

Required:
  --title <question>
  --overview <context>

Optional:
  --response-type <yes_no_other|single_choice|ranked_choice|input_only>
  --option <label>                 Repeat for choice or ranked decisions
  --deadline <ISO-8601 instant>
  --time-zone <IANA zone>         Default: America/Detroit
  --minimum-turnout <integer>
  --approval-threshold <0..1>
  --results-visibility <after_response|after_close|admins_only> (default: after_response)
  --base-url <https://host>       Default: UBLDA_DECISION_BASE_URL or https://ublda.org
  --idempotency-key <safe-key>
  --draft-only
  --help
`

const args = process.argv.slice(2)
const values = new Map()
const options = []
let draftOnly = false

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === "--help") {
    process.stdout.write(usage)
    process.exit(0)
  }
  if (arg === "--draft-only") {
    draftOnly = true
    continue
  }
  if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`)
  const value = args[index + 1]
  if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${arg}`)
  index += 1
  if (arg === "--option") options.push(value)
  else values.set(arg.slice(2), value)
}

const required = (name) => {
  const value = values.get(name)?.trim()
  if (!value) throw new Error(`Missing required --${name}`)
  return value
}

const token = process.env.UBLDA_DECISION_TOKEN?.trim()
if (!token) {
  throw new Error("UBLDA_DECISION_TOKEN is not set. Create a personal key at https://ublda.org/decisions/integrations and store it in your local secret environment.")
}

const baseUrl = (values.get("base-url") || process.env.UBLDA_DECISION_BASE_URL || "https://ublda.org").replace(/\/+$/, "")
const parsedBase = new URL(baseUrl)
if (parsedBase.protocol !== "https:" && parsedBase.hostname !== "localhost" && parsedBase.hostname !== "127.0.0.1") {
  throw new Error("The decision API base URL must use HTTPS.")
}

const numeric = (name, parse) => {
  const raw = values.get(name)
  if (raw === undefined) return undefined
  const value = parse(raw)
  if (!Number.isFinite(value)) throw new Error(`Invalid --${name}`)
  return value
}

const responseType = values.get("response-type") || "yes_no_other"
const validTypes = new Set(["yes_no_other", "single_choice", "ranked_choice", "input_only"])
if (!validTypes.has(responseType)) throw new Error("Invalid --response-type")
if ((responseType === "single_choice" || responseType === "ranked_choice") && options.length < 2) {
  throw new Error(`${responseType} requires at least two --option values`)
}

const body = {
  title: required("title"),
  overview: required("overview"),
  responseType,
  timeZone: values.get("time-zone") || "America/Detroit",
  autoClose: false,
  resultsVisibility: values.get("results-visibility") || "after_response",
}

if (options.length) body.options = options.map((label) => ({ label }))
if (values.has("deadline")) body.deadline = values.get("deadline")

const minimumTurnout = numeric("minimum-turnout", Number.parseInt)
if (minimumTurnout !== undefined) body.minimumTurnout = minimumTurnout
const approvalThreshold = numeric("approval-threshold", Number.parseFloat)
if (approvalThreshold !== undefined) body.approvalThreshold = approvalThreshold

const baseKey = values.get("idempotency-key") || `codex-${randomUUID()}`
if (!/^[A-Za-z0-9._:-]{8,200}$/.test(baseKey)) throw new Error("Invalid --idempotency-key")

const request = async (path, { method = "GET", payload, idempotencyKey } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(payload ? { "content-type": "application/json" } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  const result = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }))
  if (!response.ok) {
    const message = result?.error?.message || result?.message || `HTTP ${response.status}`
    throw new Error(String(message))
  }
  return result
}

const draft = await request("/api/decision-agent/v1/decisions/drafts", {
  method: "POST",
  payload: body,
  idempotencyKey: baseKey,
})

const decisionId = String(draft.decisionId || "")
const slug = String(draft.slug || "")
if (!decisionId || !slug) throw new Error("The API did not return a decision ID and slug.")

let status = "draft"
if (!draftOnly) {
  const published = await request(`/api/decision-agent/v1/decisions/${encodeURIComponent(decisionId)}/publish`, {
    method: "POST",
    idempotencyKey: `${baseKey}-publish`.slice(0, 200),
  })
  status = String(published.status || "open")
}

process.stdout.write(`${JSON.stringify({
  decisionId,
  slug,
  status,
  shareUrl: `${baseUrl}/d/${encodeURIComponent(slug)}`,
  resultsUrl: `${baseUrl}/results`,
}, null, 2)}\n`)
