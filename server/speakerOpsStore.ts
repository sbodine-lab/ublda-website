import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import {
  PROGRAM_SLOT_STATUS_LABELS,
  PROPOSED_SLOT_STATUS_LABELS,
  SPEAKER_CONFIDENCE_LABELS,
  SPEAKER_COST_STATUS_LABELS,
  SPEAKER_FORMAT_LABELS,
  SPEAKER_OPS_MEMBERS,
  SPEAKER_RECOMMENDATION_LABELS,
  SPEAKER_STAGES,
  SPEAKER_TRAVEL_LABELS,
  type ProgramSlot,
  type ProgramSlotStatus,
  type RoomRequest,
  type RoomRequestStatus,
  type SpeakerFormat,
  type SpeakerEducation,
  type SpeakerLead,
  type SpeakerProposedSlot,
  type SpeakerResearchLink,
  type SpeakerOpsActivity,
  type SpeakerOpsMemberEmail,
  type SpeakerOpsViewer,
  type SpeakerOpsWorkspace,
  type SpeakerStage,
} from '../src/lib/speakerOps.ts'

type SpeakerOpsData = {
  version: 4
  leads: Record<string, SpeakerLead>
  slots: Record<string, ProgramSlot>
  roomRequests: Record<string, RoomRequest>
  activity: SpeakerOpsActivity[]
}

type LegacySpeakerOpsData = Omit<SpeakerOpsData, 'version' | 'leads' | 'slots' | 'roomRequests'> & {
  version?: 1 | 2 | 3 | 4
  leads?: Record<string, Partial<SpeakerLead> & { id?: string }>
  slots?: Record<string, Partial<ProgramSlot> & { id?: string }>
  roomRequests?: Record<string, Partial<RoomRequest> & { id?: string }>
}

export type SpeakerOpsActor = {
  memberId: string
  displayName: string
  email: string
  role: 'admin' | 'member'
}

export type SpeakerOpsWriteResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

type StoreOptions = {
  forceLocal?: boolean
}

const BLOB_PATH = 'speaker-ops/state.json'
const WRITE_ATTEMPTS = 5
const queues = new Map<string, Promise<unknown>>()

const defaultDataPath = () => process.env.UBLDA_SPEAKER_OPS_DATA_FILE
  ? path.resolve(process.env.UBLDA_SPEAKER_OPS_DATA_FILE)
  : path.join(process.cwd(), '.ublda-local-data', 'speaker-ops.json')
const isoNow = () => new Date().toISOString()
const cleanText = (value: string, max = 500) => value.replace(/[<>]/g, '').trim().slice(0, max)
const randomId = (prefix: string) => `${prefix}_${randomBytes(10).toString('base64url')}`
const canUseBlob = (forceLocal: boolean) => !forceLocal && Boolean(process.env.BLOB_READ_WRITE_TOKEN)
const mutationRejected = (result: unknown) => Boolean(
  result && typeof result === 'object' && 'ok' in result && (result as { ok?: unknown }).ok === false,
)

type LeadSeedRequired = Pick<SpeakerLead,
  | 'id' | 'name' | 'organization' | 'stage' | 'term' | 'format' | 'ownerEmail'
  | 'nextAction' | 'evidence' | 'blocker' | 'lastContactAt' | 'updatedAt'
>
type LeadSeedInput = LeadSeedRequired & Partial<Omit<SpeakerLead, keyof LeadSeedRequired>>

const hydrateLead = (lead: LeadSeedInput): SpeakerLead => ({
  confidence: 'unverified',
  recommendation: 'research',
  recommendationRank: null,
  selectionRationale: '',
  shortBio: '',
  education: [],
  credentials: [],
  qualifications: [],
  whyTheyMatter: '',
  speakerTimezone: '',
  proposedSlots: [],
  drawScore: null,
  drawRationale: '',
  missionFitScore: null,
  missionFitRationale: '',
  logisticsNotes: '',
  travelRequired: 'unknown',
  costStatus: 'unknown',
  quotedFee: null,
  fundingPlan: '',
  researchLinks: [],
  researchNotes: 'General source links support the profile overall; education entries use their own source links where available. Unverified limitations are stated in each profile.',
  ...lead,
})

const cleanScore = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(1, Math.min(5, Math.round(value)))
  : null
const cleanOptionalNumber = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(0, Math.min(max, Math.round(value * 100) / 100))
  : null
const cleanUrl = (value: unknown) => {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString().slice(0, 500) : ''
  } catch {
    return ''
  }
}
const cleanStringList = (value: unknown, maxItems = 12) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').slice(0, maxItems).map((item) => cleanText(item, 240)).filter(Boolean)
  : []
const cleanProposedSlots = (value: unknown): SpeakerProposedSlot[] => Array.isArray(value)
  ? value.slice(0, 8).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Partial<SpeakerProposedSlot>
    const startAt = typeof raw.startAt === 'string' ? cleanText(raw.startAt, 80) : ''
    if (!startAt) return []
    return [{
      id: typeof raw.id === 'string' && raw.id ? cleanText(raw.id, 80) : `slot-${index + 1}`,
      startAt,
      eventTimezone: typeof raw.eventTimezone === 'string' ? cleanText(raw.eventTimezone, 80) : 'America/Detroit',
      status: raw.status && Object.keys(PROPOSED_SLOT_STATUS_LABELS).includes(raw.status) ? raw.status : 'idea',
      evidence: typeof raw.evidence === 'string' ? cleanText(raw.evidence, 500) : '',
    }]
  })
  : []
const cleanResearchLinks = (value: unknown): SpeakerResearchLink[] => Array.isArray(value)
  ? value.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Partial<SpeakerResearchLink>
    const url = cleanUrl(raw.url)
    if (!url) return []
    return [{ label: typeof raw.label === 'string' ? cleanText(raw.label, 120) : '', url }]
  })
  : []
const cleanEducation = (value: unknown): SpeakerEducation[] => Array.isArray(value)
  ? value.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const raw = item as Partial<SpeakerEducation>
    const school = typeof raw.school === 'string' ? cleanText(raw.school, 160) : ''
    if (!school) return []
    return [{
      school,
      degree: typeof raw.degree === 'string' ? cleanText(raw.degree, 120) : '',
      year: typeof raw.year === 'string' ? cleanText(raw.year, 20) : '',
      evidenceUrl: cleanUrl(raw.evidenceUrl),
    }]
  })
  : []

const normalizeLead = (id: string, raw: Partial<SpeakerLead>, seed?: SpeakerLead): SpeakerLead => {
  const base = seed || hydrateLead({
    id,
    name: typeof raw.name === 'string' ? cleanText(raw.name, 120) : 'Unverified speaker',
    organization: typeof raw.organization === 'string' ? cleanText(raw.organization, 160) : 'Organization to verify',
    stage: 'prospect',
    term: 'later',
    format: 'unknown',
    ownerEmail: 'andsack@umich.edu',
    nextAction: '',
    evidence: '',
    blocker: '',
    lastContactAt: '',
    updatedAt: isoNow(),
  })
  const merged = { ...base, ...raw, id }
  return {
    ...base,
    ...merged,
    name: cleanText(String(merged.name || base.name), 120),
    organization: cleanText(String(merged.organization || base.organization), 160),
    stage: SPEAKER_STAGES.includes(merged.stage as SpeakerStage) ? merged.stage as SpeakerStage : base.stage,
    term: ['fall-2026', 'winter-2027', 'later'].includes(String(merged.term)) ? merged.term : base.term,
    format: Object.keys(SPEAKER_FORMAT_LABELS).includes(String(merged.format)) ? merged.format : base.format,
    ownerEmail: isMemberEmail(String(merged.ownerEmail)) ? merged.ownerEmail : base.ownerEmail,
    confidence: Object.keys(SPEAKER_CONFIDENCE_LABELS).includes(String(merged.confidence)) ? merged.confidence : base.confidence,
    recommendation: Object.keys(SPEAKER_RECOMMENDATION_LABELS).includes(String(merged.recommendation)) ? merged.recommendation : base.recommendation,
    recommendationRank: cleanOptionalNumber(merged.recommendationRank, 99),
    selectionRationale: cleanText(String(merged.selectionRationale || ''), 500),
    shortBio: cleanText(String(merged.shortBio || ''), 800),
    education: cleanEducation(merged.education),
    credentials: cleanStringList(merged.credentials),
    qualifications: cleanStringList(merged.qualifications),
    whyTheyMatter: cleanText(String(merged.whyTheyMatter || ''), 500),
    speakerTimezone: cleanText(String(merged.speakerTimezone || ''), 80),
    proposedSlots: cleanProposedSlots(merged.proposedSlots),
    drawScore: cleanScore(merged.drawScore),
    drawRationale: cleanText(String(merged.drawRationale || ''), 500),
    missionFitScore: cleanScore(merged.missionFitScore),
    missionFitRationale: cleanText(String(merged.missionFitRationale || ''), 500),
    logisticsNotes: cleanText(String(merged.logisticsNotes || ''), 500),
    travelRequired: Object.keys(SPEAKER_TRAVEL_LABELS).includes(String(merged.travelRequired)) ? merged.travelRequired : base.travelRequired,
    costStatus: Object.keys(SPEAKER_COST_STATUS_LABELS).includes(String(merged.costStatus)) ? merged.costStatus : base.costStatus,
    quotedFee: cleanOptionalNumber(merged.quotedFee, 1_000_000),
    fundingPlan: cleanText(String(merged.fundingPlan || ''), 500),
    nextAction: cleanText(String(merged.nextAction || ''), 240),
    evidence: cleanText(String(merged.evidence || ''), 800),
    blocker: cleanText(String(merged.blocker || ''), 500),
    researchLinks: cleanResearchLinks(merged.researchLinks),
    researchNotes: cleanText(String(
      merged.researchNotes === 'Public profile research has not been completed.' && seed
        ? seed.researchNotes
        : merged.researchNotes || ''
    ), 1200),
    lastContactAt: cleanText(String(merged.lastContactAt || ''), 80),
    updatedAt: cleanText(String(merged.updatedAt || base.updatedAt), 80),
  } as SpeakerLead
}

const leadSeeds = (): SpeakerLead[] => {
  const updatedAt = '2026-08-10T19:00:00.000Z'
  const seeds: LeadSeedInput[] = [
    {
      id: 'deb-ruh',
      name: 'Debra Ruh',
      organization: 'Ruh Global IMPACT',
      stage: 'committed',
      term: 'fall-2026',
      format: 'flexible',
      ownerEmail: 'andsack@umich.edu',
      confidence: 'high',
      recommendation: 'recommended',
      recommendationRank: 1,
      selectionRationale: 'Direct fall enthusiasm and a mission-aligned accessibility leadership profile make this the lowest-friction anchor.',
      shortBio: 'Founder and disability-inclusion leader behind Ruh Global IMPACT; invited for a fall fireside on accessibility leadership and business.',
      education: [{ school: 'University of North Florida', degree: 'Attendance verified; degree and field unverified', year: '1980–1982', evidenceUrl: 'https://www.linkedin.com/in/debraruh' }],
      credentials: ['Founder, Ruh Global IMPACT', 'Chair, Billion Strong'],
      qualifications: ['Accessibility entrepreneur', 'Author and podcaster', 'Global disability-inclusion advocate'],
      whyTheyMatter: 'A direct accessibility-industry voice with a warm relationship and clear relevance to UBLDA\'s mission.',
      drawScore: 4,
      drawRationale: 'Recognized disability-inclusion leader with founder and global-community credentials; credible cross-campus appeal without celebrity dependence.',
      missionFitScore: 5,
      missionFitRationale: 'Accessibility leadership and disability identity are directly aligned with UBLDA.',
      researchLinks: [
        { label: 'Billion Strong', url: 'https://www.billion-strong.org/' },
        { label: 'Debra Ruh LinkedIn', url: 'https://www.linkedin.com/in/debraruh' },
      ],
      researchNotes: 'Education is self-reported on LinkedIn; degree and field are not verified.',
      speakerTimezone: 'America/New_York',
      proposedSlots: [
        { id: 'deb-oct-1', startAt: '2026-10-01T18:30:00-04:00', eventTimezone: 'America/Detroit', status: 'idea', evidence: 'Aug 14, 2026 dated calendar snapshot: no busy block appeared in the calendars checked. Re-check live calendars before offering; speaker and room availability remain unconfirmed.' },
        { id: 'deb-oct-22', startAt: '2026-10-22T18:30:00-04:00', eventTimezone: 'America/Detroit', status: 'idea', evidence: 'Aug 14, 2026 dated calendar snapshot: no busy block appeared in the calendars checked. Re-check live calendars before offering; speaker and room availability remain unconfirmed.' },
      ],
      nextAction: 'Offer Oct 1 at 6:30 p.m. ET, with Oct 22 at 6:30 p.m. as backup, after the room gate is clear.',
      evidence: 'Aug 10 Gmail: she is so looking forward to joining UBLDA for the fireside chat this fall.',
      blocker: 'No Ross room has been requested or approved.',
      lastContactAt: '2026-08-10T14:00:00.000Z',
      updatedAt,
    },
    {
      id: 'rich-donovan',
      name: 'Rich Donovan',
      organization: 'The Return on Disability Group',
      stage: 'committed',
      term: 'fall-2026',
      format: 'flexible',
      ownerEmail: 'andsack@umich.edu',
      confidence: 'high',
      recommendation: 'recommended',
      recommendationRank: 2,
      selectionRationale: 'Direct acceptance plus a strong business-case angle makes him the clearest second event for Ross students.',
      shortBio: 'Founder of The Return on Disability Group, invited to discuss the business case for disability inclusion and corporate strategy.',
      education: [
        { school: 'Schulich School of Business, York University', degree: 'BBA', year: '', evidenceUrl: 'https://blogs.worldbank.org/en/team/r/rich-donovan' },
        { school: 'Columbia Business School', degree: 'MBA', year: '', evidenceUrl: 'https://blogs.worldbank.org/en/team/r/rich-donovan' },
      ],
      credentials: ['Founder and CEO, The Return on Disability Group', 'Creator of the Return on Disability model'],
      qualifications: ['Disability-market and corporate-strategy specialist', 'Former Merrill Lynch portfolio-management and trading professional'],
      whyTheyMatter: 'His business-case framing is unusually well matched to a Ross audience and UBLDA\'s education mission.',
      drawScore: 4,
      drawRationale: 'Corporate-strategy and disability-market framing should appeal to Ross students beyond the existing disability community.',
      missionFitScore: 5,
      missionFitRationale: 'Connects disability inclusion to business strategy, which is central to UBLDA\'s Ross-facing mission.',
      researchLinks: [{ label: 'World Bank expert profile', url: 'https://blogs.worldbank.org/en/team/r/rich-donovan' }],
      researchNotes: 'World Bank profile supports education, finance background, and Return on Disability work.',
      speakerTimezone: 'America/Toronto',
      proposedSlots: [
        { id: 'rich-nov-17', startAt: '2026-11-17T18:30:00-05:00', eventTimezone: 'America/Detroit', status: 'idea', evidence: 'Aug 14, 2026 dated calendar snapshot: no busy block appeared in the calendars checked. After Ross Tech Week and eight days before Thanksgiving. Re-check live calendars before offering; speaker and room availability remain unconfirmed.' },
        { id: 'rich-nov-19', startAt: '2026-11-19T18:30:00-05:00', eventTimezone: 'America/Detroit', status: 'idea', evidence: 'Aug 14, 2026 dated calendar snapshot: no busy block appeared in the calendars checked. Re-check live calendars before offering; speaker and room availability remain unconfirmed.' },
      ],
      nextAction: 'Offer Nov 17 at 6:30 p.m. ET, with Nov 19 at 6:30 p.m. as backup.',
      evidence: 'Jul 30 verified Gmail acceptance: he would be delighted to speak and told UBLDA to tell him when.',
      blocker: 'No date, format, or room is confirmed.',
      lastContactAt: '2026-07-30',
      updatedAt,
    },
    {
      id: 'grant-shelton',
      name: 'Grant Shelton',
      organization: 'GTH Consulting',
      stage: 'interested',
      term: 'winter-2027',
      format: 'virtual',
      ownerEmail: 'sdeyoun@umich.edu',
      confidence: 'high',
      recommendation: 'alternate',
      selectionRationale: 'Open to an October Zoom, but the manager still requires fit, format, audience, and funding answers.',
      travelRequired: 'not-required',
      costStatus: 'quote-requested',
      shortBio: 'Potential neurodiversity and workplace speaker represented by booking manager Erin; exact identity and public background remain unverified.',
      whyTheyMatter: 'The proposed topic fits UBLDA, but selection should wait until identity, audience fit, and cost are verified.',
      researchNotes: 'Identity, organization, education, and public credentials are unverified. Do not attach similarly named public profiles.',
      nextAction: 'Keep warm for winter; send audience, topic, format, and funding facts when dates open.',
      evidence: 'Gmail and the Drive tracker: his manager is open to a Zoom fireside if the fit is clear.',
      blocker: 'Fall is capped; in-person would require travel support or a co-sponsor.',
      lastContactAt: '2026-08-03T14:00:00.000Z',
      updatedAt,
    },
    {
      id: 'tiffany-yu',
      name: 'Tiffany Yu',
      organization: 'Diversability',
      stage: 'closed',
      term: 'later',
      format: 'in-person',
      ownerEmail: 'sbodine@umich.edu',
      confidence: 'high',
      recommendation: 'hold',
      selectionRationale: 'The separate fall event is closed on cost; preserve the relationship for a future funded or co-hosted opportunity.',
      costStatus: 'quoted',
      quotedFee: 15000,
      fundingPlan: 'No approved UBLDA budget. Reopen only with a committed co-host or external funding.',
      shortBio: 'Author of The Anti-Ableist Manifesto and founder and CEO of Diversability; formerly an investment banker at Goldman Sachs.',
      education: [
        { school: 'Georgetown University McDonough School of Business', degree: 'B 2010; honors study in finance and accounting', year: '2010', evidenceUrl: 'https://msb.georgetown.edu/news-story/alumni/alumna-tiffany-yu-b10-on-reframing-disability-as-an-identity-of-pride/' },
        { school: 'London School of Economics', degree: 'Executive MSc, Social Business and Entrepreneurship', year: '', evidenceUrl: 'https://blogs.lse.ac.uk/socialbusinesshub/2025/02/14/from-lse-to-advocacy-tiffany-yu-on-anti-ableism-and-social-change/' },
      ],
      credentials: ['Founder and CEO, Diversability', 'Author, The Anti-Ableist Manifesto', 'Three-time TEDx speaker'],
      qualifications: ['Former Goldman Sachs investment banker', 'Accessibility advisory roles with FIFA World Cup 2026 and NIH rehabilitation programs'],
      whyTheyMatter: 'High public profile and direct disability-pride relevance create exceptional draw, but the quoted fee makes a separate event unrealistic now.',
      drawScore: 5,
      drawRationale: 'Author, TED speaker, and established disability-community founder with demonstrated broad public reach.',
      missionFitScore: 5,
      missionFitRationale: 'Disability pride, anti-ableism, entrepreneurship, and leadership map directly to UBLDA.',
      researchLinks: [
        { label: 'Official bio', url: 'https://www.tiffanyyu.com/bio' },
        { label: 'Georgetown profile', url: 'https://msb.georgetown.edu/news-story/alumni/alumna-tiffany-yu-b10-on-reframing-disability-as-an-identity-of-pride/' },
        { label: 'LSE profile', url: 'https://blogs.lse.ac.uk/socialbusinesshub/2025/02/14/from-lse-to-advocacy-tiffany-yu-on-anti-ableism-and-social-change/' },
      ],
      nextAction: 'Keep the relationship warm; do not plan a separate Fall 2026 event.',
      evidence: 'Gmail: the representative quoted a discounted $15,000 in-person rate; the separate fall event was closed.',
      blocker: 'A separate event is not viable without approved funding or a co-host.',
      lastContactAt: '2026-08-10T15:00:00.000Z',
      updatedAt,
    },
    {
      id: 'diego-mariscal',
      name: 'Diego Mariscal',
      organization: '2Gether-International',
      stage: 'interested',
      term: 'winter-2027',
      format: 'flexible',
      ownerEmail: 'andsack@umich.edu',
      confidence: 'high',
      recommendation: 'alternate',
      selectionRationale: 'Explicit yes, but the two-event fall slate is already filled by lower-friction confirmed-interest leads.',
      shortBio: 'Founder and CEO of 2Gether-International, an accelerator for disabled entrepreneurs; disability advocate and former Mexican national Paralympic swimmer.',
      education: [{ school: 'American University', degree: 'Studied international relations; completion and degree title unverified', year: '', evidenceUrl: 'https://www.dol.gov/agencies/odep/publications/success-stories/diego-mariscal' }],
      credentials: ['Founder and CEO, 2Gether-International'],
      qualifications: ['Disability entrepreneurship leader', 'Former Mexican national Paralympic swimmer'],
      whyTheyMatter: 'Entrepreneurship, disability, and founder experience align strongly with Ross students and UBLDA.',
      drawScore: 3,
      drawRationale: 'Strong founder story and Paralympic background, though lower broad-name recognition than the marquee candidates.',
      missionFitScore: 5,
      missionFitRationale: 'Disabled entrepreneurship is a direct UBLDA and Ross intersection.',
      researchLinks: [
        { label: 'U.S. Department of Labor profile', url: 'https://www.dol.gov/agencies/odep/publications/success-stories/diego-mariscal' },
        { label: '2Gether-International team', url: 'https://www.2gether-international.org/our-team/2gi' },
      ],
      nextAction: 'Book the planning call requested by his communications team.',
      evidence: 'Accepted; communications team followed up Aug 5 for details.',
      blocker: 'Audience, format, and date still need a planning call.',
      lastContactAt: '2026-08-05T15:00:00.000Z',
      updatedAt,
    },
    {
      id: 'neil-milliken',
      name: 'Neil Milliken',
      organization: 'Thrival Holdings',
      stage: 'in-conversation',
      term: 'winter-2027',
      format: 'virtual',
      ownerEmail: 'andsack@umich.edu',
      confidence: 'medium',
      recommendation: 'alternate',
      speakerTimezone: 'Europe/London',
      travelRequired: 'not-required',
      shortBio: 'Accessibility strategist at Thrival Holdings, former Atos global accessibility leader, co-founder of AXSChat, and dyslexia and ADHD advocate.',
      education: [{ school: 'University of Oxford', degree: 'Studied English and History; degree title and completion not stated', year: '', evidenceUrl: 'https://www.linkedin.com/pulse/neil-milliken-people-behind-tech-good-techuk-wxewf' }],
      credentials: ['Accessibility strategist, Thrival Holdings', 'Former Atos VP and global head of accessibility', 'Co-founder, AXSChat'],
      qualifications: ['Former W3C Cognitive Accessibility Taskforce invited expert', 'IAAP leadership experience', 'Disability Power 100 honoree'],
      whyTheyMatter: 'Deep enterprise-accessibility expertise and a virtual format make him a high-substance, lower-logistics option.',
      drawScore: 3,
      drawRationale: 'High credibility in enterprise accessibility, but likely strongest with a targeted rather than mass audience.',
      missionFitScore: 5,
      missionFitRationale: 'Enterprise accessibility and neurodivergence advocacy are core UBLDA topics.',
      researchLinks: [
        { label: 'techUK profile', url: 'https://www.linkedin.com/pulse/neil-milliken-people-behind-tech-good-techuk-wxewf' },
        { label: 'Neil Milliken LinkedIn', url: 'https://uk.linkedin.com/in/neilmilliken' },
      ],
      researchNotes: 'Public LinkedIn indicates he left Atos at the end of 2025 and is now with Thrival Holdings; display Atos as a former role.',
      nextAction: 'Re-verify the two date windows from the July call.',
      evidence: 'Brain notes a July 28 call and two dates; Gmail does not show them.',
      blocker: 'Exact dates are not supported by the email thread.',
      lastContactAt: '2026-07-28T18:00:00.000Z',
      updatedAt,
    },
    {
      id: 'microsoft-alum',
      name: 'Microsoft alumnus',
      organization: 'Microsoft',
      stage: 'prospect',
      term: 'winter-2027',
      format: 'in-person',
      ownerEmail: 'alexfors@umich.edu',
      confidence: 'low',
      recommendation: 'research',
      shortBio: 'Reported University of Michigan alum in accessibility engineering; exact name, employer, title, education, and credentials remain unverified.',
      whyTheyMatter: 'A verified Microsoft and Michigan connection could draw students, but no selection should be made until the person is identified.',
      researchNotes: 'Identity unverified. Do not display a guessed Microsoft executive.',
      nextAction: 'Verify the speaker name and direct contact.',
      evidence: 'The internal recap mentions an Oct 1 target; no contact appears in Gmail.',
      blocker: 'Speaker identity and availability are unverified.',
      lastContactAt: '',
      updatedAt,
    },
    {
      id: 'mindy-scheier',
      name: 'Mindy Scheier',
      organization: 'Runway of Dreams',
      stage: 'interested',
      term: 'winter-2027',
      format: 'flexible',
      ownerEmail: 'landonem@umich.edu',
      confidence: 'high',
      recommendation: 'alternate',
      selectionRationale: 'Accepted in principle, but the two-event fall slate is full; keep her at the front of the winter slate.',
      shortBio: 'Founder and CEO of Runway of Dreams, a fashion-industry veteran who built adaptive-clothing initiatives after adapting jeans for her son.',
      education: [{ school: 'University of Vermont and Fashion Institute of Technology', degree: 'Dual-program study in Fashion Design; degree title and completion not stated', year: '', evidenceUrl: 'https://www.runwayofdreams.org/our-founder' }],
      credentials: ['Founder and CEO, Runway of Dreams', 'Founder, Gamut Talent Management', 'TED speaker'],
      qualifications: ['Partnered with Tommy Hilfiger on a mainstream adaptive-clothing line', 'Adaptive fashion and disability-inclusion leader'],
      whyTheyMatter: 'Adaptive fashion is visual, consumer-facing, and unusually accessible to a broad student audience.',
      drawScore: 4,
      drawRationale: 'Adaptive fashion, Tommy Hilfiger experience, and TED visibility give the event a concrete, broadly understandable hook.',
      missionFitScore: 5,
      missionFitRationale: 'Adaptive design and disability inclusion are directly mission aligned.',
      researchLinks: [{ label: 'Runway of Dreams founder profile', url: 'https://www.runwayofdreams.org/our-founder' }],
      nextAction: 'Keep warm until the winter slot clears the room gate.',
      evidence: 'Said she would be honored; planning remains open.',
      blocker: 'No date, format, or room is confirmed.',
      lastContactAt: '2026-07-25T14:00:00.000Z',
      updatedAt,
    },
    {
      id: 'alex-singleton',
      name: 'Alex Singleton',
      organization: 'Organization to verify',
      stage: 'in-conversation',
      term: 'winter-2027',
      format: 'virtual',
      ownerEmail: 'cooperry@umich.edu',
      confidence: 'medium',
      recommendation: 'hold',
      shortBio: 'Denver Broncos inside linebacker and team captain whose Special Olympics advocacy is inspired by his sister Ashley, who has Down syndrome.',
      education: [{ school: 'Montana State University', degree: 'Sociology-Criminology', year: '2015', evidenceUrl: 'https://msubobcats.com/news/2015/5/7/GEN_0507153114.aspx' }],
      credentials: ['Denver Broncos inside linebacker and team captain', '2024 Walter Payton NFL Man of the Year nominee'],
      qualifications: ['Longtime Special Olympics advocate', 'Led the Broncos in tackles in 2025'],
      whyTheyMatter: 'NFL visibility and an authentic disability-family connection could drive exceptional campus interest if the warm introduction converts.',
      drawScore: 5,
      drawRationale: 'Active NFL captain and Special Olympics advocate is the strongest raw-attendance prospect in the researched slate.',
      missionFitScore: 4,
      missionFitRationale: 'Authentic disability-family advocacy fits well, though the business and accessibility content would need careful framing.',
      researchLinks: [
        { label: 'Montana State education record', url: 'https://msubobcats.com/news/2015/5/7/GEN_0507153114.aspx' },
        { label: 'Denver Broncos contract update', url: 'https://www.denverbroncos.com/news/broncos-re-sign-ilb-alex-singleton-to-2-year-contract' },
        { label: 'Broncos Special Olympics profile', url: 'https://www.denverbroncos.com/news/mile-high-morning-ilb-alex-singleton-shares-his-inspiration-for-lifelong-commitment-to-special-olympics' },
      ],
      nextAction: 'Keep the warm introduction moving; do not hold a date yet.',
      evidence: 'Drive tracker: warm introduction is in progress through Lloyd.',
      blocker: 'Direct contact, organization, topic, and availability are not yet verified.',
      lastContactAt: '',
      updatedAt,
    },
    {
      id: 'dustin-giannelli',
      name: 'Dustin Giannelli',
      organization: 'HearsDustin LLC',
      stage: 'interested',
      term: 'winter-2027',
      format: 'unknown',
      ownerEmail: 'sdeyoun@umich.edu',
      confidence: 'high',
      recommendation: 'alternate',
      shortBio: 'Founder and CEO of HearsDustin, a keynote speaker and accessibility strategist with bilateral hearing loss.',
      education: [{ school: 'University of New Hampshire, Whittemore School of Business', degree: 'Degree reported; exact title and major not independently verified', year: '2008–2012', evidenceUrl: 'https://www.innocaption.com/recentnews/q-a-hearsdustin' }],
      credentials: ['Founder and CEO, HearsDustin'],
      qualifications: ['Keynotes and workshops for Peloton, Converse, NBCUniversal, Sony, Princeton, and University of Michigan'],
      whyTheyMatter: 'A proven keynote record plus direct hearing-access experience offers a practical, high-energy campus event.',
      drawScore: 3,
      drawRationale: 'Experienced corporate keynote speaker with credible brands, but limited mass-name recognition.',
      missionFitScore: 5,
      missionFitRationale: 'Hearing access, communication, and workplace inclusion are highly relevant.',
      researchLinks: [
        { label: 'InnoCaption interview', url: 'https://www.innocaption.com/recentnews/q-a-hearsdustin' },
        { label: 'HearsDustin', url: 'https://www.hearsdustin.com/' },
      ],
      nextAction: 'Answer his audience, format, timing, location, and sponsor questions before a short call.',
      evidence: 'Gmail: he offered an introduction call and asked five concrete planning questions.',
      blocker: 'Format, timing, room, and sponsor or budget position are still open.',
      lastContactAt: '2026-08-04T14:00:00.000Z',
      updatedAt,
    },
    {
      id: 'maayan-ziv',
      name: 'Maayan Ziv',
      organization: 'AccessNow',
      stage: 'interested',
      term: 'winter-2027',
      format: 'unknown',
      ownerEmail: 'atchiang@umich.edu',
      confidence: 'medium',
      recommendation: 'hold',
      shortBio: 'Founder and CEO of AccessNow, an accessibility mapping and community platform; entrepreneur and activist with muscular dystrophy.',
      education: [
        { school: 'Toronto Metropolitan University', degree: 'BA, Radio and Television Arts', year: '2012', evidenceUrl: 'https://www.torontomu.ca/alumni/podcasts/ryerson-rewind/ryerson-rewind-s02e01/' },
        { school: 'Toronto Metropolitan University', degree: 'Master of Digital Media', year: '2015', evidenceUrl: 'https://www.torontomu.ca/alumni/podcasts/ryerson-rewind/ryerson-rewind-s02e01/' },
      ],
      credentials: ['Founder and CEO, AccessNow', 'Meritorious Service Cross, Canada'],
      qualifications: ['Accessibility technology entrepreneur', 'Disability activist and community builder'],
      whyTheyMatter: 'AccessNow connects disability, technology, entrepreneurship, and community in a concrete product story.',
      drawScore: 4,
      drawRationale: 'Award-winning technology founder with a tangible accessibility product and strong entrepreneurship story.',
      missionFitScore: 5,
      missionFitRationale: 'Accessibility technology and disabled entrepreneurship directly fit UBLDA.',
      researchLinks: [
        { label: 'Toronto Metropolitan University alumni profile', url: 'https://www.torontomu.ca/alumni/podcasts/ryerson-rewind/ryerson-rewind-s02e01/' },
        { label: 'TMU Meritorious Service Cross announcement', url: 'https://www.torontomu.ca/news-events/news/2024/07/two-tmu-alumni-receive-meritorious-service-decorations-from-the-governor-general/' },
      ],
      nextAction: 'Send a winter hold note after the winter planning window opens.',
      evidence: 'Brain and Drive tracker: interested, with timing affected by fall travel.',
      blocker: 'The current Gmail search did not surface a direct date commitment.',
      lastContactAt: '',
      updatedAt,
    },
    {
      id: 'scott-fedor',
      name: 'Scott Fedor',
      organization: 'Getting Back Up',
      stage: 'interested',
      term: 'winter-2027',
      format: 'unknown',
      ownerEmail: 'snaber@umich.edu',
      confidence: 'medium',
      recommendation: 'hold',
      nextAction: 'Send a winter hold note after the winter planning window opens.',
      evidence: 'Drive tracker: interested, with no date selected.',
      blocker: 'Format, topic, and availability need direct verification.',
      researchLinks: [
        { label: 'Scott Fedor official bio', url: 'https://www.scottwfedor.com/about/' },
        { label: 'Scott Fedor resume', url: 'https://www.scottwfedor.com/wp-content/uploads/2010/06/SWFedorResume.pdf' },
      ],
      researchNotes: 'Official bio and resume support the corrected surname, education, authorship, and speaking background.',
      shortBio: 'Ross alumnus, author, motivational speaker, and founder of Getting Back Up after a diving accident left him paralyzed.',
      education: [
        { school: 'Lehigh University', degree: 'BS, Finance', year: '1998', evidenceUrl: 'https://www.scottwfedor.com/wp-content/uploads/2010/06/SWFedorResume.pdf' },
        { school: 'University of Michigan Ross School of Business', degree: 'MBA, Marketing', year: '2004', evidenceUrl: 'https://www.scottwfedor.com/wp-content/uploads/2010/06/SWFedorResume.pdf' },
      ],
      credentials: ['Author, Head Strong', 'Founder, Getting Back Up'],
      qualifications: ['Speaker for businesses and schools', 'Disability nonprofit founder'],
      whyTheyMatter: 'A Ross alum with a personal disability story and an existing speaking practice creates strong campus relevance.',
      drawScore: 3,
      drawRationale: 'Ross alumni connection and author-speaker experience create targeted campus relevance.',
      missionFitScore: 4,
      missionFitRationale: 'Disability lived experience and nonprofit work fit, though the business-accessibility lens is less direct.',
      lastContactAt: '',
      updatedAt,
    },
    {
      id: 'diane-swonk',
      name: 'Diane Swonk',
      organization: 'KPMG',
      stage: 'deferred',
      term: 'later',
      format: 'in-person',
      ownerEmail: 'sbodine@umich.edu',
      confidence: 'high',
      recommendation: 'not-selected',
      shortBio: 'Chief economist and managing director at KPMG US, prominent economic commentator, University of Michigan economics alumna, and dyslexia advocate.',
      education: [
        { school: 'University of Michigan', degree: 'AB, Economics', year: '1984', evidenceUrl: 'https://prod.lsa.umich.edu/econ/alumni-friends/economics-leadership-council--elc-/diane-c--swonk.html' },
        { school: 'University of Michigan', degree: 'AM, Applied Economics', year: '1985', evidenceUrl: 'https://prod.lsa.umich.edu/econ/alumni-friends/economics-leadership-council--elc-/diane-c--swonk.html' },
        { school: 'University of Chicago Booth School of Business', degree: 'Master’s study in finance and strategic planning', year: '', evidenceUrl: 'https://kpmg.com/us/en/how-we-work/people/s/swonk-diane.html' },
      ],
      credentials: ['Chief Economist and Managing Director, KPMG US', 'NABE Fellow'],
      qualifications: ['Adviser to federal economic bodies', 'National and international economic commentator', 'Dyslexia advocate'],
      whyTheyMatter: 'A top economist with Michigan ties and a disability lens would draw broadly across Ross, but the offered dates conflicted with finals.',
      drawScore: 5,
      drawRationale: 'National economic visibility, KPMG title, and Michigan ties give her exceptional Ross-wide appeal.',
      missionFitScore: 4,
      missionFitRationale: 'The dyslexia and judgment angle is meaningful, though disability inclusion is not her primary public work.',
      researchLinks: [
        { label: 'U-M Economics profile', url: 'https://prod.lsa.umich.edu/econ/alumni-friends/economics-leadership-council--elc-/diane-c--swonk.html' },
        { label: 'KPMG profile', url: 'https://kpmg.com/us/en/how-we-work/people/s/swonk-diane.html' },
      ],
      nextAction: 'Reconnect for a 2027 date outside finals.',
      evidence: 'KPMG agreed Aug 10 to reconnect in 2027.',
      blocker: 'Dec 14–16 overlaps Ross final exams.',
      lastContactAt: '2026-08-10T15:30:00.000Z',
      updatedAt,
    },
    {
      id: 'victor-pineda',
      name: 'Victor Pineda',
      organization: 'World Enabled',
      stage: 'closed',
      term: 'later',
      format: 'unknown',
      ownerEmail: 'andsack@umich.edu',
      confidence: 'high',
      recommendation: 'not-selected',
      selectionRationale: 'No reply; the Aug 9 operating decision says not to chase.',
      shortBio: 'Disability-rights scholar, urban planner, and founder of World Enabled and the Pineda Foundation.',
      education: [
        { school: 'University of California, Berkeley', degree: 'BA, Political Economy; BS, Business Administration', year: '', evidenceUrl: 'https://www.vpineda.com/about-disability-rights' },
        { school: 'University of California, Berkeley', degree: 'Master of City and Regional Planning', year: '', evidenceUrl: 'https://www.vpineda.com/about-disability-rights' },
        { school: 'University of California, Los Angeles', degree: 'PhD, Urban Planning', year: '', evidenceUrl: 'https://www.vpineda.com/about-disability-rights' },
      ],
      credentials: ['Fulbright Scholar', 'Founder, World Enabled and Pineda Foundation'],
      qualifications: ['Former UC Berkeley Chancellor’s Postdoctoral Fellow', 'Consultant to the United Nations and World Bank', 'World Economic Forum council member'],
      whyTheyMatter: 'His global disability-rights and inclusive-city expertise is impressive, but the relationship is closed after no reply.',
      drawScore: 3,
      drawRationale: 'Deep international credentials would attract policy and accessibility audiences, but lower broad student recognition.',
      missionFitScore: 5,
      missionFitRationale: 'Disability rights, inclusive systems, and global accessibility are directly aligned.',
      researchLinks: [{ label: 'Victor Pineda official bio', url: 'https://www.vpineda.com/about-disability-rights' }],
      nextAction: 'No further outreach unless he re-engages.',
      evidence: 'Brain document 60 records no reply and no chasing.',
      blocker: 'No response.',
      lastContactAt: '',
      updatedAt,
    },
    {
      id: 'dr-connolly',
      name: 'Dr. Connolly',
      organization: 'Organization to verify',
      stage: 'closed',
      term: 'later',
      format: 'unknown',
      ownerEmail: 'andsack@umich.edu',
      confidence: 'high',
      recommendation: 'not-selected',
      selectionRationale: 'No reply; the Aug 9 operating decision says not to chase.',
      shortBio: 'Outreach candidate whose full name, organization, discipline, education, and credentials have not been verified.',
      whyTheyMatter: 'Reconsider only if a reply establishes the person’s identity and fit.',
      researchNotes: 'Identity unverified. Do not display a guessed biography.',
      nextAction: 'No further outreach unless they re-engage.',
      evidence: 'Brain document 60 records no reply and no chasing.',
      blocker: 'No response; full identity and organization remain unverified.',
      lastContactAt: '',
      updatedAt,
    },
  ]
  return seeds.map(hydrateLead)
}

const slotSeeds = (): ProgramSlot[] => [
  {
    id: 'fall-2026-primary',
    label: 'Fall fireside · Debra Ruh',
    term: 'fall-2026',
    status: 'planning',
    preferredStart: '2026-10-01T18:30:00-04:00',
    backupStart: '2026-10-22T18:30:00-04:00',
    leadId: 'deb-ruh',
    roomRequestId: 'room-fall-2026-primary',
    updatedAt: '2026-08-14T16:00:00.000Z',
  },
  {
    id: 'fall-2026-secondary',
    label: 'Fall fireside · Rich Donovan',
    term: 'fall-2026',
    status: 'planning',
    preferredStart: '2026-11-17T18:30:00-05:00',
    backupStart: '2026-11-19T18:30:00-05:00',
    leadId: 'rich-donovan',
    roomRequestId: 'room-fall-2026-secondary',
    updatedAt: '2026-08-14T16:00:00.000Z',
  },
]

const roomSeeds = (): RoomRequest[] => slotSeeds().map((slot) => ({
  id: slot.roomRequestId,
  slotId: slot.id,
  status: 'draft',
  preferredStart: slot.preferredStart,
  backupStart: slot.backupStart,
  setupMinutes: 30,
  teardownMinutes: 15,
  estimatedAttendance: 45,
  accessibilityNotes: 'Step-free route and accessible seating required.',
  equipmentNotes: 'Two chairs, two wireless microphones, projector optional.',
  requestedByEmail: 'atchiang@umich.edu',
  submittedAt: '',
  responseDueAt: '',
  reference: '',
  roomName: '',
  updatedAt: '2026-08-14T16:00:00.000Z',
}))

const emptyData = (): SpeakerOpsData => ({
  version: 4,
  leads: Object.fromEntries(leadSeeds().map((lead) => [lead.id, lead])),
  slots: Object.fromEntries(slotSeeds().map((slot) => [slot.id, slot])),
  roomRequests: Object.fromEntries(roomSeeds().map((request) => [request.id, request])),
  activity: [{
    id: 'seed_context_2026_08_14',
    actorEmail: 'system',
    action: 'Context checked',
    detail: 'Brain, Gmail, Google Calendar, and Ross calendar guidance reconciled Aug 14. Fall 2026 is capped at two firesides.',
    createdAt: '2026-08-14T19:00:00.000Z',
  }],
})

const migrateData = (raw: LegacySpeakerOpsData): SpeakerOpsData => {
  const seeded = emptyData()
  const rawLeads = { ...(raw.leads || {}) }
  if (rawLeads['scott-fiedor'] && !rawLeads['scott-fedor']) {
    rawLeads['scott-fedor'] = {
      ...rawLeads['scott-fiedor'],
      id: 'scott-fedor',
      name: 'Scott Fedor',
      organization: 'Getting Back Up',
    }
  }
  delete rawLeads['scott-fiedor']
  const leadIds = new Set([...Object.keys(seeded.leads), ...Object.keys(rawLeads)])
  const leads = Object.fromEntries([...leadIds].map((id) => [
    id,
    normalizeLead(id, rawLeads[id] || {}, seeded.leads[id]),
  ]))
  if (leads['neil-milliken']?.organization === 'Atos') {
    leads['neil-milliken'].organization = 'Thrival Holdings'
  }
  if (leads['neil-milliken']?.shortBio === 'Accessibility strategist, former Atos global accessibility leader, co-founder of AXSChat, and dyslexia and ADHD advocate.') {
    leads['neil-milliken'].shortBio = seeded.leads['neil-milliken'].shortBio
  }
  const legacySlotEvidence = new Map([
    ['Preferred opening-slot recommendation after the Aug 14 calendar review.', seeded.leads['deb-ruh'].proposedSlots[0].evidence],
    ['All nine board calendars showed no busy block in the Aug 14 snapshot.', seeded.leads['deb-ruh'].proposedSlots[1].evidence],
    ['No busy block was recorded in the dated Aug 14 calendar snapshot reviewed for this slot.', seeded.leads['deb-ruh'].proposedSlots[1].evidence],
    ['Clear across all nine board calendars; after Ross Tech Week and eight days before Thanksgiving.', seeded.leads['rich-donovan'].proposedSlots[0].evidence],
    ['Clear across all nine board calendars in the Aug 14 snapshot.', seeded.leads['rich-donovan'].proposedSlots[1].evidence],
    ['No busy block was recorded in the dated Aug 14 calendar snapshot reviewed for this slot; after Ross Tech Week and eight days before Thanksgiving.', seeded.leads['rich-donovan'].proposedSlots[0].evidence],
    ['No busy block was recorded in the dated Aug 14 calendar snapshot reviewed for this slot.', seeded.leads['rich-donovan'].proposedSlots[1].evidence],
  ])
  for (const lead of [leads['deb-ruh'], leads['rich-donovan']]) {
    lead.proposedSlots = lead.proposedSlots.map((slot) => ({
      ...slot,
      evidence: legacySlotEvidence.get(slot.evidence) || slot.evidence,
    }))
  }
  if (leads['rich-donovan'].lastContactAt === '2026-07-28T16:00:00.000Z') {
    leads['rich-donovan'].lastContactAt = seeded.leads['rich-donovan'].lastContactAt
  }
  if (leads['rich-donovan'].evidence === 'Direct Gmail acceptance: he would be delighted to speak and told UBLDA to tell him when.') {
    leads['rich-donovan'].evidence = seeded.leads['rich-donovan'].evidence
  }
  if (raw.version !== 4) {
    Object.assign(leads['deb-ruh'], { term: 'fall-2026', recommendation: 'recommended', recommendationRank: 1 })
    Object.assign(leads['rich-donovan'], { term: 'fall-2026', recommendation: 'recommended', recommendationRank: 2 })
    Object.assign(leads['neil-milliken'], { term: 'winter-2027' })
    Object.assign(leads['microsoft-alum'], { term: 'winter-2027' })
    Object.assign(leads['tiffany-yu'], { stage: 'closed', term: 'later' })
    Object.assign(leads['diane-swonk'], { stage: 'deferred', term: 'later' })
    Object.assign(leads['victor-pineda'], { stage: 'closed', term: 'later' })
    Object.assign(leads['dr-connolly'], { stage: 'closed', term: 'later' })
  }
  const activity = Array.isArray(raw.activity) ? [...raw.activity] : seeded.activity

  if (raw.version === 1) {
    Object.assign(leads, Object.fromEntries(leadSeeds().map((lead) => [lead.id, lead])))
    delete leads['grant-kessler']
    activity.unshift({
      id: 'context_reconciled_2026_08_10',
      actorEmail: 'system',
      action: 'Pipeline reconciled',
      detail: 'Corrected Grant Shelton and loaded the verified Brain, Gmail, and Drive pipeline under the two-event cap.',
      createdAt: '2026-08-10T19:00:00.000Z',
    })
  }

  if (raw.version && raw.version < 4 && !activity.some((item) => item.id === 'two_event_migration_2026_08_14')) {
    activity.unshift({
      id: 'two_event_migration_2026_08_14',
      actorEmail: 'system',
      action: 'Fall slate updated',
      detail: 'Program slots were reset to the two-event Fall 2026 plan. Legacy winter slot details were not promoted into a fall event.',
      createdAt: '2026-08-14T19:00:00.000Z',
    })
  }

  const legacyPrimary = raw.slots?.['fall-2026-primary'] || raw.slots?.['fall-2026']
  const primarySeed = seeded.slots['fall-2026-primary']
  const secondarySeed = seeded.slots['fall-2026-secondary']
  const primary = {
    ...primarySeed,
    ...(legacyPrimary || {}),
    id: primarySeed.id,
    label: primarySeed.label,
    term: primarySeed.term,
    leadId: primarySeed.leadId,
    roomRequestId: primarySeed.roomRequestId,
    ...(raw.version !== 4 ? { preferredStart: primarySeed.preferredStart, backupStart: primarySeed.backupStart } : {}),
  } satisfies ProgramSlot
  const secondary = {
    ...secondarySeed,
    ...(raw.slots?.['fall-2026-secondary'] || {}),
    id: secondarySeed.id,
    label: secondarySeed.label,
    term: secondarySeed.term,
    leadId: secondarySeed.leadId,
    roomRequestId: secondarySeed.roomRequestId,
    ...(raw.version !== 4 ? { preferredStart: secondarySeed.preferredStart, backupStart: secondarySeed.backupStart } : {}),
  } satisfies ProgramSlot

  const legacyPrimaryRoom = raw.roomRequests?.['room-fall-2026-primary'] || raw.roomRequests?.['room-fall-2026']
  const primaryRoomSeed = seeded.roomRequests['room-fall-2026-primary']
  const secondaryRoomSeed = seeded.roomRequests['room-fall-2026-secondary']
  const primaryRoom = {
    ...primaryRoomSeed,
    ...(legacyPrimaryRoom || {}),
    id: primaryRoomSeed.id,
    slotId: primaryRoomSeed.slotId,
    ...(raw.version !== 4 ? { preferredStart: primaryRoomSeed.preferredStart, backupStart: primaryRoomSeed.backupStart } : {}),
  } satisfies RoomRequest
  const secondaryRoom = {
    ...secondaryRoomSeed,
    ...(raw.roomRequests?.['room-fall-2026-secondary'] || {}),
    id: secondaryRoomSeed.id,
    slotId: secondaryRoomSeed.slotId,
    ...(raw.version !== 4 ? { preferredStart: secondaryRoomSeed.preferredStart, backupStart: secondaryRoomSeed.backupStart } : {}),
  } satisfies RoomRequest

  return {
    version: 4,
    leads,
    slots: { [primary.id]: primary, [secondary.id]: secondary },
    roomRequests: { [primaryRoom.id]: primaryRoom, [secondaryRoom.id]: secondaryRoom },
    activity,
  }
}

const memberView = (email: SpeakerOpsMemberEmail) => {
  const member = SPEAKER_OPS_MEMBERS.find((candidate) => candidate.email === email)!
  return {
    name: member.name,
    email: member.email,
    title: member.title,
    canConfirmProgram: false,
  }
}

const addBusinessDays = (iso: string, count: number) => {
  const date = new Date(iso)
  let added = 0
  while (added < count) {
    date.setUTCDate(date.getUTCDate() + 1)
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) added += 1
  }
  return date.toISOString()
}

const roomStatusTransitionAllowed = (current: RoomRequestStatus, next: RoomRequestStatus) => ({
  draft: ['draft', 'submitted'],
  submitted: ['submitted', 'approved', 'declined'],
  approved: ['approved'],
  declined: ['declined', 'draft'],
}[current] as RoomRequestStatus[]).includes(next)

const hasApprovalEvidence = (value: string) => /[a-z0-9]/i.test(value) && value.trim().length >= 6

const isMemberEmail = (email: string): email is SpeakerOpsMemberEmail => (
  SPEAKER_OPS_MEMBERS.some((member) => member.email === email)
)
const memberForActor = (actor: SpeakerOpsActor) => {
  const member = SPEAKER_OPS_MEMBERS.find((candidate) => candidate.email === actor.email)
  return member || {
    name: actor.displayName || actor.email,
    email: actor.email,
    title: 'Leadership Team',
  }
}

export class SpeakerOpsStore {
  private readonly dataPath: string
  private readonly forceLocal: boolean

  constructor(dataPath = defaultDataPath(), options: StoreOptions = {}) {
    this.dataPath = dataPath
    this.forceLocal = Boolean(options.forceLocal)
  }

  private storageKey() {
    return canUseBlob(this.forceLocal) ? BLOB_PATH : this.dataPath
  }

  private async readLocal() {
    try {
      return JSON.parse(await readFile(this.dataPath, 'utf8')) as LegacySpeakerOpsData
    } catch {
      return emptyData()
    }
  }

  private async writeLocal(data: SpeakerOpsData) {
    await mkdir(path.dirname(this.dataPath), { recursive: true })
    const tempPath = `${this.dataPath}.${process.pid}.${randomBytes(5).toString('base64url')}.tmp`
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
    await rename(tempPath, this.dataPath)
  }

  private async readBlob() {
    const blob = await get(BLOB_PATH, { access: 'private', useCache: false })
    if (!blob || blob.statusCode !== 200) return { data: emptyData(), etag: null as string | null }
    const raw = await new Response(blob.stream).text()
    // Private Blob GET responses expose a weak HTTP validator, while Blob's
    // conditional write API expects the corresponding strong ETag.
    const etag = blob.blob.etag?.replace(/^W\//, '') || null
    return { data: JSON.parse(raw) as LegacySpeakerOpsData, etag }
  }

  private async writeBlob(data: SpeakerOpsData, etag: string | null) {
    await put(BLOB_PATH, `${JSON.stringify(data, null, 2)}\n`, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: Boolean(etag),
      contentType: 'application/json',
      ...(etag ? { ifMatch: etag } : {}),
    })
  }

  private async updateData<T>(mutation: (data: SpeakerOpsData) => Promise<T> | T): Promise<T> {
    const key = this.storageKey()
    const previous = queues.get(key) || Promise.resolve()
    const task = previous.catch(() => undefined).then(async () => {
      if (!canUseBlob(this.forceLocal)) {
        const data = migrateData(await this.readLocal())
        const result = await mutation(data)
        if (mutationRejected(result)) return result
        await this.writeLocal(data)
        return result
      }

      for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
        const { data: rawData, etag } = await this.readBlob()
        const data = migrateData(rawData)
        const result = await mutation(data)
        if (mutationRejected(result)) return result
        try {
          await this.writeBlob(data, etag)
          return result
        } catch (error) {
          if (!(error instanceof BlobPreconditionFailedError) || attempt === WRITE_ATTEMPTS - 1) throw error
        }
      }
      throw new Error('Speaker Ops storage could not be updated.')
    })
    queues.set(key, task)
    try {
      return await task
    } finally {
      if (queues.get(key) === task) queues.delete(key)
    }
  }

  private appendActivity(
    data: SpeakerOpsData,
    actorEmail: string,
    action: string,
    detail: string,
  ) {
    data.activity.unshift({
      id: randomId('activity'),
      actorEmail,
      action: cleanText(action, 80),
      detail: cleanText(detail, 300),
      createdAt: isoNow(),
    })
    data.activity = data.activity.slice(0, 250)
  }

  async workspace(actor: SpeakerOpsActor): Promise<SpeakerOpsWorkspace> {
    const member = memberForActor(actor)
    const rawData = canUseBlob(this.forceLocal)
      ? (await this.readBlob()).data
      : await this.readLocal()
    const data = migrateData(rawData)
    if (rawData.version !== 4) {
      // Migration is the only read path allowed to persist. Current v4
      // workspace reads remain side-effect-free.
      await this.updateData((stored) => {
        Object.assign(stored, data)
      })
    }
    return {
      viewer: {
        memberId: actor.memberId,
        name: actor.displayName || member.name,
        email: member.email,
        title: member.title,
        role: actor.role,
        canConfirmProgram: actor.role === 'admin',
      } satisfies SpeakerOpsViewer,
      members: SPEAKER_OPS_MEMBERS.map((candidate) => memberView(candidate.email)),
      leads: Object.values(data.leads),
      slots: Object.values(data.slots),
      roomRequests: Object.values(data.roomRequests),
      activity: data.activity,
    }
  }

  async updateLead(actor: SpeakerOpsActor, leadInput: Partial<SpeakerLead> & { id: string }): Promise<SpeakerOpsWriteResult<{ lead: SpeakerLead }>> {
    const member = memberForActor(actor)
    return this.updateData((data) => {
      const lead = data.leads[leadInput.id]
      if (!lead) return { ok: false, error: 'Speaker was not found.' }

      if (leadInput.stage && SPEAKER_STAGES.includes(leadInput.stage as SpeakerStage)) lead.stage = leadInput.stage
      if (leadInput.term && ['fall-2026', 'winter-2027', 'later'].includes(leadInput.term)) lead.term = leadInput.term
      if (leadInput.format && Object.keys(SPEAKER_FORMAT_LABELS).includes(leadInput.format)) lead.format = leadInput.format as SpeakerFormat
      if (leadInput.ownerEmail && isMemberEmail(leadInput.ownerEmail)) lead.ownerEmail = leadInput.ownerEmail
      if (leadInput.confidence && Object.keys(SPEAKER_CONFIDENCE_LABELS).includes(leadInput.confidence)) lead.confidence = leadInput.confidence
      if (leadInput.recommendation && Object.keys(SPEAKER_RECOMMENDATION_LABELS).includes(leadInput.recommendation)) lead.recommendation = leadInput.recommendation
      if (leadInput.recommendationRank === null || typeof leadInput.recommendationRank === 'number') lead.recommendationRank = cleanOptionalNumber(leadInput.recommendationRank, 99)
      if (typeof leadInput.selectionRationale === 'string') lead.selectionRationale = cleanText(leadInput.selectionRationale, 500)
      if (typeof leadInput.shortBio === 'string') lead.shortBio = cleanText(leadInput.shortBio, 800)
      if (Array.isArray(leadInput.education)) lead.education = cleanEducation(leadInput.education)
      if (Array.isArray(leadInput.credentials)) lead.credentials = cleanStringList(leadInput.credentials)
      if (Array.isArray(leadInput.qualifications)) lead.qualifications = cleanStringList(leadInput.qualifications)
      if (typeof leadInput.whyTheyMatter === 'string') lead.whyTheyMatter = cleanText(leadInput.whyTheyMatter, 500)
      if (typeof leadInput.speakerTimezone === 'string') lead.speakerTimezone = cleanText(leadInput.speakerTimezone, 80)
      if (Array.isArray(leadInput.proposedSlots)) lead.proposedSlots = cleanProposedSlots(leadInput.proposedSlots)
      if (leadInput.drawScore === null || typeof leadInput.drawScore === 'number') lead.drawScore = cleanScore(leadInput.drawScore)
      if (typeof leadInput.drawRationale === 'string') lead.drawRationale = cleanText(leadInput.drawRationale, 500)
      if (leadInput.missionFitScore === null || typeof leadInput.missionFitScore === 'number') lead.missionFitScore = cleanScore(leadInput.missionFitScore)
      if (typeof leadInput.missionFitRationale === 'string') lead.missionFitRationale = cleanText(leadInput.missionFitRationale, 500)
      if (typeof leadInput.logisticsNotes === 'string') lead.logisticsNotes = cleanText(leadInput.logisticsNotes, 500)
      if (leadInput.travelRequired && Object.keys(SPEAKER_TRAVEL_LABELS).includes(leadInput.travelRequired)) lead.travelRequired = leadInput.travelRequired
      if (leadInput.costStatus && Object.keys(SPEAKER_COST_STATUS_LABELS).includes(leadInput.costStatus)) lead.costStatus = leadInput.costStatus
      if (leadInput.quotedFee === null || typeof leadInput.quotedFee === 'number') lead.quotedFee = cleanOptionalNumber(leadInput.quotedFee, 1_000_000)
      if (typeof leadInput.fundingPlan === 'string') lead.fundingPlan = cleanText(leadInput.fundingPlan, 500)
      if (typeof leadInput.nextAction === 'string') lead.nextAction = cleanText(leadInput.nextAction, 240)
      if (typeof leadInput.evidence === 'string') lead.evidence = cleanText(leadInput.evidence, 800)
      if (typeof leadInput.blocker === 'string') lead.blocker = cleanText(leadInput.blocker, 500)
      if (Array.isArray(leadInput.researchLinks)) lead.researchLinks = cleanResearchLinks(leadInput.researchLinks)
      if (typeof leadInput.researchNotes === 'string') lead.researchNotes = cleanText(leadInput.researchNotes, 1200)
      if (typeof leadInput.lastContactAt === 'string') lead.lastContactAt = cleanText(leadInput.lastContactAt, 80)
      lead.updatedAt = isoNow()
      this.appendActivity(data, member.email, 'Speaker updated', `${lead.name}: ${lead.nextAction || 'No next action'}`)
      return { ok: true, lead: { ...lead } }
    })
  }

  async updateRoomRequest(actor: SpeakerOpsActor, input: Partial<RoomRequest> & { id: string }): Promise<SpeakerOpsWriteResult<{ roomRequest: RoomRequest }>> {
    const member = memberForActor(actor)
    return this.updateData((data) => {
      const request = data.roomRequests[input.id]
      if (!request) return { ok: false, error: 'Room request was not found.' }

      const requestedStatus = input.status && ['draft', 'submitted', 'approved', 'declined'].includes(input.status)
        ? input.status as RoomRequestStatus
        : request.status
      if (!roomStatusTransitionAllowed(request.status, requestedStatus)) {
        return { ok: false, error: `Room request cannot move from ${request.status} to ${requestedStatus}.` }
      }
      if (typeof input.preferredStart === 'string') request.preferredStart = cleanText(input.preferredStart, 80)
      if (typeof input.backupStart === 'string') request.backupStart = cleanText(input.backupStart, 80)
      if (typeof input.setupMinutes === 'number') request.setupMinutes = Math.max(0, Math.min(180, Math.round(input.setupMinutes)))
      if (typeof input.teardownMinutes === 'number') request.teardownMinutes = Math.max(0, Math.min(180, Math.round(input.teardownMinutes)))
      if (typeof input.estimatedAttendance === 'number') request.estimatedAttendance = Math.max(1, Math.min(500, Math.round(input.estimatedAttendance)))
      if (typeof input.accessibilityNotes === 'string') request.accessibilityNotes = cleanText(input.accessibilityNotes, 500)
      if (typeof input.equipmentNotes === 'string') request.equipmentNotes = cleanText(input.equipmentNotes, 500)
      if (input.requestedByEmail && isMemberEmail(input.requestedByEmail)) request.requestedByEmail = input.requestedByEmail
      if (typeof input.reference === 'string') request.reference = cleanText(input.reference, 120)
      if (typeof input.roomName === 'string') request.roomName = cleanText(input.roomName, 120)

      if (requestedStatus === 'approved') {
        if (actor.role !== 'admin') return { ok: false, error: 'Only a workspace administrator can record Ross approval.' }
        if (!request.roomName) return { ok: false, error: 'Enter the Ross room before marking the request approved.' }
        if (!hasApprovalEvidence(request.reference)) return { ok: false, error: 'Add the Ross approval reference or source evidence before marking the request approved.' }
      }
      request.status = requestedStatus
      if (request.status === 'submitted' && !request.submittedAt) {
        request.submittedAt = isoNow()
        request.responseDueAt = addBusinessDays(request.submittedAt, 3)
      }
      request.updatedAt = isoNow()
      const slot = data.slots[request.slotId]
      if (slot) {
        if (request.status === 'submitted' && slot.status === 'planning') slot.status = 'room-requested'
        if (request.status === 'approved' && slot.status !== 'confirmed') slot.status = 'room-approved'
        if (request.status === 'declined') slot.status = 'planning'
        if (request.status === 'draft') slot.status = 'planning'
        slot.updatedAt = request.updatedAt
      }
      this.appendActivity(data, member.email, 'Room request updated', `${request.slotId}: ${request.status}`)
      return { ok: true, roomRequest: { ...request } }
    })
  }

  async updateSlot(actor: SpeakerOpsActor, input: Partial<ProgramSlot> & { id: ProgramSlot['id'] }): Promise<SpeakerOpsWriteResult<{ slot: ProgramSlot }>> {
    const member = memberForActor(actor)
    return this.updateData((data) => {
      const slot = data.slots[input.id]
      if (!slot) return { ok: false, error: 'Program slot was not found.' }

      if (typeof input.leadId === 'string') {
        if (input.leadId && !data.leads[input.leadId]) return { ok: false, error: 'Speaker was not found.' }
        slot.leadId = input.leadId
      }
      if (typeof input.preferredStart === 'string') slot.preferredStart = cleanText(input.preferredStart, 80)
      if (typeof input.backupStart === 'string') slot.backupStart = cleanText(input.backupStart, 80)
      if (input.status && Object.keys(PROGRAM_SLOT_STATUS_LABELS).includes(input.status)) {
        const nextStatus = input.status as ProgramSlotStatus
        const lead = slot.leadId ? data.leads[slot.leadId] : undefined
        if (slot.leadId && (!lead || lead.term !== 'fall-2026' || ['closed', 'deferred'].includes(lead.stage))) {
          return { ok: false, error: 'Choose an eligible Fall 2026 speaker before saving this slot.' }
        }
        if (slot.leadId && Object.values(data.slots).some((candidate) => candidate.id !== slot.id && candidate.leadId === slot.leadId)) {
          return { ok: false, error: 'Each fall slot must use a different speaker.' }
        }
        if (nextStatus === 'confirmed') {
          if (actor.role !== 'admin') return { ok: false, error: 'Only a workspace administrator can confirm a programmed date.' }
          const request = data.roomRequests[slot.roomRequestId]
          if (request?.status !== 'approved') return { ok: false, error: 'Ross must approve the room before the fireside can be confirmed.' }
          if (!slot.leadId) return { ok: false, error: 'Choose a speaker before confirming the fireside.' }
          if (!lead?.proposedSlots.some((proposed) => proposed.status === 'accepted' && proposed.startAt === slot.preferredStart)) {
            return { ok: false, error: 'The speaker must accept this exact proposed time before the fireside can be confirmed.' }
          }
        }
        slot.status = nextStatus
      }
      const selectedLead = slot.leadId ? data.leads[slot.leadId] : undefined
      if (slot.leadId && (!selectedLead || selectedLead.term !== 'fall-2026' || ['closed', 'deferred'].includes(selectedLead.stage))) {
        return { ok: false, error: 'Choose an eligible Fall 2026 speaker before saving this slot.' }
      }
      if (slot.leadId && Object.values(data.slots).some((candidate) => candidate.id !== slot.id && candidate.leadId === slot.leadId)) {
        return { ok: false, error: 'Each fall slot must use a different speaker.' }
      }
      slot.label = selectedLead ? `Fall fireside · ${selectedLead.name}` : 'Fall fireside · Unassigned'
      slot.updatedAt = isoNow()
      this.appendActivity(data, member.email, 'Program slot updated', `${slot.label}: ${slot.status}`)
      return { ok: true, slot: { ...slot } }
    })
  }
}

export const createSpeakerOpsStore = (dataPath?: string, options?: StoreOptions) => (
  new SpeakerOpsStore(dataPath, options)
)
