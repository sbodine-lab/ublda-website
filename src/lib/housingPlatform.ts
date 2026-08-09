export type FacilityType =
  | 'adult-foster-care-family-home'
  | 'adult-foster-care-small-group-home'
  | 'adult-foster-care-medium-group-home'
  | 'adult-foster-care-large-group-home'
  | 'adult-foster-care-congregate-facility'
  | 'home-for-the-aged'

export type FacilityLicenseStatus =
  | 'active'
  | 'provisional'
  | 'closed'
  | 'suspended'
  | 'revoked'
  | 'unknown'

export type FacilityCapability =
  | 'autism-informed-supports'
  | 'awake-overnight-staff'
  | 'behavior-support'
  | 'co-occurring-mental-health'
  | 'communication-device-support'
  | 'community-employment-support'
  | 'complex-medical-coordination'
  | 'de-escalation-trained-staff'
  | 'limited-mobility-evacuation'
  | 'medication-administration'
  | 'sensory-friendly-space'
  | 'traumatic-brain-injury-support'
  | 'transportation'
  | 'two-person-transfer'
  | 'wheelchair-accessible'

export type UserRole =
  | 'public'
  | 'family'
  | 'provider'
  | 'cmhsp_staff'
  | 'pihp_admin'
  | 'state_admin'
  | 'platform_admin'

export type ClaimValue =
  | string
  | number
  | boolean
  | string[]
  | null

export type ClaimType =
  | 'licensing_fact'
  | 'provider_overlay'
  | 'user_submission'
  | 'ai_extracted'
  | 'admin_note'

export type ClaimSourceKind =
  | 'lara_license_snapshot'
  | 'provider_attestation'
  | 'user_submission'
  | 'ai_document_extraction'
  | 'platform_seed'
  | 'admin_entry'

export type ClaimStatus =
  | 'verified'
  | 'pending_review'
  | 'needs_source'
  | 'rejected'
  | 'superseded'

export type ReviewRecordType =
  | 'provider_claim'
  | 'availability_update'
  | 'correction_submission'
  | 'private_referral'

export type ReviewStatus =
  | 'queued'
  | 'in_review'
  | 'approved'
  | 'rejected'

export type GeographyType = 'state' | 'county' | 'cmhsp' | 'pihp'

export type MapLayer = 'supply' | 'gap' | 'opportunity'

export interface Organization {
  id: string
  name: string
  organizationType:
    | 'licensee'
    | 'provider_network'
    | 'cmhsp'
    | 'pihp'
    | 'state_agency'
    | 'advocacy'
  county?: string
  website?: string
  phone?: string
  contactEmail?: string
  sourceDocumentIds: string[]
}

export interface FacilityTypeCapacityBand {
  facilityType: FacilityType
  laraLabel: string
  minCapacity: number
  maxCapacity: number | null
  notes?: string
}

export interface FacilityServiceFlags {
  servesDevelopmentalDisability: boolean
  servesMentalIllness: boolean
  servesPhysicalDisability: boolean
  servesAged: boolean
  servesTraumaticBrainInjury: boolean
  specializedProgramForDevelopmentalDisability: boolean
  specializedProgramForMentalIllness: boolean
  acceptsCmhspReferrals: boolean
  acceptsMedicaidPersonalCareSupplement: boolean
  supportsSelfDeterminationArrangements: boolean
  providesTransportation: boolean
  wheelchairAccessible: boolean
}

export interface FacilityLicenseSnapshot {
  id: string
  facilityId: string
  licenseNumber: string
  licenseStatus: FacilityLicenseStatus
  facilityType: FacilityType
  facilityTypeLabel: string
  licenseeOrganizationId: string
  capacity: number
  licensingCounty: string
  effectiveDate: string
  expirationDate?: string
  lastVerifiedAt: string
  sourceDocumentIds: string[]
  isSampleData: boolean
  notes?: string
}

export interface AvailabilitySnapshot {
  id: string
  facilityId: string
  status: 'open' | 'limited' | 'waitlist' | 'unknown'
  totalCapacity: number
  bedsAvailable: number
  acceptingReferrals: boolean
  waitlistCount: number
  averageWaitDays: number
  reportedAt: string
  expiresAt: string
  sourceDocumentIds: string[]
  sourceClaimIds: string[]
  notes?: string
}

export interface StaffingSnapshot {
  id: string
  facilityId: string
  reportedAt: string
  daytimeStaffRatio: string
  overnightStaffRatio: string
  awakeOvernightStaff: boolean
  licensedNurseOnCall: boolean
  trainingHighlights: FacilityCapability[]
  sourceDocumentIds: string[]
  sourceClaimIds: string[]
}

export interface ComplianceEvent {
  id: string
  facilityId: string
  eventDate: string
  eventType:
    | 'inspection'
    | 'corrective_action'
    | 'complaint'
    | 'enforcement'
    | 'self_report'
  severity: 'low' | 'moderate' | 'high'
  status: 'open' | 'corrected' | 'closed' | 'monitoring'
  summary: string
  sourceDocumentIds: string[]
  claimIds: string[]
}

export interface SourceDocument {
  id: string
  title: string
  publisher: string
  sourceType:
    | 'official'
    | 'provider'
    | 'user_submission'
    | 'ai_extraction'
    | 'platform_seed'
  uri?: string
  publishedAt?: string
  retrievedAt: string
  description?: string
}

export interface Claim {
  id: string
  subjectType:
    | 'facility'
    | 'organization'
    | 'availability'
    | 'staffing'
    | 'compliance'
    | 'referral'
  facilityId?: string
  organizationId?: string
  claimType: ClaimType
  sourceKind: ClaimSourceKind
  field: string
  statement: string
  value: ClaimValue
  normalizedValue?: ClaimValue
  sourceDocumentId?: string
  submittedByRole: UserRole
  submittedByName?: string
  submittedAt: string
  status: ClaimStatus
  confidence: number
  reviewRequired: boolean
  visibility: 'public' | 'provider_review' | 'admin_only' | 'private_referral'
}

export interface DataQualityScore {
  overall: number
  licensingFreshness: number
  providerFreshness: number
  availabilityFreshness: number
  provenanceCompleteness: number
  conflictRisk: number
  lastScoredAt: string
  warnings: string[]
}

export interface FacilityScoreBreakdown {
  residentialSupply: number
  liveAvailability: number
  capabilityScarcity: number
  waitlistPressure: number
  freshness: number
  concern: number
  opportunity: number
}

export interface MapMetric {
  id: string
  layer: MapLayer
  geographyType: GeographyType
  geographyId: string
  label: string
  metric: string
  score: number
  facilityCount: number
  totalCapacity: number
  availableBeds: number
  waitlistCount: number
  sourceDocumentIds: string[]
  updatedAt: string
}

export interface AuditLog {
  id: string
  actorRole: UserRole
  actorId?: string
  action: string
  subjectType: string
  subjectId: string
  occurredAt: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface Referral {
  id: string
  facilityId?: string
  preferredCounty?: string
  residentCounty: string
  requestedCapabilities: FacilityCapability[]
  urgency: 'routine' | 'soon' | 'urgent'
  status: 'draft' | 'queued' | 'matched' | 'closed'
  createdAt: string
  createdByRole: UserRole
  consentToShare: boolean
  contact: {
    name?: string
    email?: string
    phone?: string
    relationship?: string
  }
  privateNotes?: string
}

export interface Facility {
  id: string
  name: string
  organizationId: string
  licenseSnapshot: FacilityLicenseSnapshot
  address: string
  city: string
  county: string
  state: 'MI'
  zip: string
  latitude: number
  longitude: number
  cmhsp: string
  pihp: string
  regionLabel: string
  serviceFlags: FacilityServiceFlags
  capabilities: FacilityCapability[]
  availability: AvailabilitySnapshot
  staffing: StaffingSnapshot
  complianceEvents: ComplianceEvent[]
  claims: Claim[]
  dataQuality: DataQualityScore
  scores: FacilityScoreBreakdown
  sourceDocumentIds: string[]
}

export interface ReviewRecord {
  id: string
  type: ReviewRecordType
  status: ReviewStatus
  priority: 'low' | 'normal' | 'high'
  facilityId?: string
  createdAt: string
  submittedByRole: UserRole
  sourceClaimIds: string[]
  summary: string
  payload: Record<string, unknown>
  auditLog: AuditLog[]
}

export interface FacilityFilters {
  query?: string
  county?: string
  counties?: string[]
  city?: string
  cmhsp?: string
  pihp?: string
  facilityTypes?: FacilityType[]
  capabilities?: FacilityCapability[]
  serviceFlags?: Partial<Record<keyof FacilityServiceFlags, boolean>>
  minAvailableBeds?: number
  acceptsReferrals?: boolean
  maxConcernScore?: number
  geographyId?: string
}

export interface FacilityProfile {
  facility: Facility
  organization?: Organization
  licenseFacts: FacilityLicenseSnapshot
  providerClaims: Claim[]
  userSubmittedClaims: Claim[]
  aiExtractedClaims: Claim[]
  verifiedLicensingClaims: Claim[]
  pendingClaims: Claim[]
  provenance: SourceDocument[]
  referralFitBaseline: number
}

export interface GeographyAnalytics {
  geographyId: string
  geographyType: GeographyType
  label: string
  facilityCount: number
  totalCapacity: number
  availableBeds: number
  waitlistCount: number
  scores: FacilityScoreBreakdown
  capabilityScarcity: Array<{
    capability: FacilityCapability
    label: string
    scarcityScore: number
    matchingFacilityCount: number
  }>
  concernFacilities: Array<{
    facilityId: string
    name: string
    concernScore: number
  }>
}

export interface ReferralFitInput {
  county?: string
  requestedCapabilities: FacilityCapability[]
  urgency?: Referral['urgency']
  needsOpenBed?: boolean
}

export interface ProviderClaimDraftInput {
  facilityId: string
  field: string
  value: ClaimValue
  statement: string
  submittedByName?: string
  submittedByRole?: UserRole
  sourceUri?: string
  now?: string
}

export interface AvailabilityUpdateDraftInput {
  facilityId: string
  bedsAvailable: number
  acceptingReferrals: boolean
  waitlistCount?: number
  averageWaitDays?: number
  status?: AvailabilitySnapshot['status']
  notes?: string
  submittedByName?: string
  submittedByRole?: UserRole
  now?: string
  expiresAt?: string
}

export interface CorrectionSubmissionDraftInput {
  facilityId: string
  field: string
  proposedValue: ClaimValue
  currentValue?: ClaimValue
  reason: string
  submittedByName?: string
  submittedByRole?: UserRole
  now?: string
}

export interface PrivateReferralDraftInput {
  facilityId?: string
  preferredCounty?: string
  residentCounty: string
  requestedCapabilities: FacilityCapability[]
  urgency: Referral['urgency']
  consentToShare: boolean
  contact: Referral['contact']
  privateNotes?: string
  createdByRole?: UserRole
  now?: string
}

export const facilityTypeCapacityBands = {
  'adult-foster-care-family-home': {
    facilityType: 'adult-foster-care-family-home',
    laraLabel: 'Adult Foster Care Family Home',
    minCapacity: 1,
    maxCapacity: 6,
  },
  'adult-foster-care-small-group-home': {
    facilityType: 'adult-foster-care-small-group-home',
    laraLabel: 'Adult Foster Care Small Group Home',
    minCapacity: 1,
    maxCapacity: 6,
  },
  'adult-foster-care-medium-group-home': {
    facilityType: 'adult-foster-care-medium-group-home',
    laraLabel: 'Adult Foster Care Medium Group Home',
    minCapacity: 7,
    maxCapacity: 12,
  },
  'adult-foster-care-large-group-home': {
    facilityType: 'adult-foster-care-large-group-home',
    laraLabel: 'Adult Foster Care Large Group Home',
    minCapacity: 13,
    maxCapacity: 20,
  },
  'adult-foster-care-congregate-facility': {
    facilityType: 'adult-foster-care-congregate-facility',
    laraLabel: 'Adult Foster Care Congregate Facility',
    minCapacity: 21,
    maxCapacity: null,
  },
  'home-for-the-aged': {
    facilityType: 'home-for-the-aged',
    laraLabel: 'Home for the Aged',
    minCapacity: 21,
    maxCapacity: null,
    notes: 'Homes for the Aged serve people 55+; a smaller distinct unit may qualify when operated with a licensed nursing home.',
  },
} as const satisfies Record<FacilityType, FacilityTypeCapacityBand>

export const capabilityLabels = {
  'autism-informed-supports': 'Autism-informed supports',
  'awake-overnight-staff': 'Awake overnight staff',
  'behavior-support': 'Behavior support',
  'co-occurring-mental-health': 'Co-occurring mental health',
  'communication-device-support': 'Communication device support',
  'community-employment-support': 'Community employment support',
  'complex-medical-coordination': 'Complex medical coordination',
  'de-escalation-trained-staff': 'De-escalation trained staff',
  'limited-mobility-evacuation': 'Limited mobility evacuation',
  'medication-administration': 'Medication administration',
  'sensory-friendly-space': 'Sensory-friendly space',
  'traumatic-brain-injury-support': 'Traumatic brain injury support',
  transportation: 'Transportation',
  'two-person-transfer': 'Two-person transfer',
  'wheelchair-accessible': 'Wheelchair accessible',
} as const satisfies Record<FacilityCapability, string>

const DEFAULT_SCORE_NOW = '2026-05-08T12:00:00.000Z'
const DAY_MS = 24 * 60 * 60 * 1000

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const average = (values: number[]) => {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const normalizeText = (value: string) => value.trim().toLowerCase()

const slugify = (value: string) => normalizeText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const daysSince = (date: string | undefined, now = DEFAULT_SCORE_NOW) => {
  if (!date) return Number.POSITIVE_INFINITY
  const thenMs = Date.parse(date)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(thenMs) || !Number.isFinite(nowMs)) {
    return Number.POSITIVE_INFINITY
  }
  return Math.max(0, (nowMs - thenMs) / DAY_MS)
}

const sumCapacity = (facilities: ReadonlyArray<Facility>) => (
  facilities.reduce((sum, facility) => sum + facility.licenseSnapshot.capacity, 0)
)

const sumAvailableBeds = (facilities: ReadonlyArray<Facility>) => (
  facilities.reduce((sum, facility) => sum + facility.availability.bedsAvailable, 0)
)

const sumWaitlist = (facilities: ReadonlyArray<Facility>) => (
  facilities.reduce((sum, facility) => sum + facility.availability.waitlistCount, 0)
)

const geographyId = (type: GeographyType, label: string) => `${type}:${slugify(label)}`

const getFacilityGeographyIds = (facility: Facility) => [
  'state:michigan',
  geographyId('county', facility.county),
  geographyId('cmhsp', facility.cmhsp),
  geographyId('pihp', facility.pihp),
]

const matchesText = (value: string | undefined, expected: string | undefined) => (
  !expected || normalizeText(value || '') === normalizeText(expected)
)

const sourceDocumentsForIds = (ids: string[]) => {
  const idSet = new Set(ids)
  return sourceDocuments.filter((source) => idSet.has(source.id))
}

const makeDraftId = (prefix: string, parts: string[], now: string) => (
  `${prefix}-${parts.map((part) => slugify(part || 'unknown')).join('-')}-${Date.parse(now) || 0}`
)

export const scoreFreshness = (lastUpdatedAt: string | undefined, now = DEFAULT_SCORE_NOW) => {
  const ageDays = daysSince(lastUpdatedAt, now)
  if (!Number.isFinite(ageDays)) return 0
  return clampScore(100 - ageDays * 1.5)
}

export const scoreResidentialSupply = (facilities: ReadonlyArray<Facility>) => {
  const capacityScore = sumCapacity(facilities) * 1.4
  const typeDiversityScore = new Set(
    facilities.map((facility) => facility.licenseSnapshot.facilityType),
  ).size * 8
  return clampScore(capacityScore + typeDiversityScore)
}

export const scoreLiveAvailability = (facilities: ReadonlyArray<Facility>) => {
  const capacity = sumCapacity(facilities)
  if (capacity === 0) return 0

  const openBedsScore = (sumAvailableBeds(facilities) / capacity) * 100
  const acceptingScore = (
    facilities.filter((facility) => facility.availability.acceptingReferrals).length /
    facilities.length
  ) * 35

  return clampScore(openBedsScore * 0.75 + acceptingScore)
}

export const scoreCapabilityScarcity = (
  facilities: ReadonlyArray<Facility>,
  capability: FacilityCapability,
) => {
  const capacity = sumCapacity(facilities)
  if (capacity === 0) return 100

  const matchingCapacity = facilities
    .filter((facility) => facility.capabilities.includes(capability))
    .reduce((sum, facility) => sum + facility.licenseSnapshot.capacity, 0)

  return clampScore(100 - (matchingCapacity / capacity) * 100)
}

export const scoreWaitlistPressure = (facilities: ReadonlyArray<Facility>) => {
  const availableBeds = sumAvailableBeds(facilities)
  const waitlistCount = sumWaitlist(facilities)
  if (waitlistCount === 0) return 0
  return clampScore((waitlistCount / Math.max(1, availableBeds + waitlistCount)) * 100)
}

export const scoreFacilityFreshness = (facility: Facility, now = DEFAULT_SCORE_NOW) => (
  clampScore(average([
    scoreFreshness(facility.licenseSnapshot.lastVerifiedAt, now),
    scoreFreshness(facility.availability.reportedAt, now),
    scoreFreshness(facility.staffing.reportedAt, now),
  ]))
)

export const scoreConcern = (facility: Facility, now = DEFAULT_SCORE_NOW) => {
  const severityPoints = facility.complianceEvents.reduce((sum, event) => {
    if (event.status === 'closed' || event.status === 'corrected') return sum
    if (event.severity === 'high') return sum + 45
    if (event.severity === 'moderate') return sum + 25
    return sum + 10
  }, 0)

  const stalePenalty = 100 - scoreFacilityFreshness(facility, now)
  const conflictPenalty = facility.dataQuality.conflictRisk * 0.35
  return clampScore(severityPoints + stalePenalty * 0.3 + conflictPenalty)
}

export const scoreOpportunity = (facilities: ReadonlyArray<Facility>) => {
  if (facilities.length === 0) return 0

  const availabilityGap = 100 - scoreLiveAvailability(facilities)
  const waitlistPressure = scoreWaitlistPressure(facilities)
  const concernAverage = average(facilities.map((facility) => scoreConcern(facility)))
  const supplyGap = 100 - scoreResidentialSupply(facilities)

  return clampScore(
    availabilityGap * 0.35 +
    waitlistPressure * 0.3 +
    concernAverage * 0.15 +
    supplyGap * 0.2,
  )
}

export const scoreReferralFit = (facility: Facility, referral: ReferralFitInput) => {
  const capabilityScore = referral.requestedCapabilities.length === 0
    ? 35
    : (
      referral.requestedCapabilities.filter((capability) => (
        facility.capabilities.includes(capability)
      )).length / referral.requestedCapabilities.length
    ) * 55

  const geographyScore = referral.county && matchesText(facility.county, referral.county) ? 15 : 0
  const availabilityScore = facility.availability.acceptingReferrals &&
    (!referral.needsOpenBed || facility.availability.bedsAvailable > 0)
    ? 20
    : facility.availability.status === 'waitlist'
      ? 4
      : 0
  const urgencyPenalty = referral.urgency === 'urgent' && facility.availability.bedsAvailable === 0
    ? 18
    : 0
  const concernPenalty = scoreConcern(facility) * 0.12

  return clampScore(capabilityScore + geographyScore + availabilityScore - urgencyPenalty - concernPenalty)
}

export const sourceDocuments: SourceDocument[] = [
  {
    id: 'mi-lara-afc-hfa-licensing',
    title: 'Adult Foster Care & Homes for the Aged Licensing',
    publisher: 'Michigan Department of Licensing and Regulatory Affairs',
    sourceType: 'official',
    uri: 'https://www.michigan.gov/lara/bureau-list/bchs/adult/overview/adult-foster-care-homes-for-the-aged-licensing',
    retrievedAt: '2026-05-08',
    description: 'Official LARA overview for family, small, large, congregate Adult Foster Care homes, Homes for the Aged, and specialized programs.',
  },
  {
    id: 'mi-lara-afc-record-description',
    title: 'Adult Foster Care Record Description',
    publisher: 'Michigan Department of Licensing and Regulatory Affairs',
    sourceType: 'official',
    uri: 'https://www.michigan.gov/lara/bureau-list/bchs/adult/online-lookups/adult-foster-care-record-description',
    retrievedAt: '2026-05-08',
    description: 'Field definitions for AFC and HFA lookup records, including facility type codes and service flags.',
  },
  {
    id: 'mi-mdhhs-cmhsp-overview',
    title: 'Community Mental Health Services',
    publisher: 'Michigan Department of Health & Human Services',
    sourceType: 'official',
    uri: 'https://www.michigan.gov/mdhhs/keep-mi-healthy/mentalhealth/mentalhealth/cmhsp',
    retrievedAt: '2026-05-08',
    description: 'Official CMHSP and PIHP overview for Michigan specialty behavioral health services.',
  },
  {
    id: 'mi-mdhhs-pihp-county-designations',
    title: 'MDHHS County Designations',
    publisher: 'Michigan Department of Health & Human Services',
    sourceType: 'official',
    uri: 'https://www.michigan.gov/mdhhs/-/media/Project/Websites/mdhhs/Keeping-Michigan-Healthy/BH-DD/PIHPs/PIHP-Region-Table.pdf',
    retrievedAt: '2026-05-08',
    description: 'County-to-CMHSP and PIHP region designations used for sample geography assignments.',
  },
  {
    id: 'mvp-sample-license-seed-2026',
    title: 'Michigan I/DD Housing Platform MVP Sample License Seed',
    publisher: 'UBLDA MVP project',
    sourceType: 'platform_seed',
    retrievedAt: '2026-05-08',
    description: 'Synthetic LARA-shaped facility seed data for product development. Not a substitute for live LARA lookup data.',
  },
  {
    id: 'mvp-provider-attestation-seed-2026',
    title: 'MVP Provider Attestation Seed',
    publisher: 'UBLDA MVP project',
    sourceType: 'provider',
    retrievedAt: '2026-05-08',
    description: 'Synthetic provider overlays for capabilities, staffing, and availability.',
  },
  {
    id: 'mvp-family-feedback-seed-2026',
    title: 'MVP Family Feedback Seed',
    publisher: 'UBLDA MVP project',
    sourceType: 'user_submission',
    retrievedAt: '2026-05-08',
    description: 'Synthetic family and advocate submissions used to exercise the review queue.',
  },
  {
    id: 'mvp-ai-extraction-seed-2026',
    title: 'MVP AI Extraction Seed',
    publisher: 'UBLDA MVP project',
    sourceType: 'ai_extraction',
    retrievedAt: '2026-05-08',
    description: 'Synthetic extracted claims used to keep AI-derived statements separate from verified facts.',
  },
]

export const organizations: Organization[] = [
  {
    id: 'org-dwi-homes',
    name: 'DWI Community Homes LLC',
    organizationType: 'licensee',
    county: 'Wayne',
    sourceDocumentIds: ['mvp-sample-license-seed-2026'],
  },
  {
    id: 'org-river-valley-supports',
    name: 'River Valley Supports Inc.',
    organizationType: 'licensee',
    county: 'Kent',
    sourceDocumentIds: ['mvp-sample-license-seed-2026'],
  },
  {
    id: 'org-capitol-area-residential',
    name: 'Capitol Area Residential Services',
    organizationType: 'licensee',
    county: 'Ingham',
    sourceDocumentIds: ['mvp-sample-license-seed-2026'],
  },
  {
    id: 'org-huron-aging-supports',
    name: 'Huron Aging Supports',
    organizationType: 'licensee',
    county: 'Washtenaw',
    sourceDocumentIds: ['mvp-sample-license-seed-2026'],
  },
  {
    id: 'org-north-bay-family-home',
    name: 'North Bay Family Home LLC',
    organizationType: 'licensee',
    county: 'Grand Traverse',
    sourceDocumentIds: ['mvp-sample-license-seed-2026'],
  },
  {
    id: 'org-superior-life-services',
    name: 'Superior Life Services',
    organizationType: 'licensee',
    county: 'Marquette',
    sourceDocumentIds: ['mvp-sample-license-seed-2026'],
  },
  {
    id: 'org-mdhhs',
    name: 'Michigan Department of Health & Human Services',
    organizationType: 'state_agency',
    sourceDocumentIds: ['mi-mdhhs-cmhsp-overview'],
  },
  {
    id: 'org-lara-bchs',
    name: 'LARA Bureau of Community and Health Systems',
    organizationType: 'state_agency',
    sourceDocumentIds: ['mi-lara-afc-hfa-licensing', 'mi-lara-afc-record-description'],
  },
]

export const sampleFacilities: Facility[] = [
  {
    id: 'facility-detroit-mack-afc',
    name: 'Mack Avenue AFC Small Group Home',
    organizationId: 'org-dwi-homes',
    licenseSnapshot: {
      id: 'license-detroit-mack-afc-2026-04',
      facilityId: 'facility-detroit-mack-afc',
      licenseNumber: 'SAMPLE-AS820001',
      licenseStatus: 'active',
      facilityType: 'adult-foster-care-small-group-home',
      facilityTypeLabel: 'Adult Foster Care Small Group Home',
      licenseeOrganizationId: 'org-dwi-homes',
      capacity: 6,
      licensingCounty: 'Wayne',
      effectiveDate: '2025-10-01',
      expirationDate: '2026-09-30',
      lastVerifiedAt: '2026-04-20T14:00:00.000Z',
      sourceDocumentIds: ['mvp-sample-license-seed-2026', 'mi-lara-afc-hfa-licensing'],
      isSampleData: true,
    },
    address: '4120 Mack Avenue',
    city: 'Detroit',
    county: 'Wayne',
    state: 'MI',
    zip: '48207',
    latitude: 42.3601,
    longitude: -83.0347,
    cmhsp: 'Detroit Wayne Integrated Health Network',
    pihp: 'Detroit Wayne Integrated Health Network',
    regionLabel: 'Detroit/Wayne',
    serviceFlags: {
      servesDevelopmentalDisability: true,
      servesMentalIllness: true,
      servesPhysicalDisability: false,
      servesAged: false,
      servesTraumaticBrainInjury: false,
      specializedProgramForDevelopmentalDisability: true,
      specializedProgramForMentalIllness: true,
      acceptsCmhspReferrals: true,
      acceptsMedicaidPersonalCareSupplement: true,
      supportsSelfDeterminationArrangements: true,
      providesTransportation: true,
      wheelchairAccessible: false,
    },
    capabilities: [
      'behavior-support',
      'co-occurring-mental-health',
      'de-escalation-trained-staff',
      'medication-administration',
      'transportation',
    ],
    availability: {
      id: 'availability-detroit-mack-afc-2026-05',
      facilityId: 'facility-detroit-mack-afc',
      status: 'limited',
      totalCapacity: 6,
      bedsAvailable: 1,
      acceptingReferrals: true,
      waitlistCount: 4,
      averageWaitDays: 42,
      reportedAt: '2026-05-03T16:30:00.000Z',
      expiresAt: '2026-05-17T16:30:00.000Z',
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-detroit-availability-provider'],
      notes: 'Provider reports one male-designated opening pending team match.',
    },
    staffing: {
      id: 'staffing-detroit-mack-afc-2026-04',
      facilityId: 'facility-detroit-mack-afc',
      reportedAt: '2026-04-28T12:15:00.000Z',
      daytimeStaffRatio: '1:3',
      overnightStaffRatio: '1:6',
      awakeOvernightStaff: true,
      licensedNurseOnCall: false,
      trainingHighlights: ['behavior-support', 'de-escalation-trained-staff'],
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-detroit-awake-night-provider'],
    },
    complianceEvents: [
      {
        id: 'compliance-detroit-mack-afc-2025-11',
        facilityId: 'facility-detroit-mack-afc',
        eventDate: '2025-11-19',
        eventType: 'corrective_action',
        severity: 'low',
        status: 'corrected',
        summary: 'Synthetic corrective action for medication log reconciliation marked corrected.',
        sourceDocumentIds: ['mvp-sample-license-seed-2026'],
        claimIds: ['claim-detroit-med-log-correction'],
      },
    ],
    claims: [
      {
        id: 'claim-detroit-availability-provider',
        subjectType: 'availability',
        facilityId: 'facility-detroit-mack-afc',
        claimType: 'provider_overlay',
        sourceKind: 'provider_attestation',
        field: 'availability.bedsAvailable',
        statement: 'Provider reports one current opening.',
        value: 1,
        sourceDocumentId: 'mvp-provider-attestation-seed-2026',
        submittedByRole: 'provider',
        submittedByName: 'MVP provider seed',
        submittedAt: '2026-05-03T16:30:00.000Z',
        status: 'verified',
        confidence: 0.82,
        reviewRequired: false,
        visibility: 'public',
      },
      {
        id: 'claim-detroit-awake-night-provider',
        subjectType: 'staffing',
        facilityId: 'facility-detroit-mack-afc',
        claimType: 'provider_overlay',
        sourceKind: 'provider_attestation',
        field: 'staffing.awakeOvernightStaff',
        statement: 'Awake overnight staff are scheduled every night.',
        value: true,
        sourceDocumentId: 'mvp-provider-attestation-seed-2026',
        submittedByRole: 'provider',
        submittedByName: 'MVP provider seed',
        submittedAt: '2026-04-28T12:15:00.000Z',
        status: 'verified',
        confidence: 0.78,
        reviewRequired: false,
        visibility: 'public',
      },
      {
        id: 'claim-detroit-med-log-correction',
        subjectType: 'compliance',
        facilityId: 'facility-detroit-mack-afc',
        claimType: 'licensing_fact',
        sourceKind: 'platform_seed',
        field: 'complianceEvents.status',
        statement: 'Medication log reconciliation item is recorded as corrected in sample data.',
        value: 'corrected',
        sourceDocumentId: 'mvp-sample-license-seed-2026',
        submittedByRole: 'platform_admin',
        submittedAt: '2026-04-20T14:00:00.000Z',
        status: 'verified',
        confidence: 0.9,
        reviewRequired: false,
        visibility: 'public',
      },
    ],
    dataQuality: {
      overall: 86,
      licensingFreshness: 92,
      providerFreshness: 95,
      availabilityFreshness: 96,
      provenanceCompleteness: 88,
      conflictRisk: 14,
      lastScoredAt: '2026-05-08T12:00:00.000Z',
      warnings: ['Sample license data must be replaced by live LARA lookup before launch.'],
    },
    scores: {
      residentialSupply: 45,
      liveAvailability: 38,
      capabilityScarcity: 54,
      waitlistPressure: 80,
      freshness: 94,
      concern: 4,
      opportunity: 62,
    },
    sourceDocumentIds: [
      'mvp-sample-license-seed-2026',
      'mvp-provider-attestation-seed-2026',
      'mi-lara-afc-hfa-licensing',
      'mi-mdhhs-cmhsp-overview',
    ],
  },
  {
    id: 'facility-grand-rapids-fulton-afc',
    name: 'Fulton Street AFC Medium Group Home',
    organizationId: 'org-river-valley-supports',
    licenseSnapshot: {
      id: 'license-grand-rapids-fulton-afc-2026-04',
      facilityId: 'facility-grand-rapids-fulton-afc',
      licenseNumber: 'SAMPLE-AM410002',
      licenseStatus: 'active',
      facilityType: 'adult-foster-care-medium-group-home',
      facilityTypeLabel: 'Adult Foster Care Medium Group Home',
      licenseeOrganizationId: 'org-river-valley-supports',
      capacity: 12,
      licensingCounty: 'Kent',
      effectiveDate: '2025-08-01',
      expirationDate: '2026-07-31',
      lastVerifiedAt: '2026-04-18T10:00:00.000Z',
      sourceDocumentIds: ['mvp-sample-license-seed-2026', 'mi-lara-afc-record-description'],
      isSampleData: true,
    },
    address: '811 Fulton Street East',
    city: 'Grand Rapids',
    county: 'Kent',
    state: 'MI',
    zip: '49503',
    latitude: 42.9639,
    longitude: -85.6521,
    cmhsp: 'Network180',
    pihp: 'Lakeshore Regional Entity',
    regionLabel: 'Grand Rapids/Kent',
    serviceFlags: {
      servesDevelopmentalDisability: true,
      servesMentalIllness: false,
      servesPhysicalDisability: true,
      servesAged: false,
      servesTraumaticBrainInjury: false,
      specializedProgramForDevelopmentalDisability: true,
      specializedProgramForMentalIllness: false,
      acceptsCmhspReferrals: true,
      acceptsMedicaidPersonalCareSupplement: true,
      supportsSelfDeterminationArrangements: true,
      providesTransportation: true,
      wheelchairAccessible: true,
    },
    capabilities: [
      'autism-informed-supports',
      'awake-overnight-staff',
      'communication-device-support',
      'sensory-friendly-space',
      'transportation',
      'wheelchair-accessible',
    ],
    availability: {
      id: 'availability-grand-rapids-fulton-afc-2026-05',
      facilityId: 'facility-grand-rapids-fulton-afc',
      status: 'waitlist',
      totalCapacity: 12,
      bedsAvailable: 0,
      acceptingReferrals: true,
      waitlistCount: 8,
      averageWaitDays: 75,
      reportedAt: '2026-05-01T13:00:00.000Z',
      expiresAt: '2026-05-15T13:00:00.000Z',
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-grand-rapids-waitlist-provider'],
      notes: 'Provider accepts referrals for waitlist review only.',
    },
    staffing: {
      id: 'staffing-grand-rapids-fulton-afc-2026-05',
      facilityId: 'facility-grand-rapids-fulton-afc',
      reportedAt: '2026-05-01T13:00:00.000Z',
      daytimeStaffRatio: '1:4',
      overnightStaffRatio: '1:12',
      awakeOvernightStaff: true,
      licensedNurseOnCall: false,
      trainingHighlights: [
        'autism-informed-supports',
        'communication-device-support',
        'sensory-friendly-space',
      ],
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-grand-rapids-sensory-ai'],
    },
    complianceEvents: [
      {
        id: 'compliance-grand-rapids-fulton-afc-2026-02',
        facilityId: 'facility-grand-rapids-fulton-afc',
        eventDate: '2026-02-10',
        eventType: 'inspection',
        severity: 'low',
        status: 'closed',
        summary: 'Synthetic annual inspection with no open enforcement items.',
        sourceDocumentIds: ['mvp-sample-license-seed-2026'],
        claimIds: [],
      },
    ],
    claims: [
      {
        id: 'claim-grand-rapids-waitlist-provider',
        subjectType: 'availability',
        facilityId: 'facility-grand-rapids-fulton-afc',
        claimType: 'provider_overlay',
        sourceKind: 'provider_attestation',
        field: 'availability.waitlistCount',
        statement: 'Provider reports eight people waiting for a compatible opening.',
        value: 8,
        sourceDocumentId: 'mvp-provider-attestation-seed-2026',
        submittedByRole: 'provider',
        submittedByName: 'MVP provider seed',
        submittedAt: '2026-05-01T13:00:00.000Z',
        status: 'verified',
        confidence: 0.8,
        reviewRequired: false,
        visibility: 'public',
      },
      {
        id: 'claim-grand-rapids-sensory-ai',
        subjectType: 'facility',
        facilityId: 'facility-grand-rapids-fulton-afc',
        claimType: 'ai_extracted',
        sourceKind: 'ai_document_extraction',
        field: 'capabilities',
        statement: 'AI extraction found language indicating a sensory-friendly room and visual schedules.',
        value: ['sensory-friendly-space', 'communication-device-support'],
        sourceDocumentId: 'mvp-ai-extraction-seed-2026',
        submittedByRole: 'platform_admin',
        submittedAt: '2026-05-02T09:40:00.000Z',
        status: 'pending_review',
        confidence: 0.67,
        reviewRequired: true,
        visibility: 'provider_review',
      },
    ],
    dataQuality: {
      overall: 82,
      licensingFreshness: 91,
      providerFreshness: 96,
      availabilityFreshness: 94,
      provenanceCompleteness: 84,
      conflictRisk: 18,
      lastScoredAt: '2026-05-08T12:00:00.000Z',
      warnings: ['AI-extracted sensory capability is pending human review.'],
    },
    scores: {
      residentialSupply: 58,
      liveAvailability: 18,
      capabilityScarcity: 44,
      waitlistPressure: 100,
      freshness: 94,
      concern: 5,
      opportunity: 76,
    },
    sourceDocumentIds: [
      'mvp-sample-license-seed-2026',
      'mvp-provider-attestation-seed-2026',
      'mvp-ai-extraction-seed-2026',
      'mi-lara-afc-record-description',
      'mi-mdhhs-pihp-county-designations',
    ],
  },
  {
    id: 'facility-lansing-cedar-afc',
    name: 'Cedar Street AFC Large Group Home',
    organizationId: 'org-capitol-area-residential',
    licenseSnapshot: {
      id: 'license-lansing-cedar-afc-2026-04',
      facilityId: 'facility-lansing-cedar-afc',
      licenseNumber: 'SAMPLE-AL330003',
      licenseStatus: 'active',
      facilityType: 'adult-foster-care-large-group-home',
      facilityTypeLabel: 'Adult Foster Care Large Group Home',
      licenseeOrganizationId: 'org-capitol-area-residential',
      capacity: 20,
      licensingCounty: 'Ingham',
      effectiveDate: '2025-05-15',
      expirationDate: '2026-05-14',
      lastVerifiedAt: '2026-04-10T08:30:00.000Z',
      sourceDocumentIds: ['mvp-sample-license-seed-2026', 'mi-lara-afc-record-description'],
      isSampleData: true,
    },
    address: '1601 South Cedar Street',
    city: 'Lansing',
    county: 'Ingham',
    state: 'MI',
    zip: '48910',
    latitude: 42.7169,
    longitude: -84.5483,
    cmhsp: 'Clinton-Eaton-Ingham Community Mental Health Authority',
    pihp: 'Mid-State Health Network',
    regionLabel: 'Lansing/Ingham',
    serviceFlags: {
      servesDevelopmentalDisability: true,
      servesMentalIllness: true,
      servesPhysicalDisability: true,
      servesAged: false,
      servesTraumaticBrainInjury: true,
      specializedProgramForDevelopmentalDisability: true,
      specializedProgramForMentalIllness: true,
      acceptsCmhspReferrals: true,
      acceptsMedicaidPersonalCareSupplement: true,
      supportsSelfDeterminationArrangements: false,
      providesTransportation: true,
      wheelchairAccessible: true,
    },
    capabilities: [
      'awake-overnight-staff',
      'complex-medical-coordination',
      'limited-mobility-evacuation',
      'medication-administration',
      'traumatic-brain-injury-support',
      'two-person-transfer',
      'wheelchair-accessible',
    ],
    availability: {
      id: 'availability-lansing-cedar-afc-2026-05',
      facilityId: 'facility-lansing-cedar-afc',
      status: 'open',
      totalCapacity: 20,
      bedsAvailable: 3,
      acceptingReferrals: true,
      waitlistCount: 3,
      averageWaitDays: 28,
      reportedAt: '2026-05-04T11:20:00.000Z',
      expiresAt: '2026-05-18T11:20:00.000Z',
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-lansing-availability-provider'],
      notes: 'Openings require nurse review for mobility and medication complexity.',
    },
    staffing: {
      id: 'staffing-lansing-cedar-afc-2026-05',
      facilityId: 'facility-lansing-cedar-afc',
      reportedAt: '2026-05-04T11:20:00.000Z',
      daytimeStaffRatio: '1:5',
      overnightStaffRatio: '2:20',
      awakeOvernightStaff: true,
      licensedNurseOnCall: true,
      trainingHighlights: [
        'complex-medical-coordination',
        'limited-mobility-evacuation',
        'two-person-transfer',
      ],
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-lansing-nurse-provider'],
    },
    complianceEvents: [
      {
        id: 'compliance-lansing-cedar-afc-2026-03',
        facilityId: 'facility-lansing-cedar-afc',
        eventDate: '2026-03-22',
        eventType: 'corrective_action',
        severity: 'moderate',
        status: 'monitoring',
        summary: 'Synthetic corrective action monitoring medication administration documentation.',
        sourceDocumentIds: ['mvp-sample-license-seed-2026'],
        claimIds: ['claim-lansing-med-admin-monitoring'],
      },
    ],
    claims: [
      {
        id: 'claim-lansing-availability-provider',
        subjectType: 'availability',
        facilityId: 'facility-lansing-cedar-afc',
        claimType: 'provider_overlay',
        sourceKind: 'provider_attestation',
        field: 'availability.bedsAvailable',
        statement: 'Provider reports three open beds subject to nurse review.',
        value: 3,
        sourceDocumentId: 'mvp-provider-attestation-seed-2026',
        submittedByRole: 'provider',
        submittedByName: 'MVP provider seed',
        submittedAt: '2026-05-04T11:20:00.000Z',
        status: 'verified',
        confidence: 0.84,
        reviewRequired: false,
        visibility: 'public',
      },
      {
        id: 'claim-lansing-nurse-provider',
        subjectType: 'staffing',
        facilityId: 'facility-lansing-cedar-afc',
        claimType: 'provider_overlay',
        sourceKind: 'provider_attestation',
        field: 'staffing.licensedNurseOnCall',
        statement: 'Licensed nurse is on call for medication and mobility review.',
        value: true,
        sourceDocumentId: 'mvp-provider-attestation-seed-2026',
        submittedByRole: 'provider',
        submittedByName: 'MVP provider seed',
        submittedAt: '2026-05-04T11:20:00.000Z',
        status: 'verified',
        confidence: 0.82,
        reviewRequired: false,
        visibility: 'public',
      },
      {
        id: 'claim-lansing-med-admin-monitoring',
        subjectType: 'compliance',
        facilityId: 'facility-lansing-cedar-afc',
        claimType: 'licensing_fact',
        sourceKind: 'platform_seed',
        field: 'complianceEvents.status',
        statement: 'Medication administration documentation item remains in monitoring.',
        value: 'monitoring',
        sourceDocumentId: 'mvp-sample-license-seed-2026',
        submittedByRole: 'platform_admin',
        submittedAt: '2026-04-10T08:30:00.000Z',
        status: 'verified',
        confidence: 0.88,
        reviewRequired: false,
        visibility: 'public',
      },
    ],
    dataQuality: {
      overall: 83,
      licensingFreshness: 88,
      providerFreshness: 97,
      availabilityFreshness: 97,
      provenanceCompleteness: 85,
      conflictRisk: 20,
      lastScoredAt: '2026-05-08T12:00:00.000Z',
      warnings: ['Open compliance monitoring should be surfaced in referral fit.'],
    },
    scores: {
      residentialSupply: 72,
      liveAvailability: 44,
      capabilityScarcity: 36,
      waitlistPressure: 50,
      freshness: 92,
      concern: 31,
      opportunity: 54,
    },
    sourceDocumentIds: [
      'mvp-sample-license-seed-2026',
      'mvp-provider-attestation-seed-2026',
      'mi-lara-afc-record-description',
      'mi-mdhhs-pihp-county-designations',
    ],
  },
  {
    id: 'facility-ann-arbor-huron-hfa',
    name: 'Huron Parkway Home for the Aged',
    organizationId: 'org-huron-aging-supports',
    licenseSnapshot: {
      id: 'license-ann-arbor-huron-hfa-2026-04',
      facilityId: 'facility-ann-arbor-huron-hfa',
      licenseNumber: 'SAMPLE-AH810004',
      licenseStatus: 'active',
      facilityType: 'home-for-the-aged',
      facilityTypeLabel: 'Home for the Aged',
      licenseeOrganizationId: 'org-huron-aging-supports',
      capacity: 36,
      licensingCounty: 'Washtenaw',
      effectiveDate: '2025-12-01',
      expirationDate: '2026-11-30',
      lastVerifiedAt: '2026-04-25T15:45:00.000Z',
      sourceDocumentIds: ['mvp-sample-license-seed-2026', 'mi-lara-afc-hfa-licensing'],
      isSampleData: true,
      notes: 'HFA sample is included for older adults with I/DD who meet HFA age criteria.',
    },
    address: '2890 Huron Parkway',
    city: 'Ann Arbor',
    county: 'Washtenaw',
    state: 'MI',
    zip: '48104',
    latitude: 42.2548,
    longitude: -83.6973,
    cmhsp: 'Washtenaw County Community Mental Health',
    pihp: 'Community Mental Health Partnership of Southeast Michigan',
    regionLabel: 'Ann Arbor/Washtenaw',
    serviceFlags: {
      servesDevelopmentalDisability: true,
      servesMentalIllness: true,
      servesPhysicalDisability: true,
      servesAged: true,
      servesTraumaticBrainInjury: false,
      specializedProgramForDevelopmentalDisability: false,
      specializedProgramForMentalIllness: false,
      acceptsCmhspReferrals: true,
      acceptsMedicaidPersonalCareSupplement: true,
      supportsSelfDeterminationArrangements: false,
      providesTransportation: true,
      wheelchairAccessible: true,
    },
    capabilities: [
      'co-occurring-mental-health',
      'complex-medical-coordination',
      'medication-administration',
      'transportation',
      'wheelchair-accessible',
    ],
    availability: {
      id: 'availability-ann-arbor-huron-hfa-2026-05',
      facilityId: 'facility-ann-arbor-huron-hfa',
      status: 'open',
      totalCapacity: 36,
      bedsAvailable: 4,
      acceptingReferrals: true,
      waitlistCount: 2,
      averageWaitDays: 20,
      reportedAt: '2026-05-05T09:10:00.000Z',
      expiresAt: '2026-05-19T09:10:00.000Z',
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-ann-arbor-availability-provider'],
      notes: 'HFA openings require age and level-of-care review.',
    },
    staffing: {
      id: 'staffing-ann-arbor-huron-hfa-2026-05',
      facilityId: 'facility-ann-arbor-huron-hfa',
      reportedAt: '2026-05-05T09:10:00.000Z',
      daytimeStaffRatio: '1:8',
      overnightStaffRatio: '2:36',
      awakeOvernightStaff: true,
      licensedNurseOnCall: true,
      trainingHighlights: [
        'co-occurring-mental-health',
        'complex-medical-coordination',
        'medication-administration',
      ],
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-ann-arbor-age-provider'],
    },
    complianceEvents: [
      {
        id: 'compliance-ann-arbor-huron-hfa-2026-01',
        facilityId: 'facility-ann-arbor-huron-hfa',
        eventDate: '2026-01-16',
        eventType: 'inspection',
        severity: 'low',
        status: 'closed',
        summary: 'Synthetic HFA inspection record with no open corrective actions.',
        sourceDocumentIds: ['mvp-sample-license-seed-2026'],
        claimIds: [],
      },
    ],
    claims: [
      {
        id: 'claim-ann-arbor-availability-provider',
        subjectType: 'availability',
        facilityId: 'facility-ann-arbor-huron-hfa',
        claimType: 'provider_overlay',
        sourceKind: 'provider_attestation',
        field: 'availability.bedsAvailable',
        statement: 'Provider reports four openings for age-eligible residents.',
        value: 4,
        sourceDocumentId: 'mvp-provider-attestation-seed-2026',
        submittedByRole: 'provider',
        submittedByName: 'MVP provider seed',
        submittedAt: '2026-05-05T09:10:00.000Z',
        status: 'verified',
        confidence: 0.83,
        reviewRequired: false,
        visibility: 'public',
      },
      {
        id: 'claim-ann-arbor-age-provider',
        subjectType: 'facility',
        facilityId: 'facility-ann-arbor-huron-hfa',
        claimType: 'provider_overlay',
        sourceKind: 'provider_attestation',
        field: 'admission.ageCriteria',
        statement: 'Provider states HFA admissions are limited to people 55+.',
        value: '55+',
        sourceDocumentId: 'mvp-provider-attestation-seed-2026',
        submittedByRole: 'provider',
        submittedByName: 'MVP provider seed',
        submittedAt: '2026-05-05T09:10:00.000Z',
        status: 'verified',
        confidence: 0.86,
        reviewRequired: false,
        visibility: 'public',
      },
    ],
    dataQuality: {
      overall: 88,
      licensingFreshness: 94,
      providerFreshness: 97,
      availabilityFreshness: 98,
      provenanceCompleteness: 90,
      conflictRisk: 10,
      lastScoredAt: '2026-05-08T12:00:00.000Z',
      warnings: ['HFA age criteria should be shown clearly in profile and referral workflows.'],
    },
    scores: {
      residentialSupply: 82,
      liveAvailability: 46,
      capabilityScarcity: 42,
      waitlistPressure: 33,
      freshness: 96,
      concern: 3,
      opportunity: 43,
    },
    sourceDocumentIds: [
      'mvp-sample-license-seed-2026',
      'mvp-provider-attestation-seed-2026',
      'mi-lara-afc-hfa-licensing',
      'mi-mdhhs-pihp-county-designations',
    ],
  },
  {
    id: 'facility-traverse-city-barlow-afc',
    name: 'Barlow Street AFC Family Home',
    organizationId: 'org-north-bay-family-home',
    licenseSnapshot: {
      id: 'license-traverse-city-barlow-afc-2026-04',
      facilityId: 'facility-traverse-city-barlow-afc',
      licenseNumber: 'SAMPLE-AF280005',
      licenseStatus: 'active',
      facilityType: 'adult-foster-care-family-home',
      facilityTypeLabel: 'Adult Foster Care Family Home',
      licenseeOrganizationId: 'org-north-bay-family-home',
      capacity: 6,
      licensingCounty: 'Grand Traverse',
      effectiveDate: '2025-09-15',
      expirationDate: '2026-09-14',
      lastVerifiedAt: '2026-04-12T17:00:00.000Z',
      sourceDocumentIds: ['mvp-sample-license-seed-2026', 'mi-lara-afc-hfa-licensing'],
      isSampleData: true,
    },
    address: '742 Barlow Street',
    city: 'Traverse City',
    county: 'Grand Traverse',
    state: 'MI',
    zip: '49686',
    latitude: 44.7606,
    longitude: -85.6012,
    cmhsp: 'Northern Lakes Community Mental Health Authority',
    pihp: 'Northern Michigan Regional Entity',
    regionLabel: 'Traverse City/Grand Traverse',
    serviceFlags: {
      servesDevelopmentalDisability: true,
      servesMentalIllness: false,
      servesPhysicalDisability: false,
      servesAged: false,
      servesTraumaticBrainInjury: false,
      specializedProgramForDevelopmentalDisability: true,
      specializedProgramForMentalIllness: false,
      acceptsCmhspReferrals: true,
      acceptsMedicaidPersonalCareSupplement: true,
      supportsSelfDeterminationArrangements: true,
      providesTransportation: true,
      wheelchairAccessible: false,
    },
    capabilities: [
      'autism-informed-supports',
      'community-employment-support',
      'sensory-friendly-space',
      'transportation',
    ],
    availability: {
      id: 'availability-traverse-city-barlow-afc-2026-04',
      facilityId: 'facility-traverse-city-barlow-afc',
      status: 'waitlist',
      totalCapacity: 6,
      bedsAvailable: 0,
      acceptingReferrals: false,
      waitlistCount: 6,
      averageWaitDays: 110,
      reportedAt: '2026-04-23T10:30:00.000Z',
      expiresAt: '2026-05-07T10:30:00.000Z',
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-traverse-city-waitlist-provider'],
      notes: 'No current openings; provider asks CMHSP teams to check again next month.',
    },
    staffing: {
      id: 'staffing-traverse-city-barlow-afc-2026-04',
      facilityId: 'facility-traverse-city-barlow-afc',
      reportedAt: '2026-04-23T10:30:00.000Z',
      daytimeStaffRatio: '1:3',
      overnightStaffRatio: '1:6',
      awakeOvernightStaff: false,
      licensedNurseOnCall: false,
      trainingHighlights: ['autism-informed-supports', 'community-employment-support'],
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-traverse-city-waitlist-provider'],
    },
    complianceEvents: [
      {
        id: 'compliance-traverse-city-barlow-afc-2025-12',
        facilityId: 'facility-traverse-city-barlow-afc',
        eventDate: '2025-12-05',
        eventType: 'self_report',
        severity: 'low',
        status: 'closed',
        summary: 'Synthetic self-reported transportation outage resolved within 48 hours.',
        sourceDocumentIds: ['mvp-sample-license-seed-2026'],
        claimIds: [],
      },
    ],
    claims: [
      {
        id: 'claim-traverse-city-waitlist-provider',
        subjectType: 'availability',
        facilityId: 'facility-traverse-city-barlow-afc',
        claimType: 'provider_overlay',
        sourceKind: 'provider_attestation',
        field: 'availability.status',
        statement: 'Provider reports no openings and is not accepting new referrals this month.',
        value: 'waitlist',
        sourceDocumentId: 'mvp-provider-attestation-seed-2026',
        submittedByRole: 'provider',
        submittedByName: 'MVP provider seed',
        submittedAt: '2026-04-23T10:30:00.000Z',
        status: 'verified',
        confidence: 0.78,
        reviewRequired: false,
        visibility: 'public',
      },
      {
        id: 'claim-traverse-city-transport-user',
        subjectType: 'facility',
        facilityId: 'facility-traverse-city-barlow-afc',
        claimType: 'user_submission',
        sourceKind: 'user_submission',
        field: 'capabilities.transportation',
        statement: 'Family submission says transportation is limited outside weekday appointments.',
        value: 'weekday-only',
        sourceDocumentId: 'mvp-family-feedback-seed-2026',
        submittedByRole: 'family',
        submittedByName: 'MVP family seed',
        submittedAt: '2026-05-06T18:20:00.000Z',
        status: 'pending_review',
        confidence: 0.52,
        reviewRequired: true,
        visibility: 'provider_review',
      },
    ],
    dataQuality: {
      overall: 74,
      licensingFreshness: 89,
      providerFreshness: 77,
      availabilityFreshness: 74,
      provenanceCompleteness: 78,
      conflictRisk: 34,
      lastScoredAt: '2026-05-08T12:00:00.000Z',
      warnings: ['Availability is expired by one day and needs provider refresh.'],
    },
    scores: {
      residentialSupply: 42,
      liveAvailability: 0,
      capabilityScarcity: 62,
      waitlistPressure: 100,
      freshness: 80,
      concern: 16,
      opportunity: 88,
    },
    sourceDocumentIds: [
      'mvp-sample-license-seed-2026',
      'mvp-provider-attestation-seed-2026',
      'mvp-family-feedback-seed-2026',
      'mi-lara-afc-hfa-licensing',
      'mi-mdhhs-pihp-county-designations',
    ],
  },
  {
    id: 'facility-marquette-presque-isle-afc',
    name: 'Presque Isle AFC Small Group Home',
    organizationId: 'org-superior-life-services',
    licenseSnapshot: {
      id: 'license-marquette-presque-isle-afc-2026-04',
      facilityId: 'facility-marquette-presque-isle-afc',
      licenseNumber: 'SAMPLE-AS520006',
      licenseStatus: 'active',
      facilityType: 'adult-foster-care-small-group-home',
      facilityTypeLabel: 'Adult Foster Care Small Group Home',
      licenseeOrganizationId: 'org-superior-life-services',
      capacity: 6,
      licensingCounty: 'Marquette',
      effectiveDate: '2025-07-01',
      expirationDate: '2026-06-30',
      lastVerifiedAt: '2026-04-15T12:00:00.000Z',
      sourceDocumentIds: ['mvp-sample-license-seed-2026', 'mi-lara-afc-hfa-licensing'],
      isSampleData: true,
    },
    address: '119 West Fair Avenue',
    city: 'Marquette',
    county: 'Marquette',
    state: 'MI',
    zip: '49855',
    latitude: 46.5591,
    longitude: -87.3956,
    cmhsp: 'Pathways Community Mental Health',
    pihp: 'NorthCare Network',
    regionLabel: 'Marquette/Marquette',
    serviceFlags: {
      servesDevelopmentalDisability: true,
      servesMentalIllness: true,
      servesPhysicalDisability: true,
      servesAged: false,
      servesTraumaticBrainInjury: false,
      specializedProgramForDevelopmentalDisability: true,
      specializedProgramForMentalIllness: true,
      acceptsCmhspReferrals: true,
      acceptsMedicaidPersonalCareSupplement: true,
      supportsSelfDeterminationArrangements: true,
      providesTransportation: true,
      wheelchairAccessible: true,
    },
    capabilities: [
      'awake-overnight-staff',
      'co-occurring-mental-health',
      'communication-device-support',
      'medication-administration',
      'transportation',
      'wheelchair-accessible',
    ],
    availability: {
      id: 'availability-marquette-presque-isle-afc-2026-05',
      facilityId: 'facility-marquette-presque-isle-afc',
      status: 'open',
      totalCapacity: 6,
      bedsAvailable: 2,
      acceptingReferrals: true,
      waitlistCount: 1,
      averageWaitDays: 14,
      reportedAt: '2026-05-06T15:00:00.000Z',
      expiresAt: '2026-05-20T15:00:00.000Z',
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-marquette-availability-provider'],
      notes: 'Provider reports two openings and winter transportation coverage.',
    },
    staffing: {
      id: 'staffing-marquette-presque-isle-afc-2026-05',
      facilityId: 'facility-marquette-presque-isle-afc',
      reportedAt: '2026-05-06T15:00:00.000Z',
      daytimeStaffRatio: '1:3',
      overnightStaffRatio: '1:6',
      awakeOvernightStaff: true,
      licensedNurseOnCall: false,
      trainingHighlights: [
        'co-occurring-mental-health',
        'communication-device-support',
        'medication-administration',
      ],
      sourceDocumentIds: ['mvp-provider-attestation-seed-2026'],
      sourceClaimIds: ['claim-marquette-availability-provider'],
    },
    complianceEvents: [
      {
        id: 'compliance-marquette-presque-isle-afc-2026-02',
        facilityId: 'facility-marquette-presque-isle-afc',
        eventDate: '2026-02-18',
        eventType: 'inspection',
        severity: 'low',
        status: 'closed',
        summary: 'Synthetic inspection record with no open enforcement items.',
        sourceDocumentIds: ['mvp-sample-license-seed-2026'],
        claimIds: [],
      },
    ],
    claims: [
      {
        id: 'claim-marquette-availability-provider',
        subjectType: 'availability',
        facilityId: 'facility-marquette-presque-isle-afc',
        claimType: 'provider_overlay',
        sourceKind: 'provider_attestation',
        field: 'availability.bedsAvailable',
        statement: 'Provider reports two current openings.',
        value: 2,
        sourceDocumentId: 'mvp-provider-attestation-seed-2026',
        submittedByRole: 'provider',
        submittedByName: 'MVP provider seed',
        submittedAt: '2026-05-06T15:00:00.000Z',
        status: 'verified',
        confidence: 0.86,
        reviewRequired: false,
        visibility: 'public',
      },
    ],
    dataQuality: {
      overall: 87,
      licensingFreshness: 90,
      providerFreshness: 98,
      availabilityFreshness: 99,
      provenanceCompleteness: 88,
      conflictRisk: 12,
      lastScoredAt: '2026-05-08T12:00:00.000Z',
      warnings: ['Winter transportation capability should be revalidated seasonally.'],
    },
    scores: {
      residentialSupply: 45,
      liveAvailability: 60,
      capabilityScarcity: 48,
      waitlistPressure: 33,
      freshness: 95,
      concern: 4,
      opportunity: 42,
    },
    sourceDocumentIds: [
      'mvp-sample-license-seed-2026',
      'mvp-provider-attestation-seed-2026',
      'mi-lara-afc-hfa-licensing',
      'mi-mdhhs-pihp-county-designations',
    ],
  },
]

const sampleReviewRecords: ReviewRecord[] = [
  {
    id: 'review-grand-rapids-sensory-ai',
    type: 'provider_claim',
    status: 'queued',
    priority: 'normal',
    facilityId: 'facility-grand-rapids-fulton-afc',
    createdAt: '2026-05-02T09:40:00.000Z',
    submittedByRole: 'platform_admin',
    sourceClaimIds: ['claim-grand-rapids-sensory-ai'],
    summary: 'Review AI-extracted sensory and communication capability claim.',
    payload: {
      field: 'capabilities',
      sourceKind: 'ai_document_extraction',
    },
    auditLog: [
      {
        id: 'audit-grand-rapids-sensory-ai-created',
        actorRole: 'platform_admin',
        action: 'review_queued',
        subjectType: 'claim',
        subjectId: 'claim-grand-rapids-sensory-ai',
        occurredAt: '2026-05-02T09:40:00.000Z',
      },
    ],
  },
  {
    id: 'review-traverse-city-transport-user',
    type: 'correction_submission',
    status: 'queued',
    priority: 'normal',
    facilityId: 'facility-traverse-city-barlow-afc',
    createdAt: '2026-05-06T18:20:00.000Z',
    submittedByRole: 'family',
    sourceClaimIds: ['claim-traverse-city-transport-user'],
    summary: 'Review family report that transportation is weekday-only.',
    payload: {
      field: 'capabilities.transportation',
      proposedValue: 'weekday-only',
    },
    auditLog: [
      {
        id: 'audit-traverse-city-transport-user-created',
        actorRole: 'family',
        action: 'review_queued',
        subjectType: 'claim',
        subjectId: 'claim-traverse-city-transport-user',
        occurredAt: '2026-05-06T18:20:00.000Z',
      },
    ],
  },
]

export const filterFacilities = (filters: FacilityFilters = {}) => {
  const query = normalizeText(filters.query || '')
  const countySet = new Set((filters.counties || []).map(normalizeText))
  const facilityTypes = new Set(filters.facilityTypes || [])
  const capabilities = filters.capabilities || []
  const serviceFlags = filters.serviceFlags || {}

  return sampleFacilities.filter((facility) => {
    if (query) {
      const searchable = [
        facility.name,
        facility.city,
        facility.county,
        facility.cmhsp,
        facility.pihp,
        facility.regionLabel,
        ...facility.capabilities.map((capability) => capabilityLabels[capability]),
      ].join(' ')

      if (!normalizeText(searchable).includes(query)) return false
    }

    if (filters.county && !matchesText(facility.county, filters.county)) return false
    if (countySet.size > 0 && !countySet.has(normalizeText(facility.county))) return false
    if (filters.city && !matchesText(facility.city, filters.city)) return false
    if (filters.cmhsp && !matchesText(facility.cmhsp, filters.cmhsp)) return false
    if (filters.pihp && !matchesText(facility.pihp, filters.pihp)) return false
    if (facilityTypes.size > 0 && !facilityTypes.has(facility.licenseSnapshot.facilityType)) return false
    if (capabilities.some((capability) => !facility.capabilities.includes(capability))) return false
    if (
      filters.minAvailableBeds !== undefined &&
      facility.availability.bedsAvailable < filters.minAvailableBeds
    ) return false
    if (
      filters.acceptsReferrals !== undefined &&
      facility.availability.acceptingReferrals !== filters.acceptsReferrals
    ) return false
    if (
      filters.maxConcernScore !== undefined &&
      scoreConcern(facility) > filters.maxConcernScore
    ) return false
    if (
      filters.geographyId &&
      !getFacilityGeographyIds(facility).includes(normalizeText(filters.geographyId))
    ) return false

    return Object.entries(serviceFlags).every(([flag, expected]) => (
      expected === undefined ||
      facility.serviceFlags[flag as keyof FacilityServiceFlags] === expected
    ))
  })
}

export const getFacilityProfile = (id: string): FacilityProfile | undefined => {
  const facility = sampleFacilities.find((candidate) => candidate.id === id)
  if (!facility) return undefined

  const organization = organizations.find((candidate) => candidate.id === facility.organizationId)
  const claimSourceIds = facility.claims
    .map((claim) => claim.sourceDocumentId)
    .filter((sourceId): sourceId is string => Boolean(sourceId))
  const provenance = sourceDocumentsForIds([
    ...facility.sourceDocumentIds,
    ...facility.licenseSnapshot.sourceDocumentIds,
    ...claimSourceIds,
  ])

  return {
    facility,
    organization,
    licenseFacts: facility.licenseSnapshot,
    providerClaims: facility.claims.filter((claim) => claim.claimType === 'provider_overlay'),
    userSubmittedClaims: facility.claims.filter((claim) => claim.claimType === 'user_submission'),
    aiExtractedClaims: facility.claims.filter((claim) => claim.claimType === 'ai_extracted'),
    verifiedLicensingClaims: facility.claims.filter((claim) => claim.claimType === 'licensing_fact'),
    pendingClaims: facility.claims.filter((claim) => claim.status === 'pending_review'),
    provenance,
    referralFitBaseline: scoreReferralFit(facility, {
      county: facility.county,
      requestedCapabilities: facility.capabilities.slice(0, 3),
      needsOpenBed: true,
    }),
  }
}

const groupFacilitiesByGeography = (type: Exclude<GeographyType, 'state'>) => {
  const groups = new Map<string, { id: string, label: string, facilities: Facility[] }>()

  sampleFacilities.forEach((facility) => {
    const label = type === 'county'
      ? facility.county
      : type === 'cmhsp'
        ? facility.cmhsp
        : facility.pihp
    const id = geographyId(type, label)
    const existing = groups.get(id)

    if (existing) {
      existing.facilities.push(facility)
      return
    }

    groups.set(id, { id, label, facilities: [facility] })
  })

  return Array.from(groups.values())
}

const buildLayerMetric = (
  layer: MapLayer,
  geographyType: Exclude<GeographyType, 'state'>,
  geographyIdValue: string,
  label: string,
  facilities: Facility[],
): MapMetric => {
  const sourceDocumentIds = Array.from(new Set(
    facilities.flatMap((facility) => facility.sourceDocumentIds),
  ))
  const totalCapacity = sumCapacity(facilities)
  const availableBeds = sumAvailableBeds(facilities)
  const waitlistCount = sumWaitlist(facilities)
  const score = layer === 'supply'
    ? scoreResidentialSupply(facilities)
    : layer === 'gap'
      ? clampScore(100 - scoreLiveAvailability(facilities) + scoreWaitlistPressure(facilities) * 0.4)
      : scoreOpportunity(facilities)

  return {
    id: `${layer}-${geographyIdValue}`,
    layer,
    geographyType,
    geographyId: geographyIdValue,
    label,
    metric: layer === 'supply'
      ? 'Licensed residential capacity'
      : layer === 'gap'
        ? 'Availability and waitlist pressure'
        : 'Provider development opportunity',
    score,
    facilityCount: facilities.length,
    totalCapacity,
    availableBeds,
    waitlistCount,
    sourceDocumentIds,
    updatedAt: DEFAULT_SCORE_NOW,
  }
}

export const buildSupplyLayer = () => (
  groupFacilitiesByGeography('county').map((group) => (
    buildLayerMetric('supply', 'county', group.id, group.label, group.facilities)
  ))
)

export const buildGapLayer = () => (
  groupFacilitiesByGeography('county').map((group) => (
    buildLayerMetric('gap', 'county', group.id, group.label, group.facilities)
  ))
)

export const buildOpportunityLayer = () => (
  groupFacilitiesByGeography('county').map((group) => (
    buildLayerMetric('opportunity', 'county', group.id, group.label, group.facilities)
  ))
)

const inferGeography = (id: string): { type: GeographyType, slug: string } => {
  const normalized = normalizeText(id)
  const [prefix, ...labelParts] = normalized.split(':')
  const type: GeographyType = (
    prefix === 'state' ||
    prefix === 'county' ||
    prefix === 'cmhsp' ||
    prefix === 'pihp'
  ) ? prefix : 'county'
  const slug = type === prefix ? labelParts.join(':') : normalized

  return { type, slug }
}

const facilitiesForGeography = (id: string) => {
  const { type, slug } = inferGeography(id)

  if (type === 'state') {
    return sampleFacilities
  }

  return sampleFacilities.filter((facility) => {
    const label = type === 'county'
      ? facility.county
      : type === 'cmhsp'
        ? facility.cmhsp
        : facility.pihp
    return slugify(label) === slug
  })
}

export const getAnalyticsForGeography = (id: string): GeographyAnalytics => {
  const facilities = facilitiesForGeography(id)
  const inferred = inferGeography(id)
  const firstFacility = facilities[0]
  const label = inferred.type === 'state'
    ? 'Michigan'
    : firstFacility
      ? (
        inferred.type === 'county'
          ? firstFacility.county
          : inferred.type === 'cmhsp'
            ? firstFacility.cmhsp
            : firstFacility.pihp
      )
      : id
  const allCapabilities = Object.keys(capabilityLabels) as FacilityCapability[]
  const capabilityScarcity = allCapabilities.map((capability) => ({
    capability,
    label: capabilityLabels[capability],
    scarcityScore: scoreCapabilityScarcity(facilities, capability),
    matchingFacilityCount: facilities.filter((facility) => (
      facility.capabilities.includes(capability)
    )).length,
  })).sort((left, right) => right.scarcityScore - left.scarcityScore).slice(0, 8)

  return {
    geographyId: inferred.type === 'state' ? 'state:michigan' : geographyId(inferred.type, label),
    geographyType: inferred.type,
    label,
    facilityCount: facilities.length,
    totalCapacity: sumCapacity(facilities),
    availableBeds: sumAvailableBeds(facilities),
    waitlistCount: sumWaitlist(facilities),
    scores: {
      residentialSupply: scoreResidentialSupply(facilities),
      liveAvailability: scoreLiveAvailability(facilities),
      capabilityScarcity: clampScore(average(
        capabilityScarcity.map((capability) => capability.scarcityScore),
      )),
      waitlistPressure: scoreWaitlistPressure(facilities),
      freshness: clampScore(average(facilities.map((facility) => scoreFacilityFreshness(facility)))),
      concern: clampScore(average(facilities.map((facility) => scoreConcern(facility)))),
      opportunity: scoreOpportunity(facilities),
    },
    capabilityScarcity,
    concernFacilities: facilities
      .map((facility) => ({
        facilityId: facility.id,
        name: facility.name,
        concernScore: scoreConcern(facility),
      }))
      .sort((left, right) => right.concernScore - left.concernScore),
  }
}

const claimToReviewRecord = (claim: Claim): ReviewRecord => ({
  id: `review-${claim.id}`,
  type: claim.claimType === 'user_submission' ? 'correction_submission' : 'provider_claim',
  status: 'queued',
  priority: claim.claimType === 'ai_extracted' ? 'normal' : 'low',
  facilityId: claim.facilityId,
  createdAt: claim.submittedAt,
  submittedByRole: claim.submittedByRole,
  sourceClaimIds: [claim.id],
  summary: claim.statement,
  payload: {
    field: claim.field,
    value: claim.value,
    sourceKind: claim.sourceKind,
  },
  auditLog: [
    {
      id: `audit-${claim.id}-queued`,
      actorRole: claim.submittedByRole,
      action: 'review_queued',
      subjectType: 'claim',
      subjectId: claim.id,
      occurredAt: claim.submittedAt,
    },
  ],
})

export const getReviewQueue = () => {
  const pendingFromClaims = sampleFacilities
    .flatMap((facility) => facility.claims)
    .filter((claim) => claim.reviewRequired || claim.status === 'pending_review')
    .map(claimToReviewRecord)

  const byId = new Map<string, ReviewRecord>()
  ;[...sampleReviewRecords, ...pendingFromClaims].forEach((record) => {
    byId.set(record.id, record)
  })

  return Array.from(byId.values()).sort((left, right) => (
    right.createdAt.localeCompare(left.createdAt)
  ))
}

export const draftProviderClaim = (input: ProviderClaimDraftInput) => {
  const now = input.now || new Date().toISOString()
  const claimId = makeDraftId('claim-provider', [input.facilityId, input.field], now)
  const sourceDocumentId = input.sourceUri
    ? makeDraftId('source-provider', [input.facilityId, input.field], now)
    : undefined
  const claim: Claim = {
    id: claimId,
    subjectType: 'facility',
    facilityId: input.facilityId,
    claimType: 'provider_overlay',
    sourceKind: 'provider_attestation',
    field: input.field,
    statement: input.statement,
    value: input.value,
    sourceDocumentId,
    submittedByRole: input.submittedByRole || 'provider',
    submittedByName: input.submittedByName,
    submittedAt: now,
    status: 'pending_review',
    confidence: 0.62,
    reviewRequired: true,
    visibility: 'provider_review',
  }
  const reviewRecord = claimToReviewRecord(claim)
  const sourceDocument = sourceDocumentId && input.sourceUri ? {
    id: sourceDocumentId,
    title: `Provider source for ${input.field}`,
    publisher: input.submittedByName || 'Provider submission',
    sourceType: 'provider',
    uri: input.sourceUri,
    retrievedAt: now.slice(0, 10),
  } satisfies SourceDocument : undefined

  return {
    claim,
    sourceDocument,
    reviewRecord,
    licensingFactsUnchanged: true,
  }
}

export const draftAvailabilityUpdate = (input: AvailabilityUpdateDraftInput) => {
  const now = input.now || new Date().toISOString()
  const facility = sampleFacilities.find((candidate) => candidate.id === input.facilityId)
  const totalCapacity = facility?.licenseSnapshot.capacity || 0
  const status = input.status || (
    input.bedsAvailable > 0 ? 'open' : input.acceptingReferrals ? 'waitlist' : 'unknown'
  )
  const availability: AvailabilitySnapshot = {
    id: makeDraftId('availability-draft', [input.facilityId], now),
    facilityId: input.facilityId,
    status,
    totalCapacity,
    bedsAvailable: Math.max(0, input.bedsAvailable),
    acceptingReferrals: input.acceptingReferrals,
    waitlistCount: Math.max(0, input.waitlistCount || 0),
    averageWaitDays: Math.max(0, input.averageWaitDays || 0),
    reportedAt: now,
    expiresAt: input.expiresAt || new Date(Date.parse(now) + 14 * DAY_MS).toISOString(),
    sourceDocumentIds: [],
    sourceClaimIds: [],
    notes: input.notes,
  }
  const fields: Array<[string, ClaimValue]> = [
    ['availability.status', availability.status],
    ['availability.bedsAvailable', availability.bedsAvailable],
    ['availability.acceptingReferrals', availability.acceptingReferrals],
    ['availability.waitlistCount', availability.waitlistCount],
    ['availability.averageWaitDays', availability.averageWaitDays],
  ]
  const claims = fields.map(([field, value]) => ({
    id: makeDraftId('claim-availability', [input.facilityId, field], now),
    subjectType: 'availability',
    facilityId: input.facilityId,
    claimType: 'provider_overlay',
    sourceKind: 'provider_attestation',
    field,
    statement: `Provider availability update for ${field}.`,
    value,
    submittedByRole: input.submittedByRole || 'provider',
    submittedByName: input.submittedByName,
    submittedAt: now,
    status: 'pending_review',
    confidence: 0.7,
    reviewRequired: true,
    visibility: 'provider_review',
  }) satisfies Claim)
  availability.sourceClaimIds = claims.map((claim) => claim.id)

  const reviewRecord: ReviewRecord = {
    id: makeDraftId('review-availability', [input.facilityId], now),
    type: 'availability_update',
    status: 'queued',
    priority: input.bedsAvailable > 0 ? 'high' : 'normal',
    facilityId: input.facilityId,
    createdAt: now,
    submittedByRole: input.submittedByRole || 'provider',
    sourceClaimIds: claims.map((claim) => claim.id),
    summary: `Review provider availability update for ${facility?.name || input.facilityId}.`,
    payload: {
      availability,
      notes: input.notes,
    },
    auditLog: [
      {
        id: makeDraftId('audit-availability', [input.facilityId], now),
        actorRole: input.submittedByRole || 'provider',
        action: 'review_queued',
        subjectType: 'availability',
        subjectId: availability.id,
        occurredAt: now,
      },
    ],
  }

  return {
    availability,
    claims,
    reviewRecord,
    licensingFactsUnchanged: true,
  }
}

export const draftCorrectionSubmission = (input: CorrectionSubmissionDraftInput) => {
  const now = input.now || new Date().toISOString()
  const claim: Claim = {
    id: makeDraftId('claim-correction', [input.facilityId, input.field], now),
    subjectType: 'facility',
    facilityId: input.facilityId,
    claimType: 'user_submission',
    sourceKind: 'user_submission',
    field: input.field,
    statement: input.reason,
    value: input.proposedValue,
    normalizedValue: input.proposedValue,
    sourceDocumentId: undefined,
    submittedByRole: input.submittedByRole || 'family',
    submittedByName: input.submittedByName,
    submittedAt: now,
    status: 'pending_review',
    confidence: 0.5,
    reviewRequired: true,
    visibility: 'provider_review',
  }
  const reviewRecord: ReviewRecord = {
    ...claimToReviewRecord(claim),
    type: 'correction_submission',
    priority: 'normal',
    payload: {
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      reason: input.reason,
    },
  }

  return {
    claim,
    reviewRecord,
    licensingFactsUnchanged: true,
  }
}

export const draftPrivateReferral = (input: PrivateReferralDraftInput) => {
  const now = input.now || new Date().toISOString()
  const referral: Referral = {
    id: makeDraftId('referral', [input.facilityId || input.preferredCounty || input.residentCounty], now),
    facilityId: input.facilityId,
    preferredCounty: input.preferredCounty,
    residentCounty: input.residentCounty,
    requestedCapabilities: input.requestedCapabilities,
    urgency: input.urgency,
    status: 'draft',
    createdAt: now,
    createdByRole: input.createdByRole || 'family',
    consentToShare: input.consentToShare,
    contact: input.contact,
    privateNotes: input.privateNotes,
  }
  const reviewRecord: ReviewRecord = {
    id: makeDraftId('review-referral', [referral.id], now),
    type: 'private_referral',
    status: 'queued',
    priority: input.urgency === 'urgent' ? 'high' : input.urgency === 'soon' ? 'normal' : 'low',
    facilityId: input.facilityId,
    createdAt: now,
    submittedByRole: input.createdByRole || 'family',
    sourceClaimIds: [],
    summary: input.facilityId
      ? `Private referral request for ${input.facilityId}.`
      : `Private referral request for ${input.preferredCounty || input.residentCounty}.`,
    payload: {
      referral,
      private: true,
    },
    auditLog: [
      {
        id: makeDraftId('audit-referral', [referral.id], now),
        actorRole: input.createdByRole || 'family',
        action: 'private_referral_created',
        subjectType: 'referral',
        subjectId: referral.id,
        occurredAt: now,
      },
    ],
  }

  return {
    referral,
    reviewRecord,
    facilityFit: input.facilityId
      ? (() => {
        const facility = sampleFacilities.find((candidate) => candidate.id === input.facilityId)
        return facility ? scoreReferralFit(facility, {
          county: input.preferredCounty || input.residentCounty,
          requestedCapabilities: input.requestedCapabilities,
          urgency: input.urgency,
          needsOpenBed: true,
        }) : 0
      })()
      : undefined,
    licensingFactsUnchanged: true,
  }
}

export const facilities = sampleFacilities
export const facilityTypeBands = facilityTypeCapacityBands
