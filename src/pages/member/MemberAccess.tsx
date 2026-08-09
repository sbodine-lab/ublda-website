import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormEvent } from 'react'
import { PortalPage } from '../../components/portal/PortalShell'
import { PanelHead } from '../../components/portal/PanelHead'
import { ErrorSummary } from '../../components/portal/ErrorSummary'
import { StatusPill } from '../../components/portal/StatusPill'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import { AccessNeedsEditor, draftFromProfile } from '../../components/portal/AccessNeedsEditor'
import type { AccessDraft } from '../../components/portal/AccessNeedsEditor'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { ACCESS_CONSENT_TEXT, emptyAccessProfile } from '../../lib/portalAccess'
import type { AccessProfile } from '../../lib/portalAccess'
import { callPortal } from '../../lib/portalClient'
import type { PortalBootstrap } from '../../lib/portalClient'
import './Member.css'

/**
 * `/members/profile/access` — the accommodations feature (spec §3.4, §6 T4).
 *
 * Read the three binding rules in `AccessNeedsEditor`; this page holds the two
 * that are about the page rather than the fields:
 *
 *  · **Withdraw is one button at the top.** No confirmation modal, no "are you
 *    sure you want to lose these benefits", no second screen. Taking consent
 *    back has to be at least as easy as giving it, and it is retroactive by
 *    construction — nothing derived from access data is ever cached.
 *  · **Nothing on this page is announced in a live region except that a save
 *    happened.** A polite region is read aloud into whatever room the member is
 *    standing in, which may be a full lecture hall. "Access preferences saved."
 *    is the entire announcement, forever.
 */
export default function MemberAccess() {
  const { sessionToken } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const [access, setAccess] = useState<AccessProfile>(emptyAccessProfile)
  const [draft, setDraft] = useState<AccessDraft>(() => draftFromProfile(emptyAccessProfile()))
  const [previewName, setPreviewName] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    callPortal<PortalBootstrap>('portal.bootstrap', sessionToken)
      .then((data) => {
        if (cancelled) return
        setAccess(data.profile.access)
        setDraft(draftFromProfile(data.profile.access))
        setPreviewName(data.profile.preferredName || data.profile.firstName || '')
        setLoadError('')
      })
      .catch((error: Error) => {
        if (cancelled) return
        setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [sessionToken, reloadKey])

  /** Retrying is an event, not an effect — the skeleton comes back from here. */
  const retry = useCallback(() => {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }, [])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setErrors([])

    try {
      const result = await callPortal<{ access: AccessProfile }>('member.saveAccess', sessionToken, {
        needs: draft.needs,
        generalNote: draft.generalNote,
        followUpPreference: draft.followUpPreference,
        scope: draft.scope,
        appliesTo: draft.appliesTo,
        // Verbatim, exactly as displayed on this page, stored for audit.
        consentText: ACCESS_CONSENT_TEXT,
      })
      setAccess(result.access)
      setDraft(draftFromProfile(result.access))
      // Never the content. Never the scope. Just that it saved.
      announce('Access preferences saved.')
    } catch (error) {
      const failure = error as Error & { errors?: string[] }
      const list = failure.errors && failure.errors.length > 0 ? failure.errors : [failure.message]
      setErrors(list)
      announceUrgent('That did not save.')
    } finally {
      setSaving(false)
    }
  }, [announce, announceUrgent, draft, sessionToken])

  const statusRef = useRef<HTMLDivElement>(null)

  const handleWithdraw = useCallback(async () => {
    setWithdrawing(true)
    setErrors([])

    try {
      const result = await callPortal<{ access: AccessProfile }>('member.withdrawAccessConsent', sessionToken)
      setAccess(result.access)
      setDraft(draftFromProfile(result.access))
      announce('Sharing withdrawn. Your notes are still here.')
      // Withdrawing unmounts the panel this button lives in, which would drop focus to
      // <body> and leave a keyboard or screen-reader user with no idea where they are — on
      // the most emotionally loaded control in the product. Move focus to the status line
      // that replaces it, so the next Tab continues from somewhere meaningful.
      window.requestAnimationFrame(() => { statusRef.current?.focus() })
    } catch (error) {
      const failure = error as Error
      setErrors([failure.message])
      announceUrgent('That did not go through.')
    } finally {
      setWithdrawing(false)
    }
  }, [announce, announceUrgent, sessionToken])

  const sharing = access.scope === 'shared-with-leads' && !access.withdrawnAt

  if (loading) {
    return (
      <PortalPage title="Access" lede="What you need in a room. Private unless you say otherwise.">
        <div className="member-loading" role="status">
          <span className="p-visually-hidden">Loading your access preferences.</span>
          <div className="p-skeleton member-loading__block" />
        </div>
      </PortalPage>
    )
  }

  return (
    <PortalPage title="Access" lede="What you need in a room. Private unless you say otherwise.">
      {loadError ? (
        <section className="p-panel member-error" aria-labelledby="member-access-error">
          <h2 className="p-panelhead__title" id="member-access-error">This page could not load</h2>
          <p>{loadError}</p>
          <p className="p-btnrow">
            <button type="button" className="p-btn p-btn--primary" onClick={retry}>
              Try again
            </button>
          </p>
        </section>
      ) : null}

      {/* One button, at the top, no modal in the way of it. */}
      {sharing ? (
        <section className="p-panel member-withdraw" aria-labelledby="member-withdraw-head">
          <div className="member-withdraw__text">
            <h2 className="p-panelhead__title" id="member-withdraw-head">You are sharing this with the four leads</h2>
            <p>
              Stopping is immediate and takes nothing else with it — your notes stay exactly where
              they are, and you can share again whenever you want.
            </p>
          </div>
          <div className="p-btnrow">
            <button
              type="button"
              className="p-btn p-btn--danger p-btn--target"
              disabled={withdrawing}
              onClick={() => { void handleWithdraw() }}
            >
              {withdrawing ? 'Stopping…' : 'Stop sharing'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="p-panel" aria-labelledby="member-access-intro">
        <PanelHead
          id="member-access-intro"
          title="How this works"
          description="Written once, used every time we book a room."
        />
        <div className="p-prose">
          <p>
            We ask what you need in a room. We never ask what is true about your body — there is no
            diagnosis field on this page, no disability question, and there never will be.
          </p>
          <p>
            Everything starts private. Nothing below is pre-selected, no option is marked
            “recommended,” and if you leave this page without sharing, the people planning events see
            the words <strong>Not shared</strong> — never a claim that you have no needs.
          </p>
        </div>
        {/* tabIndex -1 so focus can land here after the withdraw panel unmounts. */}
        <div className="p-cluster" ref={statusRef} tabIndex={-1}>
          <StatusPill
            label={sharing ? 'Shared with the four named leads' : 'Private'}
            tone={sharing ? 'info' : 'neutral'}
          />
          {access.withdrawnAt ? <StatusPill label="Sharing withdrawn" tone="neutral" /> : null}
        </div>
      </section>

      <form className="p-panel member-form" onSubmit={handleSubmit} aria-labelledby="member-access-form-head">
        <PanelHead
          id="member-access-form-head"
          title="What you need"
          description="Pick anything that applies. Skipping the whole list is a valid answer."
        />

        <ErrorSummary errors={errors} />

        <AccessNeedsEditor
          value={draft}
          onChange={setDraft}
          previewName={previewName}
          disabled={saving || withdrawing}
        />

        <div className="p-btnrow">
          <button type="submit" className="p-btn p-btn--primary p-btn--target" disabled={saving || withdrawing}>
            {saving ? 'Saving…' : 'Save access preferences'}
          </button>
          <Link className="p-btn" to="/members/profile">Back to profile</Link>
        </div>
      </form>

      <section className="p-panel" aria-labelledby="member-access-events">
        <PanelHead
          id="member-access-events"
          title="Something for one event only"
          description="A note attached to a single RSVP, with its own separate sharing choice."
        />
        <p>
          This page is for what applies every time. If it is about one room on one night — a
          different entrance, a seat by the door, food you cannot eat that evening — put it on the
          event instead, where it has its own checkbox and does not follow you around.
        </p>
        <div className="p-btnrow">
          <Link className="p-btn" to="/members/events">Go to events</Link>
        </div>
      </section>
    </PortalPage>
  )
}
