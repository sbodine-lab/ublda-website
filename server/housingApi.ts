import {
  buildGapLayer,
  buildOpportunityLayer,
  buildSupplyLayer,
  capabilityLabels,
  draftAvailabilityUpdate,
  draftCorrectionSubmission,
  draftPrivateReferral,
  draftProviderClaim,
  facilityTypeCapacityBands,
  filterFacilities,
  getAnalyticsForGeography,
  getFacilityProfile,
  getReviewQueue,
  sampleFacilities,
  scoreReferralFit,
} from '../src/lib/housingPlatform.ts'
import type {
  AvailabilityUpdateDraftInput,
  CorrectionSubmissionDraftInput,
  FacilityCapability,
  FacilityFilters,
  FacilityType,
  PrivateReferralDraftInput,
  ProviderClaimDraftInput,
  Referral,
  UserRole,
} from '../src/lib/housingPlatform.ts'

export type QueryValue = string | string[] | number | boolean | null | undefined

export interface HousingApiRequestLike {
  query?: Record<string, QueryValue>
  params?: Record<string, QueryValue>
  body?: unknown
  headers?: Record<string, QueryValue>
}

export type HousingApiPayload<T> = {
  ok: true
  status: number
  data: T
  meta?: Record<string, unknown>
} | {
  ok: false
  status: number
  error: string
  errors: string[]
}

const ok = <T>(
  data: T,
  status = 200,
  meta?: Record<string, unknown>,
): HousingApiPayload<T> => ({
  ok: true,
  status,
  data,
  ...(meta ? { meta } : {}),
})

const badRequest = <T>(errors: string[]): HousingApiPayload<T> => ({
  ok: false,
  status: 400,
  error: errors[0] || 'Invalid request',
  errors,
})

const notFound = <T>(message: string): HousingApiPayload<T> => ({
  ok: false,
  status: 404,
  error: message,
  errors: [message],
})

const bodyRecord = (body: unknown): Record<string, unknown> => (
  body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {}
)

const firstValue = (value: QueryValue | unknown) => {
  if (Array.isArray(value)) return value[0]
  return value
}

const stringValue = (value: QueryValue | unknown) => {
  const single = firstValue(value)
  if (typeof single === 'string') return single.trim()
  if (typeof single === 'number' || typeof single === 'boolean') return String(single)
  return ''
}

const numberValue = (value: QueryValue | unknown) => {
  const single = firstValue(value)
  if (typeof single === 'number' && Number.isFinite(single)) return single
  if (typeof single === 'string' && single.trim()) {
    const parsed = Number(single)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const booleanValue = (value: QueryValue | unknown) => {
  const single = firstValue(value)
  if (typeof single === 'boolean') return single
  if (typeof single !== 'string') return undefined
  const normalized = single.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false
  return undefined
}

const listValue = (value: QueryValue | unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item: QueryValue | unknown) => listValue(item)).filter(Boolean)
  }

  if (typeof value !== 'string') return []
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

const capabilitySet = new Set(Object.keys(capabilityLabels))
const facilityTypeSet = new Set(Object.keys(facilityTypeCapacityBands))
const roleSet = new Set<UserRole>([
  'public',
  'family',
  'provider',
  'cmhsp_staff',
  'pihp_admin',
  'state_admin',
  'platform_admin',
])
const urgencySet = new Set<Referral['urgency']>(['routine', 'soon', 'urgent'])

const asCapabilities = (value: QueryValue | unknown) => (
  listValue(value).filter((item): item is FacilityCapability => capabilitySet.has(item))
)

const asFacilityTypes = (value: QueryValue | unknown) => (
  listValue(value).filter((item): item is FacilityType => facilityTypeSet.has(item))
)

const asRole = (value: QueryValue | unknown, fallback: UserRole) => {
  const role = stringValue(value)
  return roleSet.has(role as UserRole) ? role as UserRole : fallback
}

const asUrgency = (value: QueryValue | unknown, fallback: Referral['urgency']) => {
  const urgency = stringValue(value)
  return urgencySet.has(urgency as Referral['urgency']) ? urgency as Referral['urgency'] : fallback
}

const parseFacilityFilters = (request: HousingApiRequestLike): FacilityFilters => {
  const query = request.query || {}
  const serviceFlags: FacilityFilters['serviceFlags'] = {}
  const acceptsCmhspReferrals = booleanValue(query.acceptsCmhspReferrals)
  const wheelchairAccessible = booleanValue(query.wheelchairAccessible)
  const servesDevelopmentalDisability = booleanValue(query.servesDevelopmentalDisability)

  if (acceptsCmhspReferrals !== undefined) {
    serviceFlags.acceptsCmhspReferrals = acceptsCmhspReferrals
  }
  if (wheelchairAccessible !== undefined) {
    serviceFlags.wheelchairAccessible = wheelchairAccessible
  }
  if (servesDevelopmentalDisability !== undefined) {
    serviceFlags.servesDevelopmentalDisability = servesDevelopmentalDisability
  }

  return {
    query: stringValue(query.q) || stringValue(query.query) || undefined,
    county: stringValue(query.county) || undefined,
    counties: listValue(query.counties),
    city: stringValue(query.city) || undefined,
    cmhsp: stringValue(query.cmhsp) || undefined,
    pihp: stringValue(query.pihp) || undefined,
    facilityTypes: asFacilityTypes(query.facilityTypes || query.facilityType),
    capabilities: asCapabilities(query.capabilities || query.capability),
    minAvailableBeds: numberValue(query.minAvailableBeds),
    acceptsReferrals: booleanValue(query.acceptsReferrals),
    maxConcernScore: numberValue(query.maxConcernScore),
    geographyId: stringValue(query.geographyId) || undefined,
    serviceFlags,
  }
}

const facilitySummary = (facilityId: string) => {
  const profile = getFacilityProfile(facilityId)
  if (!profile) return undefined
  const { facility } = profile

  return {
    id: facility.id,
    name: facility.name,
    facilityType: facility.licenseSnapshot.facilityType,
    facilityTypeLabel: facility.licenseSnapshot.facilityTypeLabel,
    city: facility.city,
    county: facility.county,
    cmhsp: facility.cmhsp,
    pihp: facility.pihp,
    capacity: facility.licenseSnapshot.capacity,
    availability: facility.availability,
    capabilities: facility.capabilities,
    scores: {
      ...facility.scores,
      referralFit: scoreReferralFit(facility, {
        county: facility.county,
        requestedCapabilities: facility.capabilities.slice(0, 3),
        needsOpenBed: true,
      }),
    },
    coordinates: {
      latitude: facility.latitude,
      longitude: facility.longitude,
    },
  }
}

const idFromRequest = (request: HousingApiRequestLike, keys: string[]) => {
  const body = bodyRecord(request.body)
  for (const key of keys) {
    const value = stringValue(request.params?.[key]) ||
      stringValue(request.query?.[key]) ||
      stringValue(body[key])
    if (value) return value
  }
  return ''
}

const requiredString = (
  body: Record<string, unknown>,
  key: string,
  errors: string[],
) => {
  const value = stringValue(body[key])
  if (!value) errors.push(`${key} is required`)
  return value
}

export const facilitiesSearchPayload = (request: HousingApiRequestLike = {}) => {
  const filters = parseFacilityFilters(request)
  const facilities = filterFacilities(filters)
    .map((facility) => facilitySummary(facility.id))
    .filter((facility): facility is NonNullable<typeof facility> => Boolean(facility))

  return ok({
    facilities,
    count: facilities.length,
    filters,
  }, 200, {
    sourcePlusClaim: 'License snapshots, provider overlays, user submissions, and AI extractions remain separate in facility profiles.',
  })
}

export const facilityProfilePayload = (request: HousingApiRequestLike = {}) => {
  const facilityId = idFromRequest(request, ['id', 'facilityId'])
  if (!facilityId) return badRequest(['facilityId is required'])

  const profile = getFacilityProfile(facilityId)
  if (!profile) return notFound(`Facility not found: ${facilityId}`)

  return ok(profile)
}

export const availabilityGetPayload = (request: HousingApiRequestLike = {}) => {
  const facilityId = idFromRequest(request, ['id', 'facilityId'])
  if (!facilityId) return badRequest(['facilityId is required'])

  const profile = getFacilityProfile(facilityId)
  if (!profile) return notFound(`Facility not found: ${facilityId}`)

  return ok({
    facilityId,
    availability: profile.facility.availability,
    providerClaims: profile.providerClaims.filter((claim) => (
      claim.subjectType === 'availability'
    )),
    licensingFactsUnchanged: true,
  })
}

export const availabilityPostPayload = (request: HousingApiRequestLike = {}) => {
  const body = bodyRecord(request.body)
  const errors: string[] = []
  const facilityId = idFromRequest(request, ['id', 'facilityId']) || requiredString(body, 'facilityId', errors)
  const bedsAvailable = numberValue(body.bedsAvailable)
  const acceptingReferrals = booleanValue(body.acceptingReferrals)

  if (bedsAvailable === undefined) errors.push('bedsAvailable is required')
  if (acceptingReferrals === undefined) errors.push('acceptingReferrals is required')
  if (!getFacilityProfile(facilityId)) errors.push(`Facility not found: ${facilityId}`)
  if (errors.length > 0 || bedsAvailable === undefined || acceptingReferrals === undefined) {
    return badRequest(errors)
  }

  const draft = draftAvailabilityUpdate({
    facilityId,
    bedsAvailable,
    acceptingReferrals,
    waitlistCount: numberValue(body.waitlistCount),
    averageWaitDays: numberValue(body.averageWaitDays),
    status: stringValue(body.status) as AvailabilityUpdateDraftInput['status'],
    notes: stringValue(body.notes) || undefined,
    submittedByName: stringValue(body.submittedByName) || undefined,
    submittedByRole: asRole(body.submittedByRole, 'provider'),
    now: stringValue(body.now) || undefined,
    expiresAt: stringValue(body.expiresAt) || undefined,
  })

  return ok(draft, 202)
}

export const supplyLayerPayload = () => ok({
  layer: 'supply',
  metrics: buildSupplyLayer(),
})

export const gapLayerPayload = () => ok({
  layer: 'gap',
  metrics: buildGapLayer(),
})

export const opportunityLayerPayload = () => ok({
  layer: 'opportunity',
  metrics: buildOpportunityLayer(),
})

export const geographyAnalyticsPayload = (request: HousingApiRequestLike = {}) => {
  const geographyId = idFromRequest(request, ['id', 'geographyId'])
  if (!geographyId) return badRequest(['geographyId is required'])
  return ok(getAnalyticsForGeography(geographyId))
}

export const providerClaimPayload = (request: HousingApiRequestLike = {}) => {
  const body = bodyRecord(request.body)
  const errors: string[] = []
  const input: ProviderClaimDraftInput = {
    facilityId: idFromRequest(request, ['id', 'facilityId']) || requiredString(body, 'facilityId', errors),
    field: requiredString(body, 'field', errors),
    value: body.value === undefined ? null : body.value as ProviderClaimDraftInput['value'],
    statement: requiredString(body, 'statement', errors),
    submittedByName: stringValue(body.submittedByName) || undefined,
    submittedByRole: asRole(body.submittedByRole, 'provider'),
    sourceUri: stringValue(body.sourceUri) || undefined,
    now: stringValue(body.now) || undefined,
  }

  if (!getFacilityProfile(input.facilityId)) errors.push(`Facility not found: ${input.facilityId}`)
  if (errors.length > 0) return badRequest(errors)

  return ok(draftProviderClaim(input), 202)
}

export const correctionSubmissionPayload = (request: HousingApiRequestLike = {}) => {
  const body = bodyRecord(request.body)
  const errors: string[] = []
  const input: CorrectionSubmissionDraftInput = {
    facilityId: idFromRequest(request, ['id', 'facilityId']) || requiredString(body, 'facilityId', errors),
    field: requiredString(body, 'field', errors),
    proposedValue: body.proposedValue === undefined ? null : body.proposedValue as CorrectionSubmissionDraftInput['proposedValue'],
    currentValue: body.currentValue === undefined ? undefined : body.currentValue as CorrectionSubmissionDraftInput['currentValue'],
    reason: requiredString(body, 'reason', errors),
    submittedByName: stringValue(body.submittedByName) || undefined,
    submittedByRole: asRole(body.submittedByRole, 'family'),
    now: stringValue(body.now) || undefined,
  }

  if (!getFacilityProfile(input.facilityId)) errors.push(`Facility not found: ${input.facilityId}`)
  if (errors.length > 0) return badRequest(errors)

  return ok(draftCorrectionSubmission(input), 202)
}

export const referralPayload = (request: HousingApiRequestLike = {}) => {
  const body = bodyRecord(request.body)
  const contact = bodyRecord(body.contact)
  const errors: string[] = []
  const residentCounty = requiredString(body, 'residentCounty', errors)
  const requestedCapabilities = asCapabilities(body.requestedCapabilities || body.capabilities)
  const urgency = asUrgency(body.urgency, 'routine')
  const facilityId = idFromRequest(request, ['id', 'facilityId']) || undefined

  if (requestedCapabilities.length === 0) errors.push('requestedCapabilities is required')
  if (facilityId && !getFacilityProfile(facilityId)) errors.push(`Facility not found: ${facilityId}`)
  if (errors.length > 0) return badRequest(errors)

  const input: PrivateReferralDraftInput = {
    facilityId,
    preferredCounty: stringValue(body.preferredCounty) || undefined,
    residentCounty,
    requestedCapabilities,
    urgency,
    consentToShare: booleanValue(body.consentToShare) || false,
    contact: {
      name: stringValue(contact.name) || undefined,
      email: stringValue(contact.email) || undefined,
      phone: stringValue(contact.phone) || undefined,
      relationship: stringValue(contact.relationship) || undefined,
    },
    privateNotes: stringValue(body.privateNotes) || undefined,
    createdByRole: asRole(body.createdByRole, 'family'),
    now: stringValue(body.now) || undefined,
  }

  return ok(draftPrivateReferral(input), 202)
}

export const adminReviewQueuePayload = () => ok({
  reviewQueue: getReviewQueue(),
  count: getReviewQueue().length,
})

export const housingApiCatalogPayload = () => ok({
  facilities: sampleFacilities.length,
  facilityTypeCapacityBands,
  capabilityLabels,
  endpoints: [
    'facilitiesSearchPayload',
    'facilityProfilePayload',
    'availabilityGetPayload',
    'availabilityPostPayload',
    'supplyLayerPayload',
    'gapLayerPayload',
    'opportunityLayerPayload',
    'geographyAnalyticsPayload',
    'providerClaimPayload',
    'correctionSubmissionPayload',
    'referralPayload',
    'adminReviewQueuePayload',
  ],
})

const methodNotAllowed = <T>(allowed: string[]): HousingApiPayload<T> => ({
  ok: false,
  status: 405,
  error: `Method not allowed. Use ${allowed.join(' or ')}.`,
  errors: [`Method not allowed. Use ${allowed.join(' or ')}.`],
})

const normalizeApiPath = (path: string) => {
  const trimmed = path.trim() || '/'
  const withoutApi = trimmed.startsWith('/api/') ? trimmed.slice(4) : trimmed
  const withoutHousing = withoutApi.startsWith('/housing') ? withoutApi.slice('/housing'.length) || '/' : withoutApi
  return withoutHousing.replace(/\/+$/, '') || '/'
}

export const housingApiPayloadForRoute = (
  method: string | undefined,
  path: string,
  request: HousingApiRequestLike = {},
): HousingApiPayload<unknown> => {
  const normalizedMethod = (method || 'GET').toUpperCase()
  const normalizedPath = normalizeApiPath(path)

  if (normalizedPath === '/' || normalizedPath === '/catalog') {
    if (normalizedMethod !== 'GET') return methodNotAllowed(['GET'])
    return housingApiCatalogPayload()
  }

  if (normalizedPath === '/facilities') {
    if (normalizedMethod !== 'GET') return methodNotAllowed(['GET'])
    return facilitiesSearchPayload(request)
  }

  const availabilityMatch = normalizedPath.match(/^\/facilities\/([^/]+)\/availability$/)
  if (availabilityMatch) {
    const routeRequest = {
      ...request,
      params: {
        ...request.params,
        facilityId: decodeURIComponent(availabilityMatch[1]),
      },
    }
    if (normalizedMethod === 'GET') return availabilityGetPayload(routeRequest)
    if (normalizedMethod === 'POST') return availabilityPostPayload(routeRequest)
    return methodNotAllowed(['GET', 'POST'])
  }

  const facilityMatch = normalizedPath.match(/^\/facilities\/([^/]+)$/)
  if (facilityMatch) {
    if (normalizedMethod !== 'GET') return methodNotAllowed(['GET'])
    return facilityProfilePayload({
      ...request,
      params: {
        ...request.params,
        facilityId: decodeURIComponent(facilityMatch[1]),
      },
    })
  }

  if (normalizedPath === '/map/layers/supply') {
    if (normalizedMethod !== 'GET') return methodNotAllowed(['GET'])
    return supplyLayerPayload()
  }

  if (normalizedPath === '/map/layers/gaps' || normalizedPath === '/map/layers/gap') {
    if (normalizedMethod !== 'GET') return methodNotAllowed(['GET'])
    return gapLayerPayload()
  }

  if (normalizedPath === '/map/layers/opportunity') {
    if (normalizedMethod !== 'GET') return methodNotAllowed(['GET'])
    return opportunityLayerPayload()
  }

  const geographyMatch = normalizedPath.match(/^\/analytics\/geographies\/([^/]+)$/)
  if (geographyMatch) {
    if (normalizedMethod !== 'GET') return methodNotAllowed(['GET'])
    return geographyAnalyticsPayload({
      ...request,
      params: {
        ...request.params,
        geographyId: decodeURIComponent(geographyMatch[1]),
      },
    })
  }

  if (normalizedPath === '/provider/claim-facility') {
    if (normalizedMethod !== 'POST') return methodNotAllowed(['POST'])
    return providerClaimPayload(request)
  }

  if (normalizedPath === '/submissions/facility-correction') {
    if (normalizedMethod !== 'POST') return methodNotAllowed(['POST'])
    return correctionSubmissionPayload(request)
  }

  if (normalizedPath === '/referrals') {
    if (normalizedMethod !== 'POST') return methodNotAllowed(['POST'])
    return referralPayload(request)
  }

  if (normalizedPath === '/admin/review-queue') {
    if (normalizedMethod !== 'GET') return methodNotAllowed(['GET'])
    return adminReviewQueuePayload()
  }

  return {
    ok: false,
    status: 404,
    error: `Housing API route not found: ${normalizedPath}`,
    errors: [`Housing API route not found: ${normalizedPath}`],
  }
}
