export type AnnouncementAudience = 'all-members' | 'active-members' | 'eboard'
export type AnnouncementStatus = 'draft' | 'pending-approval' | 'published' | 'archived'

export const ANNOUNCEMENT_AUDIENCES: AnnouncementAudience[] = ['all-members', 'active-members', 'eboard']
export const ANNOUNCEMENT_STATUSES: AnnouncementStatus[] = ['draft', 'pending-approval', 'published', 'archived']

export const ANNOUNCEMENT_TITLE_LIMIT = 120
export const ANNOUNCEMENT_BODY_LIMIT = 4000
export const ANNOUNCEMENT_CTA_LABEL_LIMIT = 60
export const ANNOUNCEMENT_HREF_LIMIT = 500

export type PortalAnnouncement = {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  status: AnnouncementStatus
  pinned: boolean
  ctaLabel: string
  ctaHref: string
  authorEmail: string
  approvedBy: string
  publishedAt: string
  expiresAt: string
  createdAt: string
  updatedAt: string
}

export type AnnouncementPublicView = Pick<PortalAnnouncement,
  'id' | 'title' | 'body' | 'pinned' | 'publishedAt' | 'ctaLabel' | 'ctaHref'> & { postedBy: string }

/** The author-supplied half. `status` and the approval stamps are never accepted from a client. */
export type AnnouncementData = {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  pinned: boolean
  ctaLabel: string
  ctaHref: string
  expiresAt: string
}

export type AnnouncementValidation =
  | { success: true; data: AnnouncementData; errors: [] }
  | { success: false; data: null; errors: string[] }

const createId = (prefix: string) => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

  return `${prefix}_${suffix}`
}

/** Plain text with newlines. NO HTML is stored or rendered. */
const getText = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.replace(/[<>]/g, '').trim() : ''
}

const isSafeHref = (value: string) => value.startsWith('https://') || value.startsWith('/')

export const validateAnnouncementPayload = (payload: unknown): AnnouncementValidation => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Announcement was empty.'] }
  }

  const body = payload as Record<string, unknown>
  if (Object.keys(body).length === 0) {
    return { success: false, data: null, errors: ['Announcement was empty.'] }
  }

  const errors: string[] = []
  const id = getText(body, 'id')
  const title = getText(body, 'title')
  const text = getText(body, 'body')
  const audience = getText(body, 'audience') || 'all-members'
  const ctaLabel = getText(body, 'ctaLabel')
  const ctaHref = getText(body, 'ctaHref')
  const expiresAt = getText(body, 'expiresAt')

  if (!title) errors.push('Announcement title is required.')
  if (title.length > ANNOUNCEMENT_TITLE_LIMIT) errors.push(`Announcement title must be ${ANNOUNCEMENT_TITLE_LIMIT} characters or fewer.`)
  if (!text) errors.push('Announcement body is required.')
  if (text.length > ANNOUNCEMENT_BODY_LIMIT) errors.push(`Announcement body must be ${ANNOUNCEMENT_BODY_LIMIT} characters or fewer.`)
  if (!ANNOUNCEMENT_AUDIENCES.some((option) => option === audience)) errors.push('Choose an audience from the list.')
  if (ctaLabel.length > ANNOUNCEMENT_CTA_LABEL_LIMIT) errors.push(`The button label must be ${ANNOUNCEMENT_CTA_LABEL_LIMIT} characters or fewer.`)
  if (ctaHref.length > ANNOUNCEMENT_HREF_LIMIT) errors.push(`The button link must be ${ANNOUNCEMENT_HREF_LIMIT} characters or fewer.`)
  if (ctaHref && !isSafeHref(ctaHref)) errors.push('The button link must start with https:// or be a path on this site.')
  if (ctaLabel && !ctaHref) errors.push('A button label needs a link to go with it.')
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) errors.push('The expiry date must be a real date.')

  if (errors.length > 0) {
    return { success: false, data: null, errors }
  }

  return {
    success: true,
    data: {
      id,
      title,
      body: text,
      audience: audience as AnnouncementAudience,
      pinned: body.pinned === true,
      ctaLabel,
      ctaHref,
      expiresAt,
    },
    errors: [],
  }
}

export const buildAnnouncement = (data: AnnouncementData, actorEmail: string): PortalAnnouncement => {
  const now = new Date().toISOString()

  return {
    id: data.id || createId('announcement'),
    title: data.title,
    body: data.body,
    audience: data.audience,
    status: 'draft',
    pinned: data.pinned,
    ctaLabel: data.ctaLabel,
    ctaHref: data.ctaHref,
    authorEmail: actorEmail.trim().toLowerCase(),
    approvedBy: '',
    publishedAt: '',
    expiresAt: data.expiresAt,
    createdAt: now,
    updatedAt: now,
  }
}

/** Edits an existing announcement. `status` and the approval stamps stay put. */
export const mergeAnnouncement = (
  existing: PortalAnnouncement,
  data: AnnouncementData,
  now: string,
): PortalAnnouncement => ({
  ...buildAnnouncement({ ...data, id: existing.id }, existing.authorEmail),
  status: existing.status,
  approvedBy: existing.approvedBy,
  publishedAt: existing.publishedAt,
  createdAt: existing.createdAt,
  updatedAt: now,
})

export const isAnnouncementVisible = (announcement: PortalAnnouncement, now: string) => {
  if (announcement.status !== 'published') return false
  if (!announcement.expiresAt) return true

  const expiresAt = Date.parse(announcement.expiresAt)
  if (Number.isNaN(expiresAt)) return true

  const nowMs = Number.isNaN(Date.parse(now)) ? Date.now() : Date.parse(now)
  return expiresAt > nowMs
}

/** `postedBy` is the officer's display name, never their email. */
export const buildAnnouncementPublicView = (
  announcement: PortalAnnouncement,
  postedBy: string,
): AnnouncementPublicView => ({
  id: announcement.id,
  title: announcement.title,
  body: announcement.body,
  pinned: announcement.pinned,
  publishedAt: announcement.publishedAt,
  ctaLabel: announcement.ctaLabel,
  ctaHref: announcement.ctaHref,
  postedBy,
})
