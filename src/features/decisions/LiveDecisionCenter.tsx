import { ClerkProvider, useAuth as useClerkAuth, useClerk, useSignIn } from "@clerk/react"
import {
  ConvexReactClient,
  useAction,
  useConvexAuth,
  useMutation,
  useQuery_experimental as useQueryState,
} from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { makeFunctionReference } from "convex/server"
import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { DecisionCenterRoutes } from "./DecisionCenterRoutes"
import { DecisionDataProvider } from "./DecisionDataProvider"
import {
  ballotInputForBackend,
  decisionInputForBackend,
  mapAgentKeys,
  mapDecisionDetail,
  mapDecisionSummary,
  mapIndividualResponses,
  mapMembers,
  mapOwnResponse,
  type BackendAdminMember,
  type BackendAgentKey,
  type BackendAggregateResults,
  type BackendCreateDecisionResult,
  type BackendCreatedAgentKey,
  type BackendDecisionActivity,
  type BackendDecisionDetail,
  type BackendEligibleMember,
  type BackendSubmitResult,
  type BackendWorkspaceSnapshot,
} from "./liveContracts"
import {
  createLiveDecisionAdapter,
  type MutableLiveDecisionAdapter,
} from "./liveAdapter"
import type {
  BallotAnswer,
  CreateDecisionInput,
  DecisionActivity,
  DecisionCenterSnapshot,
  DecisionRecord,
  DecisionSignInCredentials,
} from "./types"
import { AvailabilityDataProvider } from "@/features/availability/AvailabilityDataProvider"
import {
  createLiveAvailabilityAdapter,
  type MutableLiveAvailabilityAdapter,
} from "@/features/availability/liveAdapter"
import {
  mapAvailabilityDetail,
  mapAvailabilitySummary,
  type BackendAvailabilityDetail,
  type BackendAvailabilitySummary,
} from "@/features/availability/liveContracts"
import type {
  AvailabilitySnapshot,
  CreateAvailabilityPollInput,
} from "@/features/availability/types"

type EmptyArgs = Record<string, never>
type BackendDraftInput = ReturnType<typeof decisionInputForBackend>
type BackendBallotInput = ReturnType<typeof ballotInputForBackend>

const claimIdentityRef = makeFunctionReference<"mutation", EmptyArgs, string>(
  "members:claimApprovedIdentity",
)
const bootstrapIdentityRef = makeFunctionReference<"mutation", EmptyArgs, unknown>(
  "members:bootstrapCurrentIdentity",
)
const workspaceRef = makeFunctionReference<"query", EmptyArgs, BackendWorkspaceSnapshot>(
  "workspace:workspaceSnapshot",
)
const detailRef = makeFunctionReference<"query", { slug: string }, BackendDecisionDetail>(
  "decisions:getBySlug",
)
const resultsRef = makeFunctionReference<
  "query",
  { decisionId?: string; slug?: string },
  BackendAggregateResults
>("results:get")
const activityRef = makeFunctionReference<
  "query",
  { decisionId: string; limit?: number },
  BackendDecisionActivity[]
>("decisions:activity")
const eligibleMembersRef = makeFunctionReference<"query", EmptyArgs, BackendEligibleMember[]>(
  "members:eligible",
)
const adminMembersRef = makeFunctionReference<
  "query",
  { includeInactive?: boolean },
  BackendAdminMember[]
>("members:list")
const agentKeysRef = makeFunctionReference<"query", EmptyArgs, BackendAgentKey[]>(
  "agentKeys:list",
)

const createDecisionRef = makeFunctionReference<
  "mutation",
  { input: BackendDraftInput },
  BackendCreateDecisionResult
>("decisions:create")
const publishDecisionRef = makeFunctionReference<
  "mutation",
  { decisionId: string },
  unknown
>("decisions:publish")
const closeDecisionRef = makeFunctionReference<
  "mutation",
  { decisionId: string; reason?: string },
  unknown
>("decisions:close")
const reopenDecisionRef = makeFunctionReference<
  "mutation",
  { decisionId: string; reason: string; deadlineAt?: number; clearDeadline?: boolean },
  unknown
>("decisions:reopen")
const finalizeDecisionRef = makeFunctionReference<
  "mutation",
  { decisionId: string; outcomeOptionId?: string; outcomeText?: string; note?: string },
  unknown
>("decisions:finalize")
const submitBallotRef = makeFunctionReference<
  "mutation",
  { decisionId: string; input: BackendBallotInput },
  BackendSubmitResult
>("ballots:submit")
const upsertMemberRef = makeFunctionReference<
  "mutation",
  {
    memberId?: string
    displayName: string
    role: "admin" | "member"
    status?: "active" | "inactive"
    approvedEmails?: string[]
  },
  string
>("members:upsertMember")
const createAgentKeyRef = makeFunctionReference<
  "action",
  {
    name: string
    scopes: Array<"decisions:read" | "decisions:write" | "decisions:publish" | "decisions:manage" | "results:read">
    expiresAt?: number
    rateLimitPerMinute?: number
  },
  BackendCreatedAgentKey
>("agentKeys:createAgentKey")
const revokeAgentKeyRef = makeFunctionReference<
  "mutation",
  { agentKeyId: string },
  unknown
>("agentKeys:revokeAgentKey")
const availabilityListRef = makeFunctionReference<"query", EmptyArgs, BackendAvailabilitySummary[]>(
  "availability:list",
)
const availabilityDetailRef = makeFunctionReference<
  "query",
  { slug: string },
  BackendAvailabilityDetail
>("availability:getBySlug")
const createAvailabilityRef = makeFunctionReference<
  "mutation",
  {
    input: {
      title: string
      note?: string
      durationMinutes: number
      dateKeys: string[]
      startMinutes: number
      endMinutes: number
      timezone?: string
      electorateMemberIds?: string[]
      deadlineAt?: number
      resultsVisibility?: "after_submit" | "admins_only"
    }
  },
  { pollId: string; slug: string }
>("availability:create")
const saveAvailabilityRef = makeFunctionReference<
  "mutation",
  { pollId: string; availableSlotKeys: string[] },
  { availableSlotKeys: string[]; savedAt: number }
>("availability:saveResponse")
const finalizeAvailabilityRef = makeFunctionReference<
  "mutation",
  { pollId: string; dateKey: string; startMinutes: number },
  unknown
>("availability:finalize")

const convexClients = new Map<string, ConvexReactClient>()

function convexClientFor(url: string) {
  const existing = convexClients.get(url)
  if (existing) return existing
  const client = new ConvexReactClient(url)
  convexClients.set(url, client)
  return client
}

function cleanConvexError(caught: unknown, fallback: string): string {
  if (!(caught instanceof Error)) return fallback
  const encoded = caught.message.match(/\{"code":"[^"]+","message":"((?:\\.|[^"])*)"\}/)
  if (encoded) {
    try {
      return JSON.parse(`"${encoded[1]}"`) as string
    } catch {
      return fallback
    }
  }
  if (!caught.message.includes("Request ID") && caught.message.length <= 240) {
    return caught.message
  }
  return fallback
}

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => withoutUndefined(item)) as T
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)]),
    ) as T
  }
  return value
}

function pathSlug(pathname: string, stateSlug?: string): { slug?: string; currentRoute: boolean; resultsRoute: boolean } {
  const currentRoute = pathname === "/decision" || pathname === "/results"
  const ballotMatch = pathname.match(/^\/d\/([^/]+)$/)
  const resultMatch = pathname.match(/^\/decisions\/([^/]+)\/results$/)
  const encoded = ballotMatch?.[1] ?? resultMatch?.[1] ?? (pathname === "/results" ? stateSlug : undefined)
  if (!encoded) return { currentRoute, resultsRoute: pathname === "/results" }
  try {
    return { slug: decodeURIComponent(encoded), currentRoute, resultsRoute: Boolean(resultMatch) }
  } catch {
    return { currentRoute, resultsRoute: Boolean(resultMatch) }
  }
}

function availabilityPathSlug(pathname: string): { slug?: string; currentRoute: boolean } {
  const publicMatch = pathname.match(/^\/s\/([^/]+)(?:\/results)?$/)
  const workspaceMatch = pathname.match(/^\/scheduling\/([^/]+)\/results$/)
  const encoded = publicMatch?.[1] ?? workspaceMatch?.[1]
  if (!encoded) return { currentRoute: pathname === "/schedule" || pathname === "/scheduling" }
  try {
    return { slug: decodeURIComponent(encoded), currentRoute: false }
  } catch {
    return { currentRoute: false }
  }
}

function activityType(action: string): DecisionActivity["type"] | undefined {
  const types: Record<string, DecisionActivity["type"]> = {
    "decision.created": "created",
    "decision.published": "published",
    "decision.closed": "closed",
    "decision.reopened": "reopened",
    "decision.finalized": "finalized",
  }
  return types[action]
}

function activityDetail(action: string): string {
  const details: Record<string, string> = {
    "decision.created": "Created the decision.",
    "decision.published": "Opened the decision for responses.",
    "decision.closed": "Closed responses.",
    "decision.reopened": "Reopened responses.",
    "decision.finalized": "Recorded the final outcome.",
  }
  return details[action] ?? "Updated the decision."
}

type MembershipState =
  | { status: "idle" | "ready" }
  | { status: "denied"; message: string }

function LiveDecisionBridge({
  adapter,
  availabilityAdapter,
}: {
  adapter: MutableLiveDecisionAdapter
  availabilityAdapter: MutableLiveAvailabilityAdapter
}) {
  const clerk = useClerk()
  const clerkAuth = useClerkAuth()
  const { signIn: clerkSignIn } = useSignIn()
  const convexAuth = useConvexAuth()
  const location = useLocation()
  const stateSlug = location.state && typeof location.state === "object" && "decisionSlug" in location.state
    ? String(location.state.decisionSlug)
    : undefined
  const route = pathSlug(location.pathname, stateSlug)
  const availabilityRoute = availabilityPathSlug(location.pathname)
  const [membership, setMembership] = useState<MembershipState>({ status: "idle" })
  const attemptedRef = useRef(false)
  const attemptGenerationRef = useRef(0)

  const claimIdentity = useMutation(claimIdentityRef)
  const bootstrapIdentity = useMutation(bootstrapIdentityRef)
  const createDecisionMutation = useMutation(createDecisionRef)
  const publishDecisionMutation = useMutation(publishDecisionRef)
  const closeDecisionMutation = useMutation(closeDecisionRef)
  const reopenDecisionMutation = useMutation(reopenDecisionRef)
  const finalizeDecisionMutation = useMutation(finalizeDecisionRef)
  const submitBallotMutation = useMutation(submitBallotRef)
  const upsertMemberMutation = useMutation(upsertMemberRef)
  const createAgentKeyAction = useAction(createAgentKeyRef)
  const revokeAgentKeyMutation = useMutation(revokeAgentKeyRef)
  const createAvailabilityMutation = useMutation(createAvailabilityRef)
  const saveAvailabilityMutation = useMutation(saveAvailabilityRef)
  const finalizeAvailabilityMutation = useMutation(finalizeAvailabilityRef)

  useEffect(() => {
    if (
      !clerkAuth.isLoaded
      || !clerkAuth.isSignedIn
      || convexAuth.isLoading
      || !convexAuth.isAuthenticated
      || attemptedRef.current
    ) return

    attemptedRef.current = true
    const generation = ++attemptGenerationRef.current
    void (async () => {
      try {
        await claimIdentity({})
        if (attemptGenerationRef.current === generation) setMembership({ status: "ready" })
        return
      } catch {
        // The first approved administrator may initialize a completely empty
        // workspace. Convex independently checks BOOTSTRAP_ADMIN_EMAILS.
      }
      try {
        await bootstrapIdentity({})
        if (attemptGenerationRef.current === generation) setMembership({ status: "ready" })
      } catch {
        if (attemptGenerationRef.current === generation) {
          setMembership({
            status: "denied",
            message: "Use an email that an administrator has added to your roster profile, or ask an administrator to approve this account.",
          })
        }
      }
    })()
  }, [
    bootstrapIdentity,
    claimIdentity,
    clerkAuth.isLoaded,
    clerkAuth.isSignedIn,
    convexAuth.isAuthenticated,
    convexAuth.isLoading,
  ])

  const ready = membership.status === "ready"
  const workspaceState = useQueryState({ query: workspaceRef, args: ready ? {} : "skip" })
  const workspace = workspaceState.status === "success" ? workspaceState.data : undefined
  const currentRouteSlug = route.currentRoute
    ? [...(workspace?.decisions ?? [])]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .find((decision) => decision.status === "open")?.slug
      ?? [...(workspace?.decisions ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.slug
    : undefined
  const resolvedRouteSlug = route.slug ?? currentRouteSlug
  const detailState = useQueryState({
    query: detailRef,
    args: ready && resolvedRouteSlug ? { slug: resolvedRouteSlug } : "skip",
  })
  const detail = detailState.status === "success" ? detailState.data : undefined
  const resultsAllowed = Boolean(
    route.resultsRoute
    && detail
    && (
      detail.canManage
      || detail.resultsVisibility === "after_close"
        && (detail.status === "closed" || detail.status === "finalized")
      || detail.resultsVisibility === "after_submit" && detail.myResponse?.isCurrent !== false && detail.myResponse
    ),
  )
  const resultsState = useQueryState({
    query: resultsRef,
    args: ready && detail && resultsAllowed ? { decisionId: detail._id } : "skip",
  })
  const results = resultsState.status === "success" ? resultsState.data : undefined
  const activityState = useQueryState({
    query: activityRef,
    args: ready && route.resultsRoute && detail?.canManage
      ? { decisionId: detail._id, limit: 50 }
      : "skip",
  })
  const eligibleMembersState = useQueryState({
    query: eligibleMembersRef,
    args: ready ? {} : "skip",
  })
  const adminMembersState = useQueryState({
    query: adminMembersRef,
    args: ready && workspace?.viewer.role === "admin" ? { includeInactive: true } : "skip",
  })
  const agentKeysState = useQueryState({
    query: agentKeysRef,
    args: ready ? {} : "skip",
  })
  const availabilityListState = useQueryState({
    query: availabilityListRef,
    args: ready ? {} : "skip",
  })
  const availabilityRows = useMemo(() => (
    availabilityListState.status === "success" ? availabilityListState.data : []
  ), [availabilityListState])
  const resolvedAvailabilitySlug = availabilityRoute.slug
    ?? (availabilityRoute.currentRoute ? availabilityRows[0]?.slug : undefined)
  const availabilityDetailState = useQueryState({
    query: availabilityDetailRef,
    args: ready && resolvedAvailabilitySlug ? { slug: resolvedAvailabilitySlug } : "skip",
  })
  const availabilityDetail = availabilityDetailState.status === "success"
    ? availabilityDetailState.data
    : undefined

  const snapshot = useMemo<DecisionCenterSnapshot>(() => {
    let auth: DecisionCenterSnapshot["auth"]
    if (!clerkAuth.isLoaded || convexAuth.isLoading) {
      auth = { status: "loading" }
    } else if (!clerkAuth.isSignedIn) {
      auth = { status: "signed-out" }
    } else if (!convexAuth.isAuthenticated) {
      auth = {
        status: "misconfigured",
        message: "Sign-in completed, but the Decision Center could not verify its Convex authentication setup.",
      }
    } else if (membership.status === "denied") {
      auth = { status: "access-denied", message: membership.message }
    } else if (
      membership.status !== "ready"
      || workspaceState.status === "pending"
      || resolvedRouteSlug && detailState.status === "pending"
      || resultsAllowed && resultsState.status === "pending"
    ) {
      auth = { status: "loading" }
    } else if (
      workspaceState.status === "error"
      || resultsAllowed && resultsState.status === "error"
    ) {
      auth = {
        status: "misconfigured",
        message: "The private Decision Center data service could not be loaded. Ask an administrator to check the Clerk and Convex setup.",
      }
    } else if (workspace) {
      auth = { status: "signed-in", viewer: workspace.viewer }
    } else {
      auth = { status: "loading" }
    }

    const decisions = workspace?.decisions.map((decision) => (
      mapDecisionSummary(decision, workspace.viewer.memberId)
    )) ?? []
    if (detail && workspace) {
      const mapped = mapDecisionDetail(
        detail,
        workspace.decisions.find((decision) => decision.decisionId === detail._id),
        results,
        workspace.viewer.memberId,
      )
      const index = decisions.findIndex((decision) => decision.id === mapped.id)
      if (index >= 0) decisions[index] = mapped
      else decisions.unshift(mapped)
    }

    const eligibleMembers = eligibleMembersState.status === "success"
      ? eligibleMembersState.data
      : []
    const adminMembers = adminMembersState.status === "success"
      ? adminMembersState.data
      : undefined
    const members = mapMembers(eligibleMembers, adminMembers)
    if (results) {
      const namedRows = [
        ...(results.missing ?? []),
        ...(results.individualResponses ?? []).map((response) => ({
          memberId: response.memberId,
          displayName: response.displayName,
        })),
      ]
      for (const row of namedRows) {
        if (members.some((member) => member.id === row.memberId)) continue
        members.push({
          id: row.memberId,
          displayName: row.displayName,
          role: "member",
          identityAliases: [],
          active: false,
        })
      }
    }

    const responses = detail && workspace
      ? [
          ...mapIndividualResponses(detail, results),
          ...(() => {
            const own = mapOwnResponse(detail, workspace.viewer.memberId)
            return own ? [own] : []
          })(),
        ]
      : []
    const responseById = new Map(responses.map((response) => [response.id, response]))

    const activity = activityState.status === "success" && detail
      ? activityState.data.flatMap((event) => {
          const type = activityType(event.action)
          if (!type) return []
          return [{
            id: event.eventId,
            decisionId: detail._id,
            actorMemberId: `actor-${event.eventId}`,
            actorDisplayName: event.actorDisplayName,
            type,
            at: new Date(event.createdAt).toISOString(),
            detail: activityDetail(event.action),
          } satisfies DecisionActivity]
        })
      : []

    return {
      auth,
      decisions,
      members,
      responses: [...responseById.values()],
      activity,
      agentKeys: agentKeysState.status === "success" ? mapAgentKeys(agentKeysState.data) : [],
    }
  }, [
    activityState,
    adminMembersState,
    clerkAuth.isLoaded,
    clerkAuth.isSignedIn,
    convexAuth.isAuthenticated,
    convexAuth.isLoading,
    detail,
    detailState.status,
    eligibleMembersState,
    agentKeysState,
    membership,
    results,
    resultsAllowed,
    resultsState.status,
    resolvedRouteSlug,
    workspace,
    workspaceState.status,
  ])

  useEffect(() => {
    adapter.replaceSnapshot(snapshot)
  }, [adapter, snapshot])

  const availabilitySnapshot = useMemo<AvailabilitySnapshot>(() => ({
    polls: availabilityRows.map(mapAvailabilitySummary),
    activePoll: availabilityDetail
      ? mapAvailabilityDetail(
          availabilityDetail,
          availabilityRows.find((row) => row.slug === availabilityDetail.slug),
        )
      : undefined,
    loading: membership.status === "ready" && (
      availabilityListState.status === "pending"
      || Boolean(resolvedAvailabilitySlug) && availabilityDetailState.status === "pending"
    ),
    error: availabilityListState.status === "error" || availabilityDetailState.status === "error"
      ? "Scheduling could not be loaded."
      : undefined,
  }), [
    availabilityDetail,
    availabilityDetailState.status,
    availabilityListState.status,
    availabilityRows,
    membership.status,
    resolvedAvailabilitySlug,
  ])

  useEffect(() => {
    availabilityAdapter.replaceSnapshot(availabilitySnapshot)
  }, [availabilityAdapter, availabilitySnapshot])

  const operations = useMemo(() => ({
    async signIn(credentials: DecisionSignInCredentials) {
      const { error } = await clerkSignIn.password({
        emailAddress: credentials.email.trim(),
        password: credentials.password,
      })
      if (error) throw new Error("The email or password is incorrect.")

      if (clerkSignIn.status === "complete") {
        const { error: finalizeError } = await clerkSignIn.finalize()
        if (finalizeError) throw new Error("Sign-in could not be completed.")
        return { status: "complete" as const }
      }

      if (clerkSignIn.status === "needs_second_factor" || clerkSignIn.status === "needs_client_trust") {
        const emailFactor = clerkSignIn.supportedSecondFactors.find((factor) => factor.strategy === "email_code")
        if (!emailFactor) throw new Error("This account requires a sign-in method that is not available here.")
        const { error: codeError } = await clerkSignIn.mfa.sendEmailCode()
        if (codeError) throw new Error("A verification code could not be sent.")
        return { status: "needs-verification" as const }
      }

      throw new Error("Sign-in could not be completed.")
    },
    async verifySignInCode(code: string) {
      const { error } = await clerkSignIn.mfa.verifyEmailCode({ code: code.trim() })
      if (error) throw new Error("That verification code is incorrect.")
      if (clerkSignIn.status !== "complete") throw new Error("Sign-in could not be completed.")
      const { error: finalizeError } = await clerkSignIn.finalize()
      if (finalizeError) throw new Error("Sign-in could not be completed.")
    },
    async signOut() {
      await clerk.signOut({ redirectUrl: window.location.href })
    },
    async submitResponse(decisionId: string, answer: BallotAnswer, rationale?: string) {
      const current = adapter.getSnapshot()
      const decision = current.decisions.find((item) => item.id === decisionId)
      const viewer = current.auth.status === "signed-in" ? current.auth.viewer : undefined
      if (!decision || !viewer) throw new Error("The decision is not ready.")
      try {
        const saved = await submitBallotMutation(withoutUndefined({
          decisionId,
          input: ballotInputForBackend(decision, answer, rationale),
        }))
        return {
          id: saved.ballotId,
          decisionId,
          memberId: viewer.memberId,
          answer,
          rationale: rationale?.trim() || undefined,
          submittedAt: new Date(saved.submittedAt).toISOString(),
          revisedAt: new Date(saved.updatedAt).toISOString(),
          confirmedRevision: decision.revision,
        }
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "Your response could not be saved."))
      }
    },
    async createDecision(input: CreateDecisionInput): Promise<DecisionRecord> {
      const current = adapter.getSnapshot()
      const viewer = current.auth.status === "signed-in" ? current.auth.viewer : undefined
      if (!viewer) throw new Error("Sign in to create a decision.")
      try {
        const created = await createDecisionMutation(withoutUndefined({
          input: decisionInputForBackend(input),
        }))
        if (input.status === "open") {
          await publishDecisionMutation({ decisionId: created.decisionId })
        }
        const now = new Date().toISOString()
        return {
          id: created.decisionId,
          slug: created.slug,
          title: input.title,
          overview: input.overview,
          contextPoints: input.contextPoints,
          status: input.status,
          ballotType: input.ballotType,
          options: [],
          allowOther: input.allowOther,
          electorateMemberIds: input.electorateMemberIds,
          creatorMemberId: viewer.memberId,
          createdAt: now,
          updatedAt: now,
          deadline: input.deadline,
          timezone: input.timezone,
          autoClose: input.autoClose,
          revision: 1,
          rules: input.rules,
          eligibleCount: input.electorateMemberIds.length,
          responseCount: 0,
          isEligible: input.electorateMemberIds.includes(viewer.memberId),
          canManage: true,
        }
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "The decision could not be created."))
      }
    },
    async closeDecision(decisionId: string) {
      try {
        await closeDecisionMutation({
          decisionId,
          reason: "Closed by the decision owner from the Decision Center.",
        })
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "The decision could not be closed."))
      }
    },
    async reopenDecision(decisionId: string) {
      try {
        await reopenDecisionMutation({
          decisionId,
          reason: "Reopened by the decision owner from the Decision Center.",
          clearDeadline: true,
        })
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "The decision could not be reopened."))
      }
    },
    async finalizeDecision(decisionId: string, outcome: string, note?: string) {
      try {
        await finalizeDecisionMutation(withoutUndefined({
          decisionId,
          outcomeText: outcome,
          note: note?.trim() || undefined,
        }))
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "The final outcome could not be recorded."))
      }
    },
    async upsertMember(input: {
      id?: string
      displayName: string
      role: "admin" | "member"
      identityAliases: string[]
      active: boolean
    }) {
      try {
        const memberId = await upsertMemberMutation(withoutUndefined({
          memberId: input.id,
          displayName: input.displayName,
          role: input.role,
          status: input.active ? "active" as const : "inactive" as const,
          approvedEmails: input.identityAliases,
        }))
        return { ...input, id: memberId }
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "The member could not be saved."))
      }
    },
    async createAgentKey(input: {
      name: string
      scopes: Array<"decisions:read" | "decisions:write" | "decisions:publish" | "decisions:manage" | "results:read">
      expiresAt?: string
    }) {
      try {
        const created = await createAgentKeyAction(withoutUndefined({
          name: input.name,
          scopes: input.scopes,
          expiresAt: input.expiresAt ? new Date(input.expiresAt).getTime() : undefined,
        }))
        return {
          record: {
            id: created.agentKeyId,
            name: created.name,
            prefix: created.prefix,
            scopes: created.scopes,
            createdAt: new Date(created.createdAt).toISOString(),
            expiresAt: created.expiresAt === null
              ? undefined
              : new Date(created.expiresAt).toISOString(),
          },
          secret: created.token,
        }
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "The agent key could not be created."))
      }
    },
    async revokeAgentKey(agentKeyId: string) {
      try {
        await revokeAgentKeyMutation({ agentKeyId })
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "The agent key could not be revoked."))
      }
    },
  }), [
    adapter,
    clerk,
    clerkSignIn,
    closeDecisionMutation,
    createAgentKeyAction,
    createDecisionMutation,
    finalizeDecisionMutation,
    publishDecisionMutation,
    reopenDecisionMutation,
    revokeAgentKeyMutation,
    submitBallotMutation,
    upsertMemberMutation,
  ])

  const availabilityOperations = useMemo(() => ({
    async createPoll(input: CreateAvailabilityPollInput) {
      try {
        const created = await createAvailabilityMutation(withoutUndefined({
          input: {
            title: input.title,
            note: input.note?.trim() || undefined,
            durationMinutes: input.durationMinutes,
            dateKeys: input.dateKeys,
            startMinutes: input.startMinutes,
            endMinutes: input.endMinutes,
            timezone: input.timezone,
            electorateMemberIds: input.electorateMemberIds,
            deadlineAt: input.deadline ? new Date(input.deadline).getTime() : undefined,
            resultsVisibility: input.resultsVisibility === "after-submit" ? "after_submit" as const : "admins_only" as const,
          },
        }))
        return { id: created.pollId, slug: created.slug }
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "The scheduling poll could not be created."))
      }
    },
    async saveResponse(pollId: string, slotKeys: string[]) {
      try {
        await saveAvailabilityMutation({ pollId, availableSlotKeys: slotKeys })
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "Your availability could not be saved."))
      }
    },
    async finalizePoll(pollId: string, dateKey: string, startMinutes: number) {
      try {
        await finalizeAvailabilityMutation({ pollId, dateKey, startMinutes })
      } catch (caught) {
        throw new Error(cleanConvexError(caught, "The meeting time could not be chosen."))
      }
    },
  }), [createAvailabilityMutation, finalizeAvailabilityMutation, saveAvailabilityMutation])

  useEffect(() => {
    adapter.replaceOperations(operations)
  }, [adapter, operations])

  useEffect(() => {
    availabilityAdapter.replaceOperations(availabilityOperations)
  }, [availabilityAdapter, availabilityOperations])

  return (
    <AvailabilityDataProvider adapter={availabilityAdapter}>
      <DecisionDataProvider adapter={adapter}>
        <DecisionCenterRoutes />
      </DecisionDataProvider>
    </AvailabilityDataProvider>
  )
}

function SessionScopedLiveDecisionBridge({
  adapter,
  availabilityAdapter,
}: {
  adapter: MutableLiveDecisionAdapter
  availabilityAdapter: MutableLiveAvailabilityAdapter
}) {
  const { sessionId } = useClerkAuth()
  return <LiveDecisionBridge key={sessionId ?? "signed-out"} adapter={adapter} availabilityAdapter={availabilityAdapter} />
}

export function LiveDecisionCenter({
  clerkPublishableKey,
  convexUrl,
}: {
  clerkPublishableKey: string
  convexUrl: string
}) {
  const adapter = useMemo(() => createLiveDecisionAdapter(), [])
  const availabilityAdapter = useMemo(() => createLiveAvailabilityAdapter(), [])
  const client = convexClientFor(convexUrl)

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      appearance={{
        variables: {
          colorPrimary: "#0F2B3C",
          borderRadius: "8px",
        },
      }}
    >
      <ConvexProviderWithClerk client={client} useAuth={useClerkAuth}>
        <SessionScopedLiveDecisionBridge adapter={adapter} availabilityAdapter={availabilityAdapter} />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
