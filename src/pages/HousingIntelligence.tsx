import { useMemo, useState, type ReactNode } from 'react'
import {
  buildSupplyLayer as platformBuildSupplyLayer,
  capabilityLabels as platformCapabilityLabels,
  facilityTypeCapacityBands as platformFacilityTypeBands,
  filterFacilities as platformFilterFacilities,
  getAnalyticsForGeography as platformGetAnalyticsForGeography,
  getFacilityProfile as platformGetFacilityProfile,
  getReviewQueue as platformGetReviewQueue,
  sampleFacilities as platformFacilities,
  type Facility as PlatformFacility,
  type FacilityCapability as PlatformCapabilityType,
  type FacilityFilters as PlatformFacilitySearchFilters,
} from '../lib/housingPlatform'
import './HousingIntelligence.css'

type CapabilityType =
  | 'autism'
  | 'behavioral'
  | 'communication'
  | 'crisis'
  | 'dualDiagnosis'
  | 'employment'
  | 'medical'
  | 'mobility'
  | 'transportation'

type LicenseStatus = 'Active' | 'Pending' | 'Provisional' | 'Suspended'
type SignalTone = 'good' | 'watch' | 'alert'
type LayerId =
  | 'supply'
  | 'availability'
  | 'scarcity'
  | 'gap'
  | 'concern'
  | 'opportunity'
  | 'freshness'
  | 'equity'

type Facility = {
  id: string
  name: string
  licenseNumber: string
  provider: string
  facilityType: string
  licenseStatus: LicenseStatus
  county: string
  city: string
  zip: string
  address: string
  cmhsp: string
  pihp: string
  region: string
  capacity: number
  openBeds: number
  ddServed: boolean
  ddCertification: boolean
  capabilities: CapabilityType[]
  ruleViolations: number
  freshness: number
  confidence: number
  coordinates: {
    lat: number
    lng: number
  }
  source: string
  lastUpdated: string
  availability: {
    status: string
    intakeWindow: string
    referralContact: string
    nextReview: string
  }
  staffing: {
    ratio: string
    awakeOvernight: string
    nursing: string
    behavioral: string
  }
  compliance: {
    lastSurvey: string
    qualityScore: number
    complaintTrend: string
    summary: string
  }
  publicSignals: Array<{
    label: string
    tone: SignalTone
  }>
  referral: {
    screening: string
    documents: string
    placementEstimate: string
  }
  provenance: {
    primary: string
    secondary: string
    lastMatched: string
    caveat: string
  }
  equity: {
    transitAccess: string
    languageAccess: string
    accessScore: number
  }
}

type FacilitySearchFilters = {
  search: string
  county: string
  cityZip: string
  cmhsp: string
  pihp: string
  licenseStatus: string
  facilityType: string
  capacityBand: string
  openBeds: string
  ddServed: string
  ddCertification: string
  capabilities: CapabilityType[]
  ruleViolations: string
  freshness: string
  confidence: string
}

type LayerPoint = {
  id: string
  x: number
  y: number
  radius: number
  score: number
  facility: Facility
}

type ReviewQueueItem = {
  id: string
  type: 'Claim' | 'Conflict' | 'AI suggestion'
  facilityId: string
  title: string
  detail: string
  priority: 'High' | 'Medium' | 'Low'
  source: string
}

const uiToPlatformCapability: Record<CapabilityType, PlatformCapabilityType> = {
  autism: 'autism-informed-supports',
  behavioral: 'behavior-support',
  communication: 'communication-device-support',
  crisis: 'de-escalation-trained-staff',
  dualDiagnosis: 'co-occurring-mental-health',
  employment: 'community-employment-support',
  medical: 'complex-medical-coordination',
  mobility: 'wheelchair-accessible',
  transportation: 'transportation',
}

const platformToUiCapability = Object.entries(uiToPlatformCapability).reduce<Partial<Record<PlatformCapabilityType, CapabilityType>>>(
  (acc, [uiCapability, platformCapability]) => ({
    ...acc,
    [platformCapability]: uiCapability as CapabilityType,
  }),
  {},
)

const capabilityLabels: Record<CapabilityType, string> = {
  autism: platformCapabilityLabels['autism-informed-supports'] || 'Autism-informed',
  behavioral: platformCapabilityLabels['behavior-support'] || 'Behavioral supports',
  communication: platformCapabilityLabels['communication-device-support'] || 'AAC/communication',
  crisis: 'Crisis step-down',
  dualDiagnosis: platformCapabilityLabels['co-occurring-mental-health'] || 'Dual diagnosis',
  employment: platformCapabilityLabels['community-employment-support'] || 'Employment pathway',
  medical: platformCapabilityLabels['complex-medical-coordination'] || 'Complex medical',
  mobility: platformCapabilityLabels['wheelchair-accessible'] || 'Mobility accessible',
  transportation: platformCapabilityLabels.transportation || 'Transportation',
}

const toneForCapacityBand = (maxCapacity: number | null) => {
  if (maxCapacity === null) return 'blue'
  if (maxCapacity <= 6) return 'green'
  if (maxCapacity <= 12) return 'teal'
  if (maxCapacity <= 20) return 'amber'
  return 'red'
}

const platformFacilityBands = Object.values(platformFacilityTypeBands).reduce<Record<string, { label: string; tone: string }>>(
  (acc, band) => ({
    ...acc,
    [band.laraLabel]: {
      label: band.laraLabel,
      tone: toneForCapacityBand(band.maxCapacity),
    },
  }),
  {},
)

const facilityTypeBands: Record<string, { label: string; tone: string }> = platformFacilityBands

const toUiLicenseStatus = (status: PlatformFacility['licenseSnapshot']['licenseStatus']): LicenseStatus => {
  if (status === 'active') return 'Active'
  if (status === 'provisional') return 'Provisional'
  if (status === 'suspended' || status === 'revoked' || status === 'closed') return 'Suspended'
  return 'Pending'
}

const toUiCapabilities = (capabilities: PlatformCapabilityType[]): CapabilityType[] => {
  const mapped = capabilities
    .map((capability) => platformToUiCapability[capability])
    .filter((capability): capability is CapabilityType => Boolean(capability))
  return Array.from(new Set(mapped.length ? mapped : (['transportation'] satisfies CapabilityType[])))
}

const latestComplianceEvent = (facility: PlatformFacility) => (
  [...facility.complianceEvents].sort((left, right) => right.eventDate.localeCompare(left.eventDate))[0]
)

const activeComplianceEvents = (facility: PlatformFacility) => (
  facility.complianceEvents.filter((event) => event.status === 'open' || event.status === 'monitoring')
)

const availabilityLabel = (facility: PlatformFacility) => {
  if (facility.availability.bedsAvailable > 0 && facility.availability.acceptingReferrals) {
    return `${facility.availability.bedsAvailable} open bed${facility.availability.bedsAvailable === 1 ? '' : 's'} reported`
  }
  if (facility.availability.status === 'waitlist') return 'Waitlist only'
  if (facility.availability.acceptingReferrals) return 'Accepting referrals'
  return 'Not accepting referrals'
}

const mapPlatformFacility = (facility: PlatformFacility): Facility => {
  const profile = platformGetFacilityProfile(facility.id)
  const latestCompliance = latestComplianceEvent(facility)
  const openCompliance = activeComplianceEvents(facility)
  const providerName = profile?.organization?.name || facility.organizationId
  const provenance = profile?.provenance || []
  const primarySource = provenance[0]
  const secondarySource = provenance[1]
  const warningSignals = facility.dataQuality.warnings.slice(0, 2).map((warning) => ({
    label: warning,
    tone: 'watch' as const,
  }))
  const complianceSignals = openCompliance.slice(0, 2).map((event) => ({
    label: event.summary,
    tone: event.severity === 'high' ? 'alert' as const : 'watch' as const,
  }))
  const publicSignals = [...warningSignals, ...complianceSignals]

  return {
    id: facility.id,
    name: facility.name,
    licenseNumber: facility.licenseSnapshot.licenseNumber,
    provider: providerName,
    facilityType: facility.licenseSnapshot.facilityTypeLabel,
    licenseStatus: toUiLicenseStatus(facility.licenseSnapshot.licenseStatus),
    county: facility.county,
    city: facility.city,
    zip: facility.zip,
    address: facility.address,
    cmhsp: facility.cmhsp,
    pihp: facility.pihp,
    region: facility.regionLabel,
    capacity: facility.licenseSnapshot.capacity,
    openBeds: facility.availability.bedsAvailable,
    ddServed: facility.serviceFlags.servesDevelopmentalDisability,
    ddCertification: facility.serviceFlags.specializedProgramForDevelopmentalDisability,
    capabilities: toUiCapabilities(facility.capabilities),
    ruleViolations: openCompliance.length,
    freshness: facility.scores.freshness,
    confidence: facility.dataQuality.overall,
    coordinates: {
      lat: facility.latitude,
      lng: facility.longitude,
    },
    source: primarySource ? `${primarySource.publisher}: ${primarySource.title}` : 'Worker A housing platform seed',
    lastUpdated: facility.availability.reportedAt.slice(0, 10) || facility.dataQuality.lastScoredAt.slice(0, 10),
    availability: {
      status: availabilityLabel(facility),
      intakeWindow: facility.availability.notes || `${facility.availability.averageWaitDays} day average wait`,
      referralContact: profile?.organization?.contactEmail || 'CMHSP referral desk',
      nextReview: facility.availability.expiresAt.slice(0, 10),
    },
    staffing: {
      ratio: `${facility.staffing.daytimeStaffRatio} day, ${facility.staffing.overnightStaffRatio} overnight`,
      awakeOvernight: facility.staffing.awakeOvernightStaff ? 'Yes' : 'No',
      nursing: facility.staffing.licensedNurseOnCall ? 'Licensed nurse on call' : 'Nursing not verified',
      behavioral: facility.staffing.trainingHighlights
        .map((capability) => platformCapabilityLabels[capability])
        .slice(0, 3)
        .join(', ') || 'Training highlights not reported',
    },
    compliance: {
      lastSurvey: latestCompliance?.eventDate || facility.licenseSnapshot.lastVerifiedAt.slice(0, 10),
      qualityScore: Math.max(0, Math.min(100, 100 - facility.scores.concern)),
      complaintTrend: openCompliance.length ? `${openCompliance.length} open or monitoring events` : 'No open compliance events',
      summary: latestCompliance?.summary || 'No recent compliance event in Worker A seed data.',
    },
    publicSignals: publicSignals.length
      ? publicSignals
      : [{ label: 'No public concern signals in current seed data', tone: 'good' }],
    referral: {
      screening: facility.availability.acceptingReferrals ? 'CMHSP referral and support needs screen' : 'Hold until referral status changes',
      documents: 'PCP, guardianship, medication list, behavior and communication plans as applicable',
      placementEstimate: facility.availability.averageWaitDays
        ? `${facility.availability.averageWaitDays} day average wait`
        : 'Timing not reported',
    },
    provenance: {
      primary: primarySource?.title || 'Platform seed source',
      secondary: secondarySource?.title || 'No secondary source linked',
      lastMatched: `Matched on ${facility.sourceDocumentIds.length} source document id${facility.sourceDocumentIds.length === 1 ? '' : 's'}`,
      caveat: facility.dataQuality.warnings[0] || 'Use provenance documents before publishing external decisions.',
    },
    equity: {
      transitAccess: facility.serviceFlags.providesTransportation ? 'Transportation support reported' : 'Transportation support not reported',
      languageAccess: 'Interpretation workflow not yet normalized',
      accessScore: facility.serviceFlags.wheelchairAccessible ? 78 : 58,
    },
  }
}

const facilities: Facility[] = platformFacilities.map(mapPlatformFacility)

const platformCountyMetricCount = platformBuildSupplyLayer().length

const defaultFilters: FacilitySearchFilters = {
  search: '',
  county: 'All',
  cityZip: '',
  cmhsp: 'All',
  pihp: 'All',
  licenseStatus: 'All',
  facilityType: 'All',
  capacityBand: 'All',
  openBeds: 'All',
  ddServed: 'All',
  ddCertification: 'All',
  capabilities: [],
  ruleViolations: 'All',
  freshness: 'All',
  confidence: 'All',
}

const layerOptions: Array<{ id: LayerId; label: string; hint: string }> = [
  { id: 'supply', label: 'Supply', hint: 'Licensed capacity' },
  { id: 'availability', label: 'Availability', hint: 'Open beds' },
  { id: 'scarcity', label: 'Capability scarcity', hint: 'Few specialized supports' },
  { id: 'gap', label: 'Demand/gap', hint: 'Regional pressure' },
  { id: 'concern', label: 'Concern', hint: 'Licensure and findings' },
  { id: 'opportunity', label: 'Opportunity', hint: 'Ready capacity' },
  { id: 'freshness', label: 'Freshness', hint: 'Data recency' },
  { id: 'equity', label: 'Equity/access', hint: 'Transit and language access' },
]

const formatPercent = (value: number) => `${Math.round(value)}%`

const normalizeText = (value: string) => value.trim().toLowerCase()

const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))

const inCapacityBand = (facility: Facility, band: string) => {
  if (band === 'All') return true
  if (band === '1-6') return facility.capacity >= 1 && facility.capacity <= 6
  if (band === '7-12') return facility.capacity >= 7 && facility.capacity <= 12
  if (band === '13-20') return facility.capacity >= 13 && facility.capacity <= 20
  return facility.capacity >= 21
}

const meetsThreshold = (value: number, threshold: string) => threshold === 'All' || value >= Number(threshold)

const toPlatformFilters = (filters: FacilitySearchFilters): PlatformFacilitySearchFilters => {
  const serviceFlags: PlatformFacilitySearchFilters['serviceFlags'] = {}
  const platformCapabilities = filters.capabilities.map((capability) => uiToPlatformCapability[capability])
  const cityLooksLikeZip = /^\d/.test(filters.cityZip.trim())

  if (filters.ddServed !== 'All') {
    serviceFlags.servesDevelopmentalDisability = filters.ddServed === 'Yes'
  }

  if (filters.ddCertification !== 'All') {
    serviceFlags.specializedProgramForDevelopmentalDisability = filters.ddCertification === 'Yes'
  }

  return {
    county: filters.county === 'All' ? undefined : filters.county,
    city: filters.cityZip && !cityLooksLikeZip ? filters.cityZip : undefined,
    cmhsp: filters.cmhsp === 'All' ? undefined : filters.cmhsp,
    pihp: filters.pihp === 'All' ? undefined : filters.pihp,
    capabilities: platformCapabilities.length ? platformCapabilities : undefined,
    minAvailableBeds: filters.openBeds === 'All' ? undefined : Number(filters.openBeds),
    serviceFlags: Object.keys(serviceFlags).length ? serviceFlags : undefined,
  }
}

const filterFacilities = (input: Facility[], filters: FacilitySearchFilters) => {
  const query = normalizeText(filters.search)
  const cityZip = normalizeText(filters.cityZip)
  const platformIds = new Set(platformFilterFacilities(toPlatformFilters(filters)).map((facility) => facility.id))

  return input.filter((facility) => {
    const searchable = normalizeText([
      facility.name,
      facility.licenseNumber,
      facility.provider,
      facility.source,
    ].join(' '))

    const matchesQuery = !query || searchable.includes(query)
    const matchesCityZip = !cityZip || normalizeText(`${facility.city} ${facility.zip}`).includes(cityZip)
    const matchesCounty = filters.county === 'All' || facility.county === filters.county
    const matchesCmhsp = filters.cmhsp === 'All' || facility.cmhsp === filters.cmhsp
    const matchesPihp = filters.pihp === 'All' || facility.pihp === filters.pihp
    const matchesStatus = filters.licenseStatus === 'All' || facility.licenseStatus === filters.licenseStatus
    const matchesType = filters.facilityType === 'All' || facility.facilityType === filters.facilityType
    const matchesCapacity = inCapacityBand(facility, filters.capacityBand)
    const matchesOpenBeds = filters.openBeds === 'All' || facility.openBeds >= Number(filters.openBeds)
    const matchesDdServed = filters.ddServed === 'All' || facility.ddServed === (filters.ddServed === 'Yes')
    const matchesDdCertification =
      filters.ddCertification === 'All' || facility.ddCertification === (filters.ddCertification === 'Yes')
    const matchesCapabilities = filters.capabilities.every((capability) => facility.capabilities.includes(capability))
    const matchesViolations =
      filters.ruleViolations === 'All' ||
      (filters.ruleViolations === 'None' && facility.ruleViolations === 0) ||
      (filters.ruleViolations === 'Has findings' && facility.ruleViolations > 0)
    const matchesFreshness = meetsThreshold(facility.freshness, filters.freshness)
    const matchesConfidence = meetsThreshold(facility.confidence, filters.confidence)
    const matchesPlatformFilter = platformIds.has(facility.id)

    return (
      matchesPlatformFilter &&
      matchesQuery &&
      matchesCityZip &&
      matchesCounty &&
      matchesCmhsp &&
      matchesPihp &&
      matchesStatus &&
      matchesType &&
      matchesCapacity &&
      matchesOpenBeds &&
      matchesDdServed &&
      matchesDdCertification &&
      matchesCapabilities &&
      matchesViolations &&
      matchesFreshness &&
      matchesConfidence
    )
  })
}

const getFacilityProfile = (facilityId: string) => facilities.find((facility) => facility.id === facilityId) || facilities[0]

const coordinateToPoint = (facility: Facility) => {
  const minLng = -90.5
  const maxLng = -82.0
  const minLat = 41.5
  const maxLat = 47.5
  const rawX = ((facility.coordinates.lng - minLng) / (maxLng - minLng)) * 100
  const rawY = (1 - (facility.coordinates.lat - minLat) / (maxLat - minLat)) * 100

  return {
    x: Math.min(94, Math.max(6, rawX)),
    y: Math.min(92, Math.max(8, rawY)),
  }
}

const buildSupplyLayer = (input: Facility[]): LayerPoint[] =>
  input.map((facility) => {
    const point = coordinateToPoint(facility)
    return {
      id: facility.id,
      x: point.x,
      y: point.y,
      radius: 5 + Math.min(12, facility.capacity / 2.4),
      score: facility.capacity,
      facility,
    }
  })

const buildGapLayer = (input: Facility[]): LayerPoint[] => {
  const byRegion = uniqueSorted(input.map((facility) => facility.region))

  return byRegion.map((region) => {
    const regionFacilities = input.filter((facility) => facility.region === region)
    const totals = regionFacilities.reduce(
      (acc, facility) => ({
        capacity: acc.capacity + facility.capacity,
        openBeds: acc.openBeds + facility.openBeds,
        certified: acc.certified + (facility.ddCertification ? 1 : 0),
        x: acc.x + coordinateToPoint(facility).x,
        y: acc.y + coordinateToPoint(facility).y,
      }),
      { capacity: 0, openBeds: 0, certified: 0, x: 0, y: 0 },
    )
    const count = Math.max(1, regionFacilities.length)
    const pressure = Math.max(12, 72 - totals.openBeds * 7 - totals.certified * 2 + totals.capacity * 0.4)

    return {
      id: region,
      x: totals.x / count,
      y: totals.y / count,
      radius: Math.min(26, Math.max(13, pressure / 3.4)),
      score: pressure,
      facility: regionFacilities[0],
    }
  })
}

const buildOpportunityLayer = (input: Facility[]): LayerPoint[] =>
  input
    .filter((facility) => facility.openBeds > 0)
    .map((facility) => {
      const point = coordinateToPoint(facility)
      const score =
        facility.openBeds * 14 +
        facility.confidence * 0.25 +
        facility.freshness * 0.2 +
        (facility.ddCertification ? 12 : 0) -
        facility.ruleViolations * 10

      return {
        id: facility.id,
        x: point.x,
        y: point.y,
        radius: Math.max(8, Math.min(18, score / 5.2)),
        score,
        facility,
      }
    })

const getAnalyticsForGeography = (geography: string, input: Facility[]) => {
  const scoped =
    geography === 'Statewide'
      ? input
      : input.filter((facility) => facility.region === geography || facility.county === geography)
  const activeFacilities = scoped.length ? scoped : input
  const capacity = activeFacilities.reduce((total, facility) => total + facility.capacity, 0)
  const openBeds = activeFacilities.reduce((total, facility) => total + facility.openBeds, 0)
  const certified = activeFacilities.filter((facility) => facility.ddCertification).length
  const concernCount = activeFacilities.filter(
    (facility) => facility.ruleViolations > 0 || facility.licenseStatus !== 'Active',
  ).length
  const confidence =
    activeFacilities.reduce((total, facility) => total + facility.confidence, 0) / Math.max(1, activeFacilities.length)
  const freshness =
    activeFacilities.reduce((total, facility) => total + facility.freshness, 0) / Math.max(1, activeFacilities.length)

  return {
    facilities: activeFacilities.length,
    capacity,
    openBeds,
    certified,
    concernCount,
    confidence,
    freshness,
  }
}

const fallbackReviewQueue = (): ReviewQueueItem[] => [
  {
    id: 'claim-thumb-access',
    type: 'Claim',
    facilityId: 'thumb-access',
    title: 'Provider claimed two open beds while license is pending',
    detail: 'Hold availability until state roster and CMHSP file agree on active status.',
    priority: 'High',
    source: 'Provider portal',
  },
  {
    id: 'conflict-harbor',
    type: 'Conflict',
    facilityId: 'harbor-step',
    title: 'Crisis capability published, DD certification absent',
    detail: 'Public signal and provider claim disagree with certification field.',
    priority: 'High',
    source: 'AI conflict detector',
  },
  {
    id: 'ai-northern-lakes',
    type: 'AI suggestion',
    facilityId: 'northern-lakes',
    title: 'Medical capability appears scarce in Northwest region',
    detail: 'Suggest adding to opportunity outreach list despite no current open beds.',
    priority: 'Medium',
    source: 'Gap layer model',
  },
  {
    id: 'freshness-soo',
    type: 'Claim',
    facilityId: 'soo-community',
    title: 'Phone-verified bed count is aging',
    detail: 'Refresh before showing as firm availability in referral exports.',
    priority: 'Low',
    source: 'Freshness monitor',
  },
]

const getReviewQueue = (): ReviewQueueItem[] => {
  const platformRecords = platformGetReviewQueue()

  if (!platformRecords.length) return fallbackReviewQueue()

  return platformRecords.slice(0, 6).map((record, index) => {
    const fallbackFacility = facilities[index % facilities.length]
    const facilityId = record.facilityId && facilities.some((facility) => facility.id === record.facilityId)
      ? record.facilityId
      : fallbackFacility.id

    return {
      id: record.id,
      type: record.type === 'availability_update'
        ? 'Claim'
        : record.type === 'correction_submission'
          ? 'Conflict'
          : 'AI suggestion',
      facilityId,
      title: record.summary,
      detail: `${record.status.replace(/_/g, ' ')} review from ${record.submittedByRole.replace(/_/g, ' ')}`,
      priority: record.priority === 'high' ? 'High' : record.priority === 'normal' ? 'Medium' : 'Low',
      source: record.sourceClaimIds.join(', ') || record.type.replace(/_/g, ' '),
    }
  })
}

const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const Icon = ({ name }: { name: 'building' | 'filter' | 'map' | 'profile' | 'queue' | 'sync' | 'workflow' }) => {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'filter') {
    return (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M7 12h10" />
        <path d="M10 18h4" />
      </svg>
    )
  }

  if (name === 'map') {
    return (
      <svg {...common}>
        <path d="M4 6.5 9 4l6 2.5 5-2.5v13.5L15 20l-6-2.5-5 2.5Z" />
        <path d="M9 4v13.5" />
        <path d="M15 6.5V20" />
      </svg>
    )
  }

  if (name === 'profile') {
    return (
      <svg {...common}>
        <path d="M5 5.5h14v13H5z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
        <path d="M8 16h7" />
      </svg>
    )
  }

  if (name === 'queue') {
    return (
      <svg {...common}>
        <path d="M6 5h12" />
        <path d="M6 12h12" />
        <path d="M6 19h12" />
        <path d="m4 5 .8.8L6.5 4" />
        <path d="m4 12 .8.8 1.7-1.8" />
        <path d="m4 19 .8.8 1.7-1.8" />
      </svg>
    )
  }

  if (name === 'sync') {
    return (
      <svg {...common}>
        <path d="M20 6v5h-5" />
        <path d="M4 18v-5h5" />
        <path d="M18 9.5A6.5 6.5 0 0 0 7.1 6.8L4 10" />
        <path d="M6 14.5a6.5 6.5 0 0 0 10.9 2.7L20 14" />
      </svg>
    )
  }

  if (name === 'workflow') {
    return (
      <svg {...common}>
        <path d="M5 7h5" />
        <path d="M14 7h5" />
        <path d="M7.5 7v10" />
        <path d="M16.5 7v10" />
        <path d="M5 17h5" />
        <path d="M14 17h5" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M5 20V7l7-3 7 3v13" />
      <path d="M9 20v-6h6v6" />
      <path d="M9 9h.01" />
      <path d="M12 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  )
}

function PanelTitle({ icon, title, action }: { icon: Parameters<typeof Icon>[0]['name']; title: string; action?: ReactNode }) {
  return (
    <div className="hi-panel-title">
      <span className="hi-panel-title__icon">
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      {action && <div className="hi-panel-title__action">{action}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="hi-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="hi-metric">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  )
}

function StatusPill({ value }: { value: string }) {
  return <span className={`hi-status hi-status--${statusClass(value)}`}>{value}</span>
}

function CapabilityChip({ capability, selected, onClick }: { capability: CapabilityType; selected?: boolean; onClick?: () => void }) {
  if (!onClick) {
    return <span className="hi-chip">{capabilityLabels[capability]}</span>
  }

  return (
    <button
      type="button"
      className={`hi-chip hi-chip--button${selected ? ' is-selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {capabilityLabels[capability]}
    </button>
  )
}

function FilterPanel({
  filters,
  facilitiesForOptions,
  onFilterChange,
  onCapabilityToggle,
  onReset,
}: {
  filters: FacilitySearchFilters
  facilitiesForOptions: Facility[]
  onFilterChange: <K extends keyof FacilitySearchFilters>(key: K, value: FacilitySearchFilters[K]) => void
  onCapabilityToggle: (capability: CapabilityType) => void
  onReset: () => void
}) {
  const counties = uniqueSorted(facilitiesForOptions.map((facility) => facility.county))
  const cmhsps = uniqueSorted(facilitiesForOptions.map((facility) => facility.cmhsp))
  const pihps = uniqueSorted(facilitiesForOptions.map((facility) => facility.pihp))
  const facilityTypes = uniqueSorted(facilitiesForOptions.map((facility) => facility.facilityType))
  const capabilities = Object.keys(capabilityLabels) as CapabilityType[]

  return (
    <aside className="hi-panel hi-filter-panel" aria-label="Facility search filters">
      <PanelTitle
        icon="filter"
        title="Search and Filters"
        action={
          <button type="button" className="hi-text-button" onClick={onReset}>
            Reset
          </button>
        }
      />

      <div className="hi-filter-grid">
        <Field label="Facility name or license">
          <input
            value={filters.search}
            onChange={(event) => onFilterChange('search', event.target.value)}
            placeholder="Name, provider, AFC number"
          />
        </Field>

        <Field label="County">
          <select value={filters.county} onChange={(event) => onFilterChange('county', event.target.value)}>
            <option>All</option>
            {counties.map((county) => (
              <option key={county}>{county}</option>
            ))}
          </select>
        </Field>

        <Field label="City or ZIP">
          <input
            value={filters.cityZip}
            onChange={(event) => onFilterChange('cityZip', event.target.value)}
            placeholder="Detroit, 48912"
          />
        </Field>

        <Field label="CMHSP">
          <select value={filters.cmhsp} onChange={(event) => onFilterChange('cmhsp', event.target.value)}>
            <option>All</option>
            {cmhsps.map((cmhsp) => (
              <option key={cmhsp}>{cmhsp}</option>
            ))}
          </select>
        </Field>

        <Field label="PIHP">
          <select value={filters.pihp} onChange={(event) => onFilterChange('pihp', event.target.value)}>
            <option>All</option>
            {pihps.map((pihp) => (
              <option key={pihp}>{pihp}</option>
            ))}
          </select>
        </Field>

        <Field label="License status">
          <select
            value={filters.licenseStatus}
            onChange={(event) => onFilterChange('licenseStatus', event.target.value)}
          >
            <option>All</option>
            <option>Active</option>
            <option>Pending</option>
            <option>Provisional</option>
            <option>Suspended</option>
          </select>
        </Field>

        <Field label="Facility type">
          <select value={filters.facilityType} onChange={(event) => onFilterChange('facilityType', event.target.value)}>
            <option>All</option>
            {facilityTypes.map((facilityType) => (
              <option key={facilityType}>{facilityType}</option>
            ))}
          </select>
        </Field>

        <div className="hi-field-row">
          <Field label="Capacity">
            <select value={filters.capacityBand} onChange={(event) => onFilterChange('capacityBand', event.target.value)}>
              <option>All</option>
              <option>1-6</option>
              <option>7-12</option>
              <option>13-20</option>
              <option>21+</option>
            </select>
          </Field>

          <Field label="Open beds">
            <select value={filters.openBeds} onChange={(event) => onFilterChange('openBeds', event.target.value)}>
              <option>All</option>
              <option value="1">1+</option>
              <option value="3">3+</option>
              <option value="5">5+</option>
            </select>
          </Field>
        </div>

        <div className="hi-field-row">
          <Field label="DD served">
            <select value={filters.ddServed} onChange={(event) => onFilterChange('ddServed', event.target.value)}>
              <option>All</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </Field>

          <Field label="DD certification">
            <select
              value={filters.ddCertification}
              onChange={(event) => onFilterChange('ddCertification', event.target.value)}
            >
              <option>All</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </Field>
        </div>

        <div className="hi-capability-filter" aria-label="Capability filters">
          <span>Capability chips</span>
          <div>
            {capabilities.map((capability) => (
              <CapabilityChip
                capability={capability}
                key={capability}
                selected={filters.capabilities.includes(capability)}
                onClick={() => onCapabilityToggle(capability)}
              />
            ))}
          </div>
        </div>

        <Field label="Rule violations">
          <select
            value={filters.ruleViolations}
            onChange={(event) => onFilterChange('ruleViolations', event.target.value)}
          >
            <option>All</option>
            <option>None</option>
            <option>Has findings</option>
          </select>
        </Field>

        <div className="hi-field-row">
          <Field label="Freshness">
            <select value={filters.freshness} onChange={(event) => onFilterChange('freshness', event.target.value)}>
              <option>All</option>
              <option value="60">60%+</option>
              <option value="75">75%+</option>
              <option value="90">90%+</option>
            </select>
          </Field>

          <Field label="Confidence">
            <select value={filters.confidence} onChange={(event) => onFilterChange('confidence', event.target.value)}>
              <option>All</option>
              <option value="70">70%+</option>
              <option value="85">85%+</option>
              <option value="90">90%+</option>
            </select>
          </Field>
        </div>
      </div>
    </aside>
  )
}

function IntelligenceMap({
  filteredFacilities,
  selectedFacilityId,
  activeLayers,
  onLayerToggle,
  onSelectFacility,
}: {
  filteredFacilities: Facility[]
  selectedFacilityId: string
  activeLayers: LayerId[]
  onLayerToggle: (layer: LayerId) => void
  onSelectFacility: (facilityId: string) => void
}) {
  const supplyLayer = useMemo(() => buildSupplyLayer(filteredFacilities), [filteredFacilities])
  const gapLayer = useMemo(() => buildGapLayer(filteredFacilities), [filteredFacilities])
  const opportunityLayer = useMemo(() => buildOpportunityLayer(filteredFacilities), [filteredFacilities])

  return (
    <section className="hi-panel hi-map-panel" aria-labelledby="housing-map-title">
      <PanelTitle
        icon="map"
        title="Intelligence Map"
        action={<span className="hi-panel-count">{filteredFacilities.length} matched · {platformCountyMetricCount} county metrics</span>}
      />

      <div className="hi-layer-toggles" aria-label="Map layer toggles">
        {layerOptions.map((layer) => (
          <button
            type="button"
            key={layer.id}
            className={`hi-layer-toggle hi-layer-toggle--${layer.id}${activeLayers.includes(layer.id) ? ' is-active' : ''}`}
            onClick={() => onLayerToggle(layer.id)}
            aria-pressed={activeLayers.includes(layer.id)}
            title={layer.hint}
          >
            <span />
            {layer.label}
          </button>
        ))}
      </div>

      <div className="hi-map-canvas" role="img" aria-label="Michigan facility intelligence map">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <pattern id="hi-map-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" />
            </pattern>
          </defs>
          <rect className="hi-map__water" width="100" height="100" />
          <rect className="hi-map__grid" width="100" height="100" fill="url(#hi-map-grid)" />
          <path
            className="hi-map__land"
            d="M61 19c7 3 10 9 9 17 5 5 7 13 4 22-3 10-11 21-20 25-7 3-14-1-15-8-1-8 4-14 1-22-2-5-8-7-8-13 0-8 10-8 13-16 2-5 8-8 16-5Z"
          />
          <path
            className="hi-map__land hi-map__land--upper"
            d="M10 27c11-8 24-11 39-10 8 1 13 4 18 8-12 2-20 6-31 8-10 2-18 1-26-6Z"
          />
          <path className="hi-map__route" d="M41 72c7-10 16-17 28-20" />
          <path className="hi-map__route" d="M25 28c15 1 28 0 42-4" />

          {activeLayers.includes('gap') &&
            gapLayer.map((point) => (
              <circle
                key={`gap-${point.id}`}
                className="hi-map__gap"
                cx={point.x}
                cy={point.y}
                r={point.radius}
              />
            ))}

          {activeLayers.includes('equity') &&
            supplyLayer.map((point) => (
              <path
                key={`equity-${point.id}`}
                className="hi-map__equity"
                d={`M${point.x} ${point.y - 5} ${point.x + 5} ${point.y} ${point.x} ${point.y + 5} ${point.x - 5} ${point.y}Z`}
                opacity={Math.max(0.24, point.facility.equity.accessScore / 100)}
              />
            ))}

          {activeLayers.includes('opportunity') &&
            opportunityLayer.map((point) => (
              <path
                key={`opportunity-${point.id}`}
                className="hi-map__opportunity"
                d={`M${point.x} ${point.y - point.radius} ${point.x + point.radius * 0.9} ${point.y + point.radius * 0.75} ${point.x - point.radius * 0.9} ${point.y + point.radius * 0.75}Z`}
              />
            ))}

          {supplyLayer.map((point) => {
            const hasConcern =
              point.facility.ruleViolations > 0 ||
              point.facility.licenseStatus === 'Pending' ||
              point.facility.licenseStatus === 'Provisional'
            const scarcity = Math.max(0, 6 - point.facility.capabilities.length)

            return (
              <g
                key={point.id}
                className={`hi-map-point${point.facility.id === selectedFacilityId ? ' is-selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectFacility(point.facility.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelectFacility(point.facility.id)
                }}
              >
                {activeLayers.includes('scarcity') && scarcity > 0 && (
                  <circle className="hi-map__scarcity" cx={point.x} cy={point.y} r={point.radius + scarcity} />
                )}
                {activeLayers.includes('freshness') && point.facility.freshness < 80 && (
                  <circle className="hi-map__freshness" cx={point.x} cy={point.y} r={point.radius + 7} />
                )}
                {activeLayers.includes('availability') && point.facility.openBeds > 0 && (
                  <circle
                    className="hi-map__availability"
                    cx={point.x}
                    cy={point.y}
                    r={point.radius + point.facility.openBeds}
                  />
                )}
                {activeLayers.includes('concern') && hasConcern && (
                  <circle className="hi-map__concern" cx={point.x} cy={point.y} r={point.radius + 4} />
                )}
                {activeLayers.includes('supply') && (
                  <circle className="hi-map__supply" cx={point.x} cy={point.y} r={point.radius} />
                )}
                <circle className="hi-map__core" cx={point.x} cy={point.y} r="2.2" />
              </g>
            )
          })}
        </svg>

        <div className="hi-map-legend" aria-label="Map legend">
          <span><i className="hi-legend-supply" /> Capacity</span>
          <span><i className="hi-legend-open" /> Open beds</span>
          <span><i className="hi-legend-gap" /> Gap pressure</span>
          <span><i className="hi-legend-concern" /> Review concern</span>
        </div>
      </div>
    </section>
  )
}

function FacilityProfile({ facility, onReferralStart }: { facility: Facility; onReferralStart: (message: string) => void }) {
  const band = facilityTypeBands[facility.facilityType]

  return (
    <aside className="hi-panel hi-profile-panel" aria-labelledby="facility-profile-title">
      <PanelTitle icon="profile" title="Facility Profile" />

      <div className="hi-profile-header">
        <div>
          <h2 id="facility-profile-title">{facility.name}</h2>
          <p>{facility.provider}</p>
        </div>
        <StatusPill value={facility.licenseStatus} />
      </div>

      <div className="hi-profile-meta">
        <span>{facility.licenseNumber}</span>
        <span>{facility.city}, {facility.county} County</span>
        <span className={`hi-type-band hi-type-band--${band?.tone || 'teal'}`}>{band?.label || facility.facilityType}</span>
      </div>

      <section className="hi-profile-section">
        <h3>Snapshot</h3>
        <div className="hi-snapshot-grid">
          <span><strong>{facility.capacity}</strong> capacity</span>
          <span><strong>{facility.openBeds}</strong> open beds</span>
          <span><strong>{facility.ddServed ? 'Yes' : 'No'}</strong> DD served</span>
          <span><strong>{facility.ddCertification ? 'Yes' : 'No'}</strong> DD certified</span>
        </div>
        <dl className="hi-profile-list">
          <div>
            <dt>CMHSP</dt>
            <dd>{facility.cmhsp}</dd>
          </div>
          <div>
            <dt>PIHP</dt>
            <dd>{facility.pihp}</dd>
          </div>
        </dl>
      </section>

      <section className="hi-profile-section">
        <h3>Availability</h3>
        <dl className="hi-profile-list">
          <div>
            <dt>Status</dt>
            <dd>{facility.availability.status}</dd>
          </div>
          <div>
            <dt>Intake window</dt>
            <dd>{facility.availability.intakeWindow}</dd>
          </div>
          <div>
            <dt>Referral contact</dt>
            <dd>{facility.availability.referralContact}</dd>
          </div>
        </dl>
      </section>

      <section className="hi-profile-section">
        <h3>Capabilities</h3>
        <div className="hi-chip-wrap">
          {facility.capabilities.map((capability) => (
            <CapabilityChip capability={capability} key={capability} />
          ))}
        </div>
      </section>

      <section className="hi-profile-section">
        <h3>Staffing</h3>
        <dl className="hi-profile-list">
          <div>
            <dt>Ratio</dt>
            <dd>{facility.staffing.ratio}</dd>
          </div>
          <div>
            <dt>Awake overnight</dt>
            <dd>{facility.staffing.awakeOvernight}</dd>
          </div>
          <div>
            <dt>Nursing</dt>
            <dd>{facility.staffing.nursing}</dd>
          </div>
          <div>
            <dt>Behavioral</dt>
            <dd>{facility.staffing.behavioral}</dd>
          </div>
        </dl>
      </section>

      <section className="hi-profile-section">
        <h3>Compliance and Quality</h3>
        <div className="hi-quality-meter">
          <span style={{ width: `${facility.compliance.qualityScore}%` }} />
        </div>
        <dl className="hi-profile-list">
          <div>
            <dt>Quality score</dt>
            <dd>{facility.compliance.qualityScore}/100</dd>
          </div>
          <div>
            <dt>Last survey</dt>
            <dd>{facility.compliance.lastSurvey}</dd>
          </div>
          <div>
            <dt>Rule findings</dt>
            <dd>{facility.ruleViolations}</dd>
          </div>
          <div>
            <dt>Complaint trend</dt>
            <dd>{facility.compliance.complaintTrend}</dd>
          </div>
        </dl>
        <p>{facility.compliance.summary}</p>
      </section>

      <section className="hi-profile-section">
        <h3>News and Public Signals</h3>
        <ul className="hi-signal-list">
          {facility.publicSignals.map((signal) => (
            <li className={`hi-signal hi-signal--${signal.tone}`} key={signal.label}>{signal.label}</li>
          ))}
        </ul>
      </section>

      <section className="hi-profile-section">
        <h3>Referral Workflow</h3>
        <ol className="hi-referral-steps">
          <li>
            <strong>Screen</strong>
            <span>{facility.referral.screening}</span>
          </li>
          <li>
            <strong>Packet</strong>
            <span>{facility.referral.documents}</span>
          </li>
          <li>
            <strong>Placement</strong>
            <span>{facility.referral.placementEstimate}</span>
          </li>
        </ol>
        <button
          type="button"
          className="hi-primary-button"
          onClick={() => onReferralStart(`Referral workspace opened for ${facility.name}.`)}
        >
          Start Referral
        </button>
      </section>

      <section className="hi-profile-section">
        <h3>Data Provenance</h3>
        <dl className="hi-profile-list">
          <div>
            <dt>Primary</dt>
            <dd>{facility.provenance.primary}</dd>
          </div>
          <div>
            <dt>Secondary</dt>
            <dd>{facility.provenance.secondary}</dd>
          </div>
          <div>
            <dt>Freshness</dt>
            <dd>{formatPercent(facility.freshness)} on {facility.lastUpdated}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{formatPercent(facility.confidence)}</dd>
          </div>
        </dl>
        <p>{facility.provenance.caveat}</p>
      </section>
    </aside>
  )
}

function DirectoryResults({
  filteredFacilities,
  selectedFacilityId,
  onSelectFacility,
}: {
  filteredFacilities: Facility[]
  selectedFacilityId: string
  onSelectFacility: (facilityId: string) => void
}) {
  return (
    <section className="hi-panel hi-directory-panel" aria-labelledby="directory-title">
      <PanelTitle icon="building" title="Facility Directory" action={<span className="hi-panel-count">{filteredFacilities.length} rows</span>} />

      <div className="hi-directory-table" role="table" aria-labelledby="directory-title">
        <div className="hi-directory-head" role="row">
          <span role="columnheader">Facility</span>
          <span role="columnheader">Network</span>
          <span role="columnheader">Beds</span>
          <span role="columnheader">Quality</span>
          <span role="columnheader">Source</span>
        </div>

        {filteredFacilities.map((facility) => (
          <button
            type="button"
            className={`hi-directory-row${facility.id === selectedFacilityId ? ' is-selected' : ''}`}
            key={facility.id}
            onClick={() => onSelectFacility(facility.id)}
            role="row"
          >
            <span className="hi-directory-cell hi-directory-cell--facility" role="cell">
              <strong>{facility.name}</strong>
              <small>{facility.city}, {facility.county} County · {facility.licenseNumber}</small>
              <span className="hi-mobile-only">{facility.facilityType}</span>
            </span>
            <span className="hi-directory-cell" role="cell">
              <strong>{facility.cmhsp}</strong>
              <small>{facility.pihp}</small>
            </span>
            <span className="hi-directory-cell" role="cell">
              <strong>{facility.openBeds}/{facility.capacity}</strong>
              <small>open/capacity</small>
            </span>
            <span className="hi-directory-cell" role="cell">
              <strong>{formatPercent(facility.confidence)}</strong>
              <small>{formatPercent(facility.freshness)} fresh</small>
            </span>
            <span className="hi-directory-cell" role="cell">
              <StatusPill value={facility.licenseStatus} />
              <small>{facility.source}</small>
            </span>
          </button>
        ))}

        {filteredFacilities.length === 0 && (
          <div className="hi-empty-state">
            No facilities match the current filter set.
          </div>
        )}
      </div>
    </section>
  )
}

function ProviderWorkflow({
  selectedFacility,
  onSelectFacility,
}: {
  selectedFacility: Facility
  onSelectFacility: (facilityId: string) => void
}) {
  const [claimFacilityId, setClaimFacilityId] = useState(selectedFacility.id)
  const [claimedOpenBeds, setClaimedOpenBeds] = useState(selectedFacility.openBeds)
  const [claimHasAttestation, setClaimHasAttestation] = useState(true)
  const [workflowMessage, setWorkflowMessage] = useState('No staged provider update.')
  const claimFacility = getFacilityProfile(claimFacilityId)
  const openBedDelta = Math.abs(claimedOpenBeds - claimFacility.openBeds)
  const needsReview =
    !claimHasAttestation ||
    openBedDelta > 2 ||
    claimFacility.licenseStatus !== 'Active' ||
    claimFacility.ruleViolations > 0 ||
    !claimFacility.ddServed
  const reviewReasons = [
    !claimHasAttestation ? 'attestation missing' : '',
    openBedDelta > 2 ? 'bed count changed by more than 2' : '',
    claimFacility.licenseStatus !== 'Active' ? 'license status is not active' : '',
    claimFacility.ruleViolations > 0 ? 'open compliance findings' : '',
    !claimFacility.ddServed ? 'DD served not confirmed' : '',
  ].filter(Boolean)

  return (
    <section className="hi-panel hi-workflow-panel" aria-labelledby="provider-workflow-title">
      <PanelTitle icon="workflow" title="Provider Claim and Availability Update" />

      <div className="hi-workflow-grid">
        <div className="hi-workflow-form">
          <Field label="Claimed facility">
            <select
              value={claimFacilityId}
              onChange={(event) => {
                const nextFacility = getFacilityProfile(event.target.value)
                setClaimFacilityId(nextFacility.id)
                setClaimedOpenBeds(nextFacility.openBeds)
                onSelectFacility(nextFacility.id)
              }}
            >
              {facilities.map((facility) => (
                <option value={facility.id} key={facility.id}>{facility.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Provider open bed update">
            <input
              type="number"
              min="0"
              max={claimFacility.capacity}
              value={claimedOpenBeds}
              onChange={(event) => setClaimedOpenBeds(Number(event.target.value))}
            />
          </Field>

          <label className="hi-check-field">
            <input
              type="checkbox"
              checked={claimHasAttestation}
              onChange={(event) => setClaimHasAttestation(event.target.checked)}
            />
            <span>Provider attests the update is current and source-backed</span>
          </label>

          <div className="hi-workflow-actions">
            <button
              type="button"
              className="hi-primary-button"
              onClick={() => setWorkflowMessage(
                needsReview
                  ? `${claimFacility.name} routed to admin review.`
                  : `${claimFacility.name} staged for low-risk publication.`,
              )}
            >
              Stage Update
            </button>
            <button
              type="button"
              className="hi-secondary-button"
              onClick={() => {
                setClaimedOpenBeds(claimFacility.openBeds)
                setClaimHasAttestation(true)
                setWorkflowMessage('Provider update cleared.')
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className={`hi-review-decision${needsReview ? ' hi-review-decision--review' : ' hi-review-decision--low'}`}>
          <span>{needsReview ? 'Review needed' : 'Low-risk update'}</span>
          <strong>{claimedOpenBeds} claimed open beds</strong>
          <p>
            Current system value is {claimFacility.openBeds}. {needsReview ? reviewReasons.join(', ') : 'Active license, attested update, and small bed-count delta.'}
          </p>
          <ol>
            <li className="is-complete">Provider claim captured</li>
            <li className={needsReview ? 'is-warning' : 'is-complete'}>Automated checks completed</li>
            <li>{needsReview ? 'Queue for admin decision' : 'Publish after sync window'}</li>
          </ol>
        </div>
      </div>

      <div className="hi-inline-notice">{workflowMessage}</div>
    </section>
  )
}

function AdminReviewQueue({ onSelectFacility }: { onSelectFacility: (facilityId: string) => void }) {
  const [decisions, setDecisions] = useState<Record<string, string>>({})
  const reviewQueue = getReviewQueue()

  return (
    <section className="hi-panel hi-review-panel" aria-labelledby="review-queue-title">
      <PanelTitle icon="queue" title="Admin Review Queue" action={<span className="hi-panel-count">{reviewQueue.length} items</span>} />

      <div className="hi-review-list">
        {reviewQueue.map((item) => {
          const facility = getFacilityProfile(item.facilityId)
          const decision = decisions[item.id]

          return (
            <article className={`hi-review-item hi-review-item--${item.priority.toLowerCase()}`} key={item.id}>
              <div className="hi-review-item__header">
                <span>{item.type}</span>
                <strong>{item.priority}</strong>
              </div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <dl>
                <div>
                  <dt>Facility</dt>
                  <dd>{facility.name}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{item.source}</dd>
                </div>
              </dl>
              {decision && <div className="hi-review-decision-label">{decision}</div>}
              <div className="hi-review-item__actions">
                <button type="button" onClick={() => onSelectFacility(item.facilityId)}>Open Profile</button>
                <button type="button" onClick={() => setDecisions((current) => ({ ...current, [item.id]: 'Approved locally' }))}>
                  Approve
                </button>
                <button type="button" onClick={() => setDecisions((current) => ({ ...current, [item.id]: 'More evidence requested' }))}>
                  Request Info
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default function HousingIntelligence() {
  const [filters, setFilters] = useState<FacilitySearchFilters>(defaultFilters)
  const [selectedFacilityId, setSelectedFacilityId] = useState(facilities[0].id)
  const [geography, setGeography] = useState('Statewide')
  const [activeLayers, setActiveLayers] = useState<LayerId[]>([
    'supply',
    'availability',
    'gap',
    'concern',
    'freshness',
  ])
  const [toastMessage, setToastMessage] = useState('')

  const filteredFacilities = useMemo(() => filterFacilities(facilities, filters), [filters])
  const selectedFacility = useMemo(() => {
    const selectedFromResults = filteredFacilities.find((facility) => facility.id === selectedFacilityId)
    return selectedFromResults || filteredFacilities[0] || getFacilityProfile(selectedFacilityId)
  }, [filteredFacilities, selectedFacilityId])
  const analytics = useMemo(() => getAnalyticsForGeography(geography, filteredFacilities), [filteredFacilities, geography])
  const platformStateAnalytics = useMemo(() => platformGetAnalyticsForGeography('state:michigan'), [])
  const geographyOptions = useMemo(
    () => ['Statewide', ...uniqueSorted(facilities.map((facility) => facility.region)), ...uniqueSorted(facilities.map((facility) => facility.county))],
    [],
  )

  const updateFilter = <K extends keyof FacilitySearchFilters>(key: K, value: FacilitySearchFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const toggleCapability = (capability: CapabilityType) => {
    setFilters((current) => ({
      ...current,
      capabilities: current.capabilities.includes(capability)
        ? current.capabilities.filter((selected) => selected !== capability)
        : [...current.capabilities, capability],
    }))
  }

  const toggleLayer = (layer: LayerId) => {
    setActiveLayers((current) =>
      current.includes(layer) ? current.filter((selected) => selected !== layer) : [...current, layer],
    )
  }

  const notify = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(''), 2800)
  }

  return (
    <main id="main-content" className="housing-intelligence" aria-label="Michigan I/DD Housing Intelligence Platform">
      <header className="hi-commandbar">
        <div className="hi-commandbar__title">
          <span className="hi-product-mark">I/DD Housing</span>
          <h1>Michigan Housing Intelligence</h1>
          <p>Operational MVP · facility directory · live capacity review · admin data quality queue</p>
        </div>

        <div className="hi-commandbar__controls">
          <Field label="Geography">
            <select value={geography} onChange={(event) => setGeography(event.target.value)}>
              {geographyOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>
          <div className="hi-sync-status">
            <Icon name="sync" />
            <span>Last data refresh 2026-05-07</span>
          </div>
        </div>
      </header>

      <section className="hi-metric-strip" aria-label="Housing intelligence summary">
        <Metric label="Facilities" value={String(analytics.facilities)} detail={`${analytics.certified} DD certified`} />
        <Metric label="Licensed capacity" value={String(analytics.capacity)} detail={`${analytics.openBeds} open · ${platformStateAnalytics.waitlistCount} waitlist`} />
        <Metric label="Concern queue" value={String(analytics.concernCount)} detail="licensure or findings" />
        <Metric label="Freshness" value={formatPercent(analytics.freshness)} detail={`${formatPercent(analytics.confidence)} confidence`} />
      </section>

      <div className="hi-workspace">
        <FilterPanel
          filters={filters}
          facilitiesForOptions={facilities}
          onFilterChange={updateFilter}
          onCapabilityToggle={toggleCapability}
          onReset={() => setFilters(defaultFilters)}
        />

        <IntelligenceMap
          filteredFacilities={filteredFacilities}
          selectedFacilityId={selectedFacility.id}
          activeLayers={activeLayers}
          onLayerToggle={toggleLayer}
          onSelectFacility={setSelectedFacilityId}
        />

        <FacilityProfile facility={selectedFacility} onReferralStart={notify} />
      </div>

      <div className="hi-operations-grid">
        <DirectoryResults
          filteredFacilities={filteredFacilities}
          selectedFacilityId={selectedFacility.id}
          onSelectFacility={setSelectedFacilityId}
        />
        <ProviderWorkflow
          key={selectedFacility.id}
          selectedFacility={selectedFacility}
          onSelectFacility={setSelectedFacilityId}
        />
        <AdminReviewQueue onSelectFacility={setSelectedFacilityId} />
      </div>

      {toastMessage && <div className="hi-toast" role="status">{toastMessage}</div>}
    </main>
  )
}
