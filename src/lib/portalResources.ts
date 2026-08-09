export type ResourceCategory = 'onboarding' | 'recruiting' | 'accessibility' | 'blda-network' | 'campus-support' | 'club-docs'
export type ResourceAudience = 'all-members' | 'eboard'

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  'onboarding', 'recruiting', 'accessibility', 'blda-network', 'campus-support', 'club-docs',
]

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  onboarding: 'Getting started',
  recruiting: 'Recruiting',
  accessibility: 'Accessibility',
  'blda-network': 'BLDA network',
  'campus-support': 'Campus support',
  'club-docs': 'Club documents',
}

export const RESOURCE_AUDIENCES: ResourceAudience[] = ['all-members', 'eboard']

export const RESOURCE_TITLE_LIMIT = 120
export const RESOURCE_DESCRIPTION_LIMIT = 300
export const RESOURCE_FORMAT_NOTE_LIMIT = 120
export const RESOURCE_HREF_LIMIT = 500
export const RESOURCE_REORDER_LIMIT = 200

export type PortalResource = {
  id: string
  title: string
  description: string
  href: string
  category: ResourceCategory
  /**
   * REQUIRED and always rendered. A disability organization that ships an untagged PDF
   * without saying so has failed its own brief.
   */
  formatNote: string
  audience: ResourceAudience
  order: number
  published: boolean
  addedBy: string
  createdAt: string
  updatedAt: string
}

export type PortalResourceData = {
  id: string
  title: string
  description: string
  href: string
  category: ResourceCategory
  formatNote: string
  audience: ResourceAudience
  published: boolean
}

export type PortalResourceValidation =
  | { success: true; data: PortalResourceData; errors: [] }
  | { success: false; data: null; errors: string[] }

/** Suggested wording for the required format note. Never auto-filled. */
export const RESOURCE_FORMAT_NOTE_EXAMPLES = [
  'Tagged PDF, screen-reader tested',
  'Captioned',
  'Not yet remediated — email us and we’ll send another format',
]

const createId = (prefix: string) => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

  return `${prefix}_${suffix}`
}

const getString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' ? value.replace(/[<>]/g, '').trim() : ''
}

const isSafeHref = (value: string) => value.startsWith('https://') || value.startsWith('/')

export const validatePortalResourcePayload = (payload: unknown): PortalResourceValidation => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, data: null, errors: ['Resource was empty.'] }
  }

  const body = payload as Record<string, unknown>
  if (Object.keys(body).length === 0) {
    return { success: false, data: null, errors: ['Resource was empty.'] }
  }

  const errors: string[] = []
  const id = getString(body, 'id')
  const title = getString(body, 'title')
  const description = getString(body, 'description')
  const href = getString(body, 'href')
  const category = getString(body, 'category')
  const formatNote = getString(body, 'formatNote')
  const audience = getString(body, 'audience') || 'all-members'

  if (!title) errors.push('Resource title is required.')
  if (title.length > RESOURCE_TITLE_LIMIT) errors.push(`Resource title must be ${RESOURCE_TITLE_LIMIT} characters or fewer.`)
  if (description.length > RESOURCE_DESCRIPTION_LIMIT) errors.push(`Resource description must be ${RESOURCE_DESCRIPTION_LIMIT} characters or fewer.`)
  if (!href) errors.push('Resource link is required.')
  else if (href.length > RESOURCE_HREF_LIMIT) errors.push(`Resource link must be ${RESOURCE_HREF_LIMIT} characters or fewer.`)
  else if (!isSafeHref(href)) errors.push('Resource link must start with https:// or be a path on this site.')
  if (!RESOURCE_CATEGORIES.some((option) => option === category)) errors.push('Choose a resource category from the list.')
  if (!formatNote) errors.push('Say what format this is in — members need to know before they open it.')
  else if (formatNote.length > RESOURCE_FORMAT_NOTE_LIMIT) errors.push(`The format note must be ${RESOURCE_FORMAT_NOTE_LIMIT} characters or fewer.`)
  if (!RESOURCE_AUDIENCES.some((option) => option === audience)) errors.push('Choose who this resource is for.')

  if (errors.length > 0) {
    return { success: false, data: null, errors }
  }

  return {
    success: true,
    data: {
      id,
      title,
      description,
      href,
      category: category as ResourceCategory,
      formatNote,
      audience: audience as ResourceAudience,
      published: body.published === true,
    },
    errors: [],
  }
}

export const buildPortalResource = (
  data: PortalResourceData,
  actorEmail: string,
  order: number,
): PortalResource => {
  const now = new Date().toISOString()

  return {
    id: data.id || createId('resource'),
    title: data.title,
    description: data.description,
    href: data.href,
    category: data.category,
    formatNote: data.formatNote,
    audience: data.audience,
    order,
    published: data.published,
    addedBy: actorEmail.trim().toLowerCase(),
    createdAt: now,
    updatedAt: now,
  }
}

export const mergePortalResource = (
  existing: PortalResource,
  data: PortalResourceData,
  now: string,
): PortalResource => ({
  ...buildPortalResource({ ...data, id: existing.id }, existing.addedBy, existing.order),
  createdAt: existing.createdAt,
  updatedAt: now,
})

export const sortPortalResources = (resources: PortalResource[]) => (
  [...resources].sort((left, right) => (
    left.order - right.order || left.title.localeCompare(right.title)
  ))
)

/** Member-visible projection. `addedBy` is admin-only and is never copied across. */
export const toPortalResourcePublicView = (resource: PortalResource): Omit<PortalResource, 'addedBy'> => ({
  id: resource.id,
  title: resource.title,
  description: resource.description,
  href: resource.href,
  category: resource.category,
  formatNote: resource.formatNote,
  audience: resource.audience,
  order: resource.order,
  published: resource.published,
  createdAt: resource.createdAt,
  updatedAt: resource.updatedAt,
})
