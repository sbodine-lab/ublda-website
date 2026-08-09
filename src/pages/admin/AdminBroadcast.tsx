import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PortalPage } from '../../components/portal/PortalShell'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import PanelHead from '../../components/portal/PanelHead'
import StatusPill from '../../components/portal/StatusPill'
import EmptyState from '../../components/portal/EmptyState'
import ErrorSummary from '../../components/portal/ErrorSummary'
import { Choice, Field, FieldGroup, SelectField, TextareaField } from '../../components/portal/Field'
import { IconArrowDown, IconArrowUp } from '../../components/portal/Icons'
import type { StatusTone } from '../../components/portal/StatusPill'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { callPortal, isAdminBootstrap } from '../../lib/portalClient'
import type { AdminWorkspace, PortalBootstrap } from '../../lib/portalClient'
import {
  ANNOUNCEMENT_BODY_LIMIT,
  ANNOUNCEMENT_CTA_LABEL_LIMIT,
  ANNOUNCEMENT_TITLE_LIMIT,
} from '../../lib/portalAnnouncements'
import type {
  AnnouncementAudience,
  AnnouncementStatus,
  PortalAnnouncement,
} from '../../lib/portalAnnouncements'
import {
  RESOURCE_CATEGORIES,
  RESOURCE_CATEGORY_LABELS,
  RESOURCE_DESCRIPTION_LIMIT,
  RESOURCE_FORMAT_NOTE_LIMIT,
  RESOURCE_TITLE_LIMIT,
} from '../../lib/portalResources'
import type { PortalResource, ResourceAudience, ResourceCategory } from '../../lib/portalResources'
import './AdminBroadcast.css'

/**
 * `/dashboard/broadcast` (spec §6 T3) — two panels, one route.
 *
 * Panel 1, announcements: the club's own channel to its members, with the same
 * draft → publish gate events have. Doc #54: nobody confirms a date or discusses
 * fees except through Sam or Alexa, so only a `canPublish` holder publishes. A
 * non-publisher sees a disabled button with the reason stated in text, not a
 * button that fails silently.
 *
 * Panel 2, the member library. Two rules it exists to enforce:
 *  · reordering is BUTTONS, never drag-only (SC 2.5.7 — dragging is a
 *    single-pointer path many of this club's members cannot use);
 *  · `formatNote` is required, because a disability organization that ships an
 *    untagged PDF without saying so has failed its own brief (spec §3.6).
 */

type AnnouncementDraft = {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  pinned: boolean
  ctaLabel: string
  ctaHref: string
  expiresAt: string
}

type ResourceDraft = {
  id: string
  title: string
  description: string
  href: string
  category: ResourceCategory
  formatNote: string
  audience: ResourceAudience
  published: boolean
}

const emptyAnnouncement = (): AnnouncementDraft => ({
  id: '',
  title: '',
  body: '',
  audience: 'all-members',
  pinned: false,
  ctaLabel: '',
  ctaHref: '',
  expiresAt: '',
})

const emptyResource = (): ResourceDraft => ({
  id: '',
  title: '',
  description: '',
  href: '',
  category: 'onboarding',
  formatNote: '',
  audience: 'all-members',
  published: false,
})

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  'all-members': 'Everyone with an account',
  'active-members': 'Active members only',
  eboard: 'E-board only',
}

const STATUS_TONE: Record<AnnouncementStatus, StatusTone> = {
  draft: 'neutral',
  'pending-approval': 'info',
  published: 'success',
  archived: 'neutral',
}

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  draft: 'Draft',
  'pending-approval': 'Waiting on a co-president',
  published: 'Published',
  archived: 'Archived',
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Detroit',
})

const formatDate = (iso: string) => {
  const stamp = Date.parse(iso)
  return !iso || Number.isNaN(stamp) ? '' : dateFormat.format(new Date(stamp))
}

/** `<input type="date">` wants `YYYY-MM-DD`; the store keeps whatever was sent. */
const toDateInput = (iso: string) => (iso ? iso.slice(0, 10) : '')

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const errorList = (error: unknown): string[] => {
  if (error && typeof error === 'object' && Array.isArray((error as { errors?: string[] }).errors)) {
    const errors = (error as { errors: string[] }).errors
    if (errors.length > 0) return errors
  }
  return [error instanceof Error ? error.message : 'That did not save. Try again in a moment.']
}

export default function AdminBroadcast() {
  const { sessionToken, canPublish, hasScope } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const mayWriteAnnouncements = hasScope('announcements')
  const mayWriteResources = hasScope('resources')

  const [workspace, setWorkspace] = useState<AdminWorkspace | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [loadedAt, setLoadedAt] = useState('')

  const [draft, setDraft] = useState<AnnouncementDraft>(emptyAnnouncement)
  const [announcementErrors, setAnnouncementErrors] = useState<string[]>([])
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

  const [resourceDraft, setResourceDraft] = useState<ResourceDraft>(emptyResource)
  const [resourceErrors, setResourceErrors] = useState<string[]>([])
  const [savingResource, setSavingResource] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [pendingFocus, setPendingFocus] = useState<{ id: string; direction: -1 | 1 } | null>(null)

  // StrictMode double-invokes effects in dev (spec §10.12).
  useEffect(() => {
    if (!sessionToken) return
    let cancelled = false

    // Initial state is already 'loading'; `reload()` sets it for subsequent fetches. A
    // synchronous setState in an effect body triggers a cascading render.
    callPortal<PortalBootstrap>('portal.bootstrap', sessionToken)
      .then((bootstrap) => {
        if (cancelled) return
        if (!isAdminBootstrap(bootstrap)) {
          setLoadError('This account does not hold an officer role yet.')
          setLoadState('error')
          return
        }
        setWorkspace(bootstrap.admin)
        setLoadedAt(new Date().toISOString())
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Broadcast did not load.')
        setLoadState('error')
      })

    return () => { cancelled = true }
  }, [reloadKey, sessionToken])

  const reload = useCallback(() => {
    setLoadState('loading')
    setReloadKey((current) => current + 1)
  }, [])

  const announcements = useMemo(() => (
    [...(workspace?.announcements || [])].sort((left, right) => (
      Number(right.pinned) - Number(left.pinned)
      || (right.updatedAt || '').localeCompare(left.updatedAt || '')
    ))
  ), [workspace])

  // Memoised because a fresh [] on every render would re-fire the effect that seeds the
  // reorder draft, wiping an in-progress reorder.
  const resources = useMemo(() => workspace?.resources || [], [workspace])

  const draftCount = announcements.filter((row) => row.status === 'draft').length
  const publishedCount = announcements.filter((row) => row.status === 'published').length

  /* ── Announcements ─────────────────────────────────────────────────── */

  const editAnnouncement = (announcement: PortalAnnouncement) => {
    setAnnouncementErrors([])
    setDraft({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      audience: announcement.audience,
      pinned: announcement.pinned,
      ctaLabel: announcement.ctaLabel,
      ctaHref: announcement.ctaHref,
      expiresAt: toDateInput(announcement.expiresAt),
    })
    announce(`Editing “${announcement.title}”.`)
    document.getElementById('broadcast-title')?.focus()
  }

  const saveAnnouncement = async () => {
    setSavingAnnouncement(true)
    setAnnouncementErrors([])

    try {
      const result = await callPortal<{ announcement: PortalAnnouncement }>(
        'admin.announcement.upsert',
        sessionToken,
        { ...draft },
      )
      setDraft(emptyAnnouncement())
      announce(`Saved “${result.announcement.title}” as a draft. A co-president publishes it.`)
      reload()
    } catch (error) {
      const errors = errorList(error)
      setAnnouncementErrors(errors)
      announceUrgent(errors[0])
    } finally {
      setSavingAnnouncement(false)
    }
  }

  const setAnnouncementStatus = async (announcement: PortalAnnouncement, status: 'published' | 'archived') => {
    try {
      await callPortal<{ announcement: PortalAnnouncement }>('admin.announcement.publish', sessionToken, {
        id: announcement.id,
        status,
      })
      announce(`${status === 'published' ? 'Published' : 'Archived'} “${announcement.title}”.`)
      reload()
    } catch (error) {
      const errors = errorList(error)
      setAnnouncementErrors(errors)
      announceUrgent(errors[0])
    }
  }

  /* ── Member library ────────────────────────────────────────────────── */

  const editResource = (resource: PortalResource) => {
    setResourceErrors([])
    setResourceDraft({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      href: resource.href,
      category: resource.category,
      formatNote: resource.formatNote,
      audience: resource.audience,
      published: resource.published,
    })
    announce(`Editing “${resource.title}”.`)
    document.getElementById('library-title')?.focus()
  }

  const saveResource = async () => {
    setSavingResource(true)
    setResourceErrors([])

    try {
      const result = await callPortal<{ resource: PortalResource }>(
        'admin.resource.upsert',
        sessionToken,
        { ...resourceDraft },
      )
      setResourceDraft(emptyResource())
      announce(`Saved “${result.resource.title}” to the member library.`)
      reload()
    } catch (error) {
      const errors = errorList(error)
      setResourceErrors(errors)
      announceUrgent(errors[0])
    } finally {
      setSavingResource(false)
    }
  }

  /**
   * Reorder by BUTTON, never drag-only (SC 2.5.7). Focus is deliberately put
   * back on a control on the row that just moved: without this the reader is
   * dropped at the top of the document after every single move.
   */
  const moveResource = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= resources.length) return

    const ordered = [...resources]
    const moved = ordered[index]
    ordered[index] = ordered[target]
    ordered[target] = moved

    setReordering(true)
    try {
      const result = await callPortal<{ resources: PortalResource[] }>('admin.resource.reorder', sessionToken, {
        ids: ordered.map((resource) => resource.id),
      })
      setWorkspace((current) => (current ? { ...current, resources: result.resources } : current))
      announce(`${moved.title} moved to position ${target + 1} of ${ordered.length}.`)
      setPendingFocus({ id: moved.id, direction })
    } catch (error) {
      const errors = errorList(error)
      setResourceErrors(errors)
      announceUrgent(errors[0])
    } finally {
      setReordering(false)
    }
  }

  /**
   * Focus restore after a move, in an effect rather than a `requestAnimationFrame`.
   * React's commit is scheduled on a task, so an rAF callback can run against the
   * PRE-move DOM while both buttons are still disabled — `focus()` on a disabled
   * button is a silent no-op and the reader is dumped on `<body>`. Observed, then
   * fixed here. Waiting for `reordering` to clear guarantees the buttons are live.
   */
  useEffect(() => {
    if (!pendingFocus || reordering) return

    const preferred = document.getElementById(`library-${pendingFocus.id}-${pendingFocus.direction === -1 ? 'up' : 'down'}`)
    const fallback = document.getElementById(`library-${pendingFocus.id}-${pendingFocus.direction === -1 ? 'down' : 'up'}`)
    const target = preferred instanceof HTMLButtonElement && !preferred.disabled ? preferred : fallback
    if (target instanceof HTMLButtonElement && !target.disabled) target.focus()
    setPendingFocus(null)
  }, [pendingFocus, reordering, resources])

  const publishBlockedReason = 'A co-president publishes announcements.'

  return (
    <PortalPage
      title="Broadcast"
      lede="The club's own channel: what members are told, and what they can go read."
      actions={
        <button type="button" className="p-btn" onClick={reload}>
          {loadState === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      {loadState === 'error' ? (
        <ErrorSummary errors={[loadError || 'Broadcast did not load.']} title="Broadcast did not load." />
      ) : null}

      {/* ── Announcements ───────────────────────────────────────────── */}

      {mayWriteAnnouncements ? (
        <section className="p-panel" aria-labelledby="broadcast-announcements">
          <PanelHead
            id="broadcast-announcements"
            title="Announcements"
            description="Plain text, no HTML. Everything starts as a draft; a co-president publishes it."
            meta={loadState === 'ready'
              ? [plural(publishedCount, 'published', 'published'), plural(draftCount, 'draft', 'drafts')]
              : undefined}
            updatedAt={loadedAt}
          />

          {loadState === 'loading' ? (
            <p className="p-meta">Loading announcements…</p>
          ) : announcements.length === 0 ? (
            <EmptyState
              title="Quiet week."
              body="When there's something to say, it goes here first — before the group chat, so it stays findable."
              align="left"
            />
          ) : (
            <ul className="broadcast-list">
              {announcements.map((announcement) => (
                <li className="broadcast-row" key={announcement.id}>
                  <div className="broadcast-row__text">
                    <h3 className="broadcast-row__title">
                      {announcement.pinned ? <span className="broadcast-row__pin" aria-hidden="true">▲ </span> : null}
                      {announcement.title}
                      {announcement.pinned ? <span className="p-visually-hidden"> (pinned)</span> : null}
                    </h3>
                    <p className="broadcast-row__body">{announcement.body}</p>
                    <p className="broadcast-row__meta">
                      {AUDIENCE_LABEL[announcement.audience]}
                      {announcement.publishedAt ? ` · published ${formatDate(announcement.publishedAt)}` : ''}
                      {announcement.expiresAt ? ` · expires ${formatDate(announcement.expiresAt)}` : ' · no expiry'}
                    </p>
                  </div>
                  <div className="broadcast-row__side">
                    <StatusPill label={STATUS_LABEL[announcement.status]} tone={STATUS_TONE[announcement.status]} />
                    <div className="p-btnrow">
                      <button
                        type="button"
                        className="p-btn p-btn--sm"
                        onClick={() => editAnnouncement(announcement)}
                      >
                        Edit
                        <span className="p-visually-hidden">{` “${announcement.title}”`}</span>
                      </button>
                      {announcement.status === 'published' ? (
                        <button
                          type="button"
                          className="p-btn p-btn--sm"
                          disabled={!canPublish}
                          onClick={() => void setAnnouncementStatus(announcement, 'archived')}
                        >
                          Archive
                          <span className="p-visually-hidden">{` “${announcement.title}”`}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="p-btn p-btn--sm p-btn--primary"
                          disabled={!canPublish}
                          onClick={() => void setAnnouncementStatus(announcement, 'published')}
                        >
                          Publish
                          <span className="p-visually-hidden">{` “${announcement.title}”`}</span>
                        </button>
                      )}
                    </div>
                    {canPublish ? null : <p className="broadcast-gate">{publishBlockedReason}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            className="broadcast-form"
            noValidate
            onSubmit={(event) => { event.preventDefault(); void saveAnnouncement() }}
          >
            <h3 className="broadcast-form__title">{draft.id ? 'Edit this announcement' : 'Write an announcement'}</h3>
            <ErrorSummary errors={announcementErrors} headingLevel={4} />

            <Field
              id="broadcast-title"
              label="Title"
              required
              maxLength={ANNOUNCEMENT_TITLE_LIMIT}
              hint={`Up to ${ANNOUNCEMENT_TITLE_LIMIT} characters. Say the thing, not "Update".`}
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />

            <TextareaField
              id="broadcast-body"
              label="Message"
              required
              rows={6}
              showCount
              maxLength={ANNOUNCEMENT_BODY_LIMIT}
              hint={`Plain text with line breaks, up to ${ANNOUNCEMENT_BODY_LIMIT} characters. Links are not clickable in the body — use the button below.`}
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
            />

            <div className="broadcast-form__row">
              <SelectField
                id="broadcast-audience"
                label="Who sees this"
                value={draft.audience}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  audience: event.target.value as AnnouncementAudience,
                }))}
                options={[
                  { value: 'all-members', label: AUDIENCE_LABEL['all-members'] },
                  { value: 'active-members', label: AUDIENCE_LABEL['active-members'] },
                  { value: 'eboard', label: AUDIENCE_LABEL.eboard },
                ]}
              />
              <Field
                id="broadcast-expires"
                type="date"
                label="Stop showing it after"
                hint="Leave blank to keep it up until someone archives it."
                value={draft.expiresAt}
                onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value }))}
              />
            </div>

            <div className="broadcast-form__row">
              <Field
                id="broadcast-cta-label"
                label="Button label (optional)"
                maxLength={ANNOUNCEMENT_CTA_LABEL_LIMIT}
                hint="Only if there is somewhere to go. A label needs a link."
                value={draft.ctaLabel}
                onChange={(event) => setDraft((current) => ({ ...current, ctaLabel: event.target.value }))}
              />
              <Field
                id="broadcast-cta-href"
                label="Button link (optional)"
                inputMode="url"
                hint="Must start with https:// or be a path on this site, like /members/events."
                value={draft.ctaHref}
                onChange={(event) => setDraft((current) => ({ ...current, ctaHref: event.target.value }))}
              />
            </div>

            <FieldGroup legend="Pin it">
              <Choice
                type="checkbox"
                label="Keep this at the top of Member Home"
                note="One pinned announcement is a notice. Four are wallpaper."
                checked={draft.pinned}
                onChange={(event) => setDraft((current) => ({ ...current, pinned: event.target.checked }))}
              />
            </FieldGroup>

            <div className="p-btnrow">
              <button type="submit" className="p-btn p-btn--primary" disabled={savingAnnouncement}>
                {savingAnnouncement ? 'Saving…' : draft.id ? 'Save changes' : 'Save as draft'}
              </button>
              {draft.id ? (
                <button
                  type="button"
                  className="p-btn"
                  onClick={() => { setDraft(emptyAnnouncement()); setAnnouncementErrors([]) }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
            <p className="broadcast-gate">
              {canPublish
                ? 'You can publish. Save the draft first, then publish it from the list above.'
                : `${publishBlockedReason} Save the draft and it appears in the list above for them.`}
            </p>
          </form>
        </section>
      ) : null}

      {/* ── Member library ──────────────────────────────────────────── */}

      {mayWriteResources ? (
        <section className="p-panel" aria-labelledby="broadcast-library">
          <PanelHead
            id="broadcast-library"
            title="Member library"
            description="Every link a member can open, in the order they see it. Each one says what format it is in."
            meta={loadState === 'ready' ? [plural(resources.length, 'link', 'links')] : undefined}
            updatedAt={loadedAt}
            actions={<Link className="p-btn p-btn--sm" to="/members/resources">See the member view</Link>}
          />

          {loadState === 'loading' ? (
            <p className="p-meta">Loading the library…</p>
          ) : resources.length === 0 ? (
            <EmptyState
              title="Nothing in the library yet."
              body="Start with the three a new member actually needs: how the club works, who to ask, and where the accessibility commitments are written down."
              align="left"
            />
          ) : (
            <ol className="library-list">
              {resources.map((resource, index) => (
                <li className="library-row" key={resource.id}>
                  <div className="library-row__order">
                    <span className="library-row__position p-num" aria-hidden="true">{index + 1}</span>
                    <button
                      type="button"
                      id={`library-${resource.id}-up`}
                      className="p-btn p-btn--sm p-btn--icon"
                      disabled={index === 0 || reordering}
                      onClick={() => void moveResource(index, -1)}
                    >
                      <IconArrowUp />
                      <span className="p-visually-hidden">{`Move ${resource.title} up`}</span>
                    </button>
                    <button
                      type="button"
                      id={`library-${resource.id}-down`}
                      className="p-btn p-btn--sm p-btn--icon"
                      disabled={index === resources.length - 1 || reordering}
                      onClick={() => void moveResource(index, 1)}
                    >
                      <IconArrowDown />
                      <span className="p-visually-hidden">{`Move ${resource.title} down`}</span>
                    </button>
                  </div>
                  <div className="library-row__text">
                    <h3 className="library-row__title">{resource.title}</h3>
                    {resource.description ? <p className="library-row__desc">{resource.description}</p> : null}
                    <p className="library-row__format">
                      <span className="p-visually-hidden">Format: </span>
                      {resource.formatNote}
                    </p>
                    <p className="library-row__meta">
                      {RESOURCE_CATEGORY_LABELS[resource.category]}
                      {` · ${resource.audience === 'eboard' ? 'E-board only' : 'All members'}`}
                      {` · ${resource.href}`}
                    </p>
                  </div>
                  <div className="library-row__side">
                    <StatusPill
                      label={resource.published ? 'Published' : 'Hidden'}
                      tone={resource.published ? 'success' : 'neutral'}
                    />
                    <button type="button" className="p-btn p-btn--sm" onClick={() => editResource(resource)}>
                      Edit
                      <span className="p-visually-hidden">{` “${resource.title}”`}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <form
            className="broadcast-form"
            noValidate
            onSubmit={(event) => { event.preventDefault(); void saveResource() }}
          >
            <h3 className="broadcast-form__title">{resourceDraft.id ? 'Edit this link' : 'Add a link'}</h3>
            <ErrorSummary errors={resourceErrors} headingLevel={4} />

            <Field
              id="library-title"
              label="Title"
              required
              maxLength={RESOURCE_TITLE_LIMIT}
              value={resourceDraft.title}
              onChange={(event) => setResourceDraft((current) => ({ ...current, title: event.target.value }))}
            />

            <Field
              id="library-href"
              label="Link"
              required
              inputMode="url"
              hint="Must start with https:// or be a path on this site."
              value={resourceDraft.href}
              onChange={(event) => setResourceDraft((current) => ({ ...current, href: event.target.value }))}
            />

            <TextareaField
              id="library-description"
              label="What it is"
              rows={3}
              showCount
              maxLength={RESOURCE_DESCRIPTION_LIMIT}
              hint="One or two sentences. Say what someone gets by opening it."
              value={resourceDraft.description}
              onChange={(event) => setResourceDraft((current) => ({ ...current, description: event.target.value }))}
            />

            <Field
              id="library-format"
              label="Format note"
              required
              maxLength={RESOURCE_FORMAT_NOTE_LIMIT}
              hint={
                <>
                  Rendered on every row, to every member, always. Somebody using a screen reader
                  decides whether to open this before they click it — so say what it actually is:
                  <em>{' “Tagged PDF, screen-reader tested”'}</em>,<em>{' “Captioned”'}</em>, or
                  <em>{' “Not yet remediated — email us and we’ll send another format”'}</em>. An
                  untagged file shipped without saying so is the failure this field exists to stop.
                </>
              }
              value={resourceDraft.formatNote}
              onChange={(event) => setResourceDraft((current) => ({ ...current, formatNote: event.target.value }))}
            />

            <div className="broadcast-form__row">
              <SelectField
                id="library-category"
                label="Category"
                value={resourceDraft.category}
                onChange={(event) => setResourceDraft((current) => ({
                  ...current,
                  category: event.target.value as ResourceCategory,
                }))}
                options={RESOURCE_CATEGORIES.map((category) => ({
                  value: category,
                  label: RESOURCE_CATEGORY_LABELS[category],
                }))}
              />
              <SelectField
                id="library-audience"
                label="Who sees it"
                value={resourceDraft.audience}
                onChange={(event) => setResourceDraft((current) => ({
                  ...current,
                  audience: event.target.value as ResourceAudience,
                }))}
                options={[
                  { value: 'all-members', label: 'All members' },
                  { value: 'eboard', label: 'E-board only' },
                ]}
              />
            </div>

            <FieldGroup legend="Publish it">
              <Choice
                type="checkbox"
                label="Show this to members now"
                note="Leave it off while the file is still being fixed."
                checked={resourceDraft.published}
                onChange={(event) => setResourceDraft((current) => ({ ...current, published: event.target.checked }))}
              />
            </FieldGroup>

            <div className="p-btnrow">
              <button type="submit" className="p-btn p-btn--primary" disabled={savingResource}>
                {savingResource ? 'Saving…' : resourceDraft.id ? 'Save changes' : 'Add to the library'}
              </button>
              {resourceDraft.id ? (
                <button
                  type="button"
                  className="p-btn"
                  onClick={() => { setResourceDraft(emptyResource()); setResourceErrors([]) }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      {!mayWriteAnnouncements && !mayWriteResources ? (
        <section className="p-panel" aria-labelledby="broadcast-noscope">
          <PanelHead
            id="broadcast-noscope"
            title="Broadcast"
            description="This section is held by the officers who write to members."
          />
          <EmptyState
            title="You do not hold announcements or resources."
            body="Ask a co-president to add the permission from the Console if this is part of your role."
            align="left"
          />
        </section>
      ) : null}
    </PortalPage>
  )
}
