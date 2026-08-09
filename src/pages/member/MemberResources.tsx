import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PortalPage } from '../../components/portal/PortalShell'
import { PanelHead } from '../../components/portal/PanelHead'
import { EmptyState } from '../../components/portal/EmptyState'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import { IconExternal } from '../../components/portal/Icons'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { callPortal } from '../../lib/portalClient'
import type { PortalBootstrap, PortalResourcePublicView } from '../../lib/portalClient'
import { RESOURCE_CATEGORIES, RESOURCE_CATEGORY_LABELS } from '../../lib/portalResources'
import './Member.css'

/**
 * `/members/resources` (spec §6 T4).
 *
 * Every row renders its `formatNote`, without exception. A disability
 * organization that hands out an untagged PDF without saying so has failed its
 * own brief — so the note is not a nice-to-have field, it is the row.
 *
 * External links are marked as external and say they open in a new tab. Nobody
 * should have their tab stack changed without being told first.
 */
export default function MemberResources() {
  const { sessionToken } = useMemberAuth()
  const { announce } = usePortalAnnouncer()

  const [bootstrap, setBootstrap] = useState<PortalBootstrap | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    callPortal<PortalBootstrap>('portal.bootstrap', sessionToken)
      .then((data) => {
        if (cancelled) return
        setBootstrap(data)
        setLoadError('')
        const count = data.resources.length
        announce(count === 1 ? '1 resource in the library.' : `${count} resources in the library.`)
      })
      .catch((error: Error) => {
        if (cancelled) return
        setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [announce, sessionToken, reloadKey])

  /** Retrying is an event, not an effect — the skeleton comes back from here. */
  const retry = useCallback(() => {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }, [])

  const grouped = useMemo(() => {
    const resources = bootstrap?.resources || []
    return RESOURCE_CATEGORIES
      .map((category) => ({
        category,
        label: RESOURCE_CATEGORY_LABELS[category],
        rows: resources
          .filter((resource) => resource.category === category)
          .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title)),
      }))
      .filter((group) => group.rows.length > 0)
  }, [bootstrap])

  const total = bootstrap?.resources.length || 0

  if (loading && !bootstrap) {
    return (
      <PortalPage title="Resources" lede="Links the club maintains, each one labelled with the format it is in.">
        <div className="member-loading" role="status">
          <span className="p-visually-hidden">Loading the resource library.</span>
          <div className="p-skeleton member-loading__block" />
        </div>
      </PortalPage>
    )
  }

  return (
    <PortalPage title="Resources" lede="Links the club maintains, each one labelled with the format it is in.">
      {loadError ? (
        <section className="p-panel member-error" aria-labelledby="member-resources-error">
          <h2 className="p-panelhead__title" id="member-resources-error">The library could not load</h2>
          <p>{loadError}</p>
          <p className="p-btnrow">
            <button type="button" className="p-btn p-btn--primary" onClick={retry}>
              Try again
            </button>
          </p>
        </section>
      ) : null}

      {total > 0 ? (
        grouped.map((group) => (
          <section className="p-panel" key={group.category} aria-labelledby={`member-res-${group.category}`}>
            <PanelHead
              id={`member-res-${group.category}`}
              title={group.label}
              description="Each link says what format it is in before you open it."
              meta={[group.rows.length === 1 ? '1 link' : `${group.rows.length} links`]}
            />
            <ul className="member-resources">
              {group.rows.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <section className="p-panel" aria-labelledby="member-res-empty">
          <PanelHead
            id="member-res-empty"
            title="The library"
            description="Onboarding, campus support, the BLDA network, and the club's own documents."
          />
          <EmptyState
            title="Nothing in here yet."
            body="The first links go up before Festifall: the campus accessibility offices, the BLDA network, and how this club actually runs. Every one of them will say what format it is in before you open it."
            action={<Link className="p-btn" to="/members/home">Back to home</Link>}
          />
        </section>
      )}
    </PortalPage>
  )
}

function ResourceRow({ resource }: { resource: PortalResourcePublicView }) {
  const external = resource.href.startsWith('https://')

  return (
    <li className="member-resource">
      <h3 className="member-resource__title">
        {external ? (
          <a className="member-resource__link" href={resource.href} target="_blank" rel="noopener noreferrer">
            {resource.title}
            <IconExternal size={14} />
            <span className="p-visually-hidden"> — opens in a new tab</span>
          </a>
        ) : (
          <Link className="member-resource__link" to={resource.href}>{resource.title}</Link>
        )}
      </h3>
      {resource.description ? <p className="member-resource__desc">{resource.description}</p> : null}
      {/* Required, and always rendered. */}
      <p className="member-resource__format">
        <span className="member-resource__formatlabel">Format</span>
        {resource.formatNote}
      </p>
    </li>
  )
}
