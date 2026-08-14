export const SPEAKER_OPS_MEMBERS = [
  { name: 'Alex Forstner', email: 'alexfors@umich.edu', title: 'VP Education' },
  { name: 'Alexa Chiang', email: 'atchiang@umich.edu', title: 'Co-President' },
  { name: 'Andrew Sackett', email: 'andsack@umich.edu', title: 'VP Events' },
  { name: 'Cooper Perry', email: 'cooperry@umich.edu', title: 'Executive Vice President' },
  { name: 'Landon Miller', email: 'landonem@umich.edu', title: 'VP Finance' },
  { name: 'Lindsey Ye', email: 'ylindsey@umich.edu', title: 'VP Operations' },
  { name: 'Sam Bodine', email: 'sbodine@umich.edu', title: 'Co-President' },
  { name: 'Samantha Naber', email: 'snaber@umich.edu', title: 'Leadership Team' },
  { name: 'Solomon Deyoung', email: 'sdeyoun@umich.edu', title: 'Leadership Team' },
] as const

export type SpeakerOpsMemberEmail = typeof SPEAKER_OPS_MEMBERS[number]['email']

export const SPEAKER_STAGES = [
  'prospect',
  'in-conversation',
  'interested',
  'committed',
  'funding-blocked',
  'deferred',
  'closed',
] as const

export type SpeakerStage = typeof SPEAKER_STAGES[number]
export type ProgramTerm = 'fall-2026' | 'winter-2027' | 'later'
export type SpeakerFormat = 'in-person' | 'virtual' | 'flexible' | 'unknown'
export type SpeakerConfidence = 'high' | 'medium' | 'low' | 'unverified'
export type SpeakerRecommendation = 'recommended' | 'alternate' | 'hold' | 'research' | 'not-selected'
export type SpeakerCostStatus = 'free' | 'quote-requested' | 'quoted' | 'funding-needed' | 'unknown'
export type SpeakerTravelRequirement = 'required' | 'not-required' | 'unknown'
export type ProposedSlotStatus = 'idea' | 'offered' | 'accepted' | 'declined'
export type ProgramSlotStatus = 'planning' | 'room-requested' | 'room-approved' | 'confirmed'
export type RoomRequestStatus = 'draft' | 'submitted' | 'approved' | 'declined'

export type SpeakerProposedSlot = {
  id: string
  startAt: string
  eventTimezone: string
  status: ProposedSlotStatus
  evidence: string
}

export type SpeakerResearchLink = {
  label: string
  url: string
}

export type SpeakerEducation = {
  school: string
  degree: string
  year: string
  evidenceUrl: string
}

export type SpeakerLead = {
  id: string
  name: string
  organization: string
  stage: SpeakerStage
  term: ProgramTerm
  format: SpeakerFormat
  ownerEmail: SpeakerOpsMemberEmail
  confidence: SpeakerConfidence
  recommendation: SpeakerRecommendation
  recommendationRank: number | null
  selectionRationale: string
  shortBio: string
  education: SpeakerEducation[]
  credentials: string[]
  qualifications: string[]
  whyTheyMatter: string
  speakerTimezone: string
  proposedSlots: SpeakerProposedSlot[]
  drawScore: number | null
  drawRationale: string
  missionFitScore: number | null
  missionFitRationale: string
  logisticsNotes: string
  travelRequired: SpeakerTravelRequirement
  costStatus: SpeakerCostStatus
  quotedFee: number | null
  fundingPlan: string
  nextAction: string
  evidence: string
  blocker: string
  researchLinks: SpeakerResearchLink[]
  researchNotes: string
  lastContactAt: string
  updatedAt: string
}

export type ProgramSlot = {
  id: 'fall-2026-primary' | 'fall-2026-secondary'
  label: string
  term: 'fall-2026'
  status: ProgramSlotStatus
  preferredStart: string
  backupStart: string
  leadId: string
  roomRequestId: string
  updatedAt: string
}

export type RoomRequest = {
  id: string
  slotId: ProgramSlot['id']
  status: RoomRequestStatus
  preferredStart: string
  backupStart: string
  setupMinutes: number
  teardownMinutes: number
  estimatedAttendance: number
  accessibilityNotes: string
  equipmentNotes: string
  requestedByEmail: SpeakerOpsMemberEmail
  submittedAt: string
  responseDueAt: string
  reference: string
  roomName: string
  updatedAt: string
}

export type SpeakerOpsActivity = {
  id: string
  actorEmail: string
  action: string
  detail: string
  createdAt: string
}

export type SpeakerOpsViewer = {
  memberId: string
  name: string
  email: string
  title: string
  role: 'admin' | 'member'
  canConfirmProgram: boolean
}

export type SpeakerOpsWorkspace = {
  viewer: SpeakerOpsViewer
  members: Array<Pick<SpeakerOpsViewer, 'name' | 'email' | 'title' | 'canConfirmProgram'>>
  leads: SpeakerLead[]
  slots: ProgramSlot[]
  roomRequests: RoomRequest[]
  activity: SpeakerOpsActivity[]
}

export const SPEAKER_STAGE_LABELS: Record<SpeakerStage, string> = {
  prospect: 'Prospect',
  'in-conversation': 'In conversation',
  interested: 'Interested',
  committed: 'Committed',
  'funding-blocked': 'Funding blocked',
  deferred: 'Deferred',
  closed: 'Closed',
}

export const PROGRAM_TERM_LABELS: Record<ProgramTerm, string> = {
  'fall-2026': 'Fall 2026',
  'winter-2027': 'Winter 2027',
  later: 'Later',
}

export const SPEAKER_FORMAT_LABELS: Record<SpeakerFormat, string> = {
  'in-person': 'In person',
  virtual: 'Virtual',
  flexible: 'Flexible',
  unknown: 'Unknown',
}

export const SPEAKER_CONFIDENCE_LABELS: Record<SpeakerConfidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  unverified: 'Unverified',
}

export const SPEAKER_RECOMMENDATION_LABELS: Record<SpeakerRecommendation, string> = {
  recommended: 'Recommended',
  alternate: 'Alternate',
  hold: 'Hold',
  research: 'Needs research',
  'not-selected': 'Not selected',
}

export const SPEAKER_COST_STATUS_LABELS: Record<SpeakerCostStatus, string> = {
  free: 'Free',
  'quote-requested': 'Quote requested',
  quoted: 'Quoted',
  'funding-needed': 'Funding needed',
  unknown: 'Unknown',
}

export const SPEAKER_TRAVEL_LABELS: Record<SpeakerTravelRequirement, string> = {
  required: 'Travel required',
  'not-required': 'No travel required',
  unknown: 'Unknown',
}

export const PROPOSED_SLOT_STATUS_LABELS: Record<ProposedSlotStatus, string> = {
  idea: 'Internal option',
  offered: 'Offered',
  accepted: 'Accepted',
  declined: 'Declined',
}

export const PROGRAM_SLOT_STATUS_LABELS: Record<ProgramSlotStatus, string> = {
  planning: 'Planning',
  'room-requested': 'Room requested',
  'room-approved': 'Room approved',
  confirmed: 'Confirmed',
}

export const ROOM_REQUEST_STATUS_LABELS: Record<RoomRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  declined: 'Declined',
}

export const memberForEmail = (email: string) => (
  SPEAKER_OPS_MEMBERS.find((member) => member.email === email.trim().toLowerCase())
)
