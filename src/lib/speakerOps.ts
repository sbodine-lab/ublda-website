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
export type ProgramSlotStatus = 'planning' | 'room-requested' | 'room-approved' | 'confirmed'
export type RoomRequestStatus = 'draft' | 'submitted' | 'approved' | 'declined'

export type SpeakerLead = {
  id: string
  name: string
  organization: string
  stage: SpeakerStage
  term: ProgramTerm
  format: SpeakerFormat
  ownerEmail: SpeakerOpsMemberEmail
  nextAction: string
  evidence: string
  blocker: string
  lastContactAt: string
  updatedAt: string
}

export type ProgramSlot = {
  id: 'fall-2026' | 'winter-2027'
  label: string
  term: Exclude<ProgramTerm, 'later'>
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
