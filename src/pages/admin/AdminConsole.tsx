import { useCallback, useEffect, useMemo, useState } from 'react'
import { PortalPage } from '../../components/portal/PortalShell'
import PanelHead from '../../components/portal/PanelHead'
import EmptyState from '../../components/portal/EmptyState'
import StatusPill from '../../components/portal/StatusPill'
import DataTable from '../../components/portal/DataTable'
import type { DataTableColumn } from '../../components/portal/DataTable'
import ErrorSummary from '../../components/portal/ErrorSummary'
import PortalDialog from '../../components/portal/PortalDialog'
import { Choice, Field, FieldGroup, SelectField } from '../../components/portal/Field'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import { IconDownload } from '../../components/portal/Icons'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { callPortal } from '../../lib/portalClient'
import type { AdminBootstrap, PortalAuditListData, PortalBootstrap, PortalExportData } from '../../lib/portalClient'
import { isAdminBootstrap } from '../../lib/portalClient'
import { ADMIN_ACCOUNTS, ADMIN_SCOPES, SUPER_ADMIN_EMAIL } from '../../lib/dashboardAccess'
import type { AdminScope, DashboardRole } from '../../lib/dashboardAccess'
import type { AuditEntry } from '../../lib/portalAudit'
import './AdminConsole.css'

/**
 * `/dashboard/console` — super-admin only (spec §6 T1).
 *
 * Four things nobody else can see: who holds which role, every mutating action the
 * portal has recorded, whether the backend is actually up, and the roster export.
 *
 * The officer table is the club's real roster from `dashboardAccess`. The "portal
 * account" column is derived, not stored: an email holds an account when it appears
 * in the roster or in the intake queue — plus the super-admin, whose account the
 * store force-injects on every read in every environment. That distinction matters
 * because `admin.grantRole` refuses an email that has never signed in.
 */

const AUDIT_LIMIT = 100

const ROLE_LABEL: Record<DashboardRole, string> = {
  member: 'Member',
  exec: 'Exec',
  'super-admin': 'Super admin',
}

const SCOPE_LABEL: Record<AdminScope, string> = {
  recruiting: 'Recruiting',
  members: 'Members',
  events: 'Events',
  announcements: 'Announcements',
  resources: 'Resources',
  system: 'System',
}

const READINESS_TONE = { pass: 'success', warn: 'warn', fail: 'danger' } as const
const READINESS_LABEL = { pass: 'Ready', warn: 'Needs a look', fail: 'Blocked' } as const

const stampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Detroit',
})

const formatStamp = (iso: string) => {
  if (!iso) return ''
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? '' : stampFormatter.format(parsed)
}

type GrantForm = {
  email: string
  role: DashboardRole
  scopes: AdminScope[]
  title: string
}

const emptyGrant: GrantForm = { email: '', role: 'exec', scopes: [], title: '' }

/** A shipped-roster officer, a role granted here, or both merged. */
type OfficerRow = {
  email: string
  name: string
  title: string
  role: DashboardRole
  scopes: AdminScope[]
  /** False when this role exists only because someone granted it in the Console. */
  onRoster: boolean
}

const grantFor = (officer: OfficerRow): GrantForm => ({
  email: officer.email,
  role: officer.role,
  scopes: [...officer.scopes],
  title: officer.title,
})

export default function AdminConsole() {
  const { sessionToken, account } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [grantOpen, setGrantOpen] = useState(false)
  const [grant, setGrant] = useState<GrantForm>(emptyGrant)
  const [grantErrors, setGrantErrors] = useState<string[]>([])
  const [granting, setGranting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const selfEmail = (account?.email || '').toLowerCase()

  const load = useCallback(async (signal: { cancelled: boolean }) => {
    try {
      const [data, log] = await Promise.all([
        callPortal<PortalBootstrap>('portal.bootstrap', sessionToken),
        callPortal<PortalAuditListData>('admin.audit.list', sessionToken, { limit: AUDIT_LIMIT }),
      ])
      if (signal.cancelled) return
      if (!isAdminBootstrap(data)) {
        setLoadError('This account is not an officer account.')
        return
      }
      setBootstrap(data)
      setEntries(log.entries)
      setLoadError('')
    } catch (error) {
      if (signal.cancelled) return
      setLoadError(error instanceof Error ? error.message : 'The console did not load.')
    } finally {
      if (!signal.cancelled) setLoading(false)
    }
  }, [sessionToken])

  // StrictMode double-invokes this in dev; the flag stops the torn-down pass writing state.
  useEffect(() => {
    const signal = { cancelled: false }
    setLoading(true)
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load])

  const refreshAudit = useCallback(async () => {
    const log = await callPortal<PortalAuditListData>('admin.audit.list', sessionToken, { limit: AUDIT_LIMIT })
    setEntries(log.entries)
  }, [sessionToken])

  /**
   * Derived, not stored: `grantRole` only works on an email that already has an
   * account, so the console has to say which officers do.
   */
  const accountEmails = useMemo(() => {
    const known = new Set<string>([SUPER_ADMIN_EMAIL])
    bootstrap?.admin.members.forEach((member) => known.add(member.email))
    bootstrap?.admin.unprocessedIntake.forEach((row) => known.add(row.email))
    return known
  }, [bootstrap])

  /**
   * The shipped roster UNION whatever roles are actually stored. `grantRole` writes onto the
   * account, so it can elevate somebody who is not in `ADMIN_ACCOUNTS` at all — and a screen
   * for managing access that cannot show such a grant cannot be used to revoke it either.
   * Where the two disagree, the stored account wins: that is what the server enforces.
   */
  const officerRows = useMemo<OfficerRow[]>(() => {
    const granted = new Map(
      (bootstrap?.admin.adminAccounts || []).map((account) => [account.email, account]),
    )
    const rows: OfficerRow[] = ADMIN_ACCOUNTS.map((rosterAccount) => {
      const live = granted.get(rosterAccount.email)
      granted.delete(rosterAccount.email)
      return {
        email: rosterAccount.email,
        name: rosterAccount.name,
        title: live?.adminTitle || rosterAccount.title,
        role: live?.role || rosterAccount.role,
        scopes: live?.adminScopes?.length ? live.adminScopes : rosterAccount.scopes,
        onRoster: true,
      }
    })

    granted.forEach((account) => {
      rows.push({
        email: account.email,
        name: `${account.firstName} ${account.lastName}`.trim() || account.uniqname,
        title: account.adminTitle || 'Granted role',
        role: account.role,
        scopes: account.adminScopes,
        onRoster: false,
      })
    })

    return rows
  }, [bootstrap])

  const openGrant = (seed: GrantForm) => {
    setGrant(seed)
    setGrantErrors([])
    setGrantOpen(true)
  }

  const submitGrant = async () => {
    setGrantErrors([])
    setGranting(true)
    try {
      await callPortal('admin.grantRole', sessionToken, {
        email: grant.email.trim().toLowerCase(),
        role: grant.role,
        scopes: grant.role === 'member' ? [] : grant.scopes,
        title: grant.title.trim(),
      })
      setGrantOpen(false)
      await refreshAudit()
      announce(`${grant.email.trim().toLowerCase()} is now ${ROLE_LABEL[grant.role].toLowerCase()}.`)
    } catch (error) {
      // A refused write carries the same sentence in `errors` and `blockers`, so the
      // two lists are merged through a Set — the summary must never say the same
      // thing twice, least of all under a heading that counts the entries.
      const failure = error as { message?: string; errors?: string[]; blockers?: string[] }
      const list = Array.from(new Set([...(failure.errors || []), ...(failure.blockers || [])]))
      const shown = list.length > 0 ? list : [failure.message || 'That role change did not save.']
      setGrantErrors(shown)
      announceUrgent(shown[0])
    } finally {
      setGranting(false)
    }
  }

  const exportRoster = async () => {
    setExporting(true)
    try {
      const data = await callPortal<PortalExportData>('admin.export', sessionToken, { kind: 'roster' })
      const url = URL.createObjectURL(new Blob([data.csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = data.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      await refreshAudit()
      announce(`Roster exported as ${data.filename}.`)
    } catch (error) {
      announceUrgent(error instanceof Error ? error.message : 'That export did not run.')
    } finally {
      setExporting(false)
    }
  }

  const officerColumns: DataTableColumn<OfficerRow>[] = [
    { id: 'name', header: 'Name', isRowHeader: true, sortValue: (row) => row.name, cell: (row) => row.name },
    { id: 'email', header: 'Email', sortValue: (row) => row.email, cell: (row) => row.email },
    { id: 'title', header: 'Title', sortValue: (row) => row.title, cell: (row) => row.title },
    {
      id: 'role',
      header: 'Role',
      sortValue: (row) => row.role,
      cell: (row) => (
        <StatusPill
          label={ROLE_LABEL[row.role]}
          tone={row.role === 'super-admin' ? 'accent' : 'info'}
        />
      ),
    },
    {
      id: 'scopes',
      header: 'Can reach',
      cell: (row) => row.scopes.map((scope) => SCOPE_LABEL[scope]).join(', ') || 'Nothing yet',
    },
    {
      id: 'source',
      header: 'Where from',
      sortValue: (row) => (row.onRoster ? 'a' : 'b'),
      cell: (row) => (row.onRoster
        ? <span className="p-meta">Shipped roster</span>
        : <StatusPill label="Granted here" tone="warn" detail="not in the shipped roster" />),
    },
    {
      id: 'account',
      header: 'Portal account',
      sortValue: (row) => (accountEmails.has(row.email) ? 'a' : 'b'),
      cell: (row) => (accountEmails.has(row.email)
        ? <StatusPill label="Has signed in" tone="success" />
        : <StatusPill label="Not yet" tone="neutral" detail="a role cannot be granted until they sign in once" />),
    },
  ]

  const auditColumns: DataTableColumn<AuditEntry>[] = [
    {
      id: 'at',
      header: 'When (Eastern)',
      isRowHeader: true,
      sortValue: (row) => row.at,
      cell: (row) => <time dateTime={row.at}>{formatStamp(row.at)}</time>,
    },
    { id: 'actor', header: 'Who', sortValue: (row) => row.actorEmail, cell: (row) => row.actorEmail },
    { id: 'action', header: 'Action', sortValue: (row) => row.action, cell: (row) => <code className="console-code">{row.action}</code> },
    { id: 'summary', header: 'What happened', cell: (row) => row.summary },
  ]

  if (loading) {
    return (
      <PortalPage title="Console" lede="Admin accounts, the audit trail, and the full data export.">
        <div className="p-panel" aria-busy="true">
          <p className="p-visually-hidden" role="status">Loading the console.</p>
          <div className="p-skeleton" style={{ height: 18, maxWidth: 220 }} aria-hidden="true" />
          <div className="p-skeleton" style={{ height: 160 }} aria-hidden="true" />
        </div>
      </PortalPage>
    )
  }

  if (loadError || !bootstrap) {
    return (
      <PortalPage title="Console" lede="Admin accounts, the audit trail, and the full data export.">
        <section className="p-panel" aria-labelledby="console-error">
          <PanelHead id="console-error" title="The console did not load" />
          <p>{loadError || 'The console did not load.'}</p>
          <div className="p-btnrow">
            <button
              type="button"
              className="p-btn p-btn--primary"
              onClick={() => { setLoading(true); void load({ cancelled: false }) }}
            >
              Try again
            </button>
          </div>
        </section>
      </PortalPage>
    )
  }

  const readiness = bootstrap.admin.launchReadiness
  const backend = bootstrap.admin.backendStatus

  return (
    <PortalPage title="Console" lede="Admin accounts, the audit trail, and the full data export.">
      <section className="p-panel" aria-labelledby="console-officers-heading">
        <PanelHead
          id="console-officers-heading"
          title="Officers and roles"
          description="The roster the portal ships with, plus anyone granted a role here. Where they disagree, the stored account wins — that is what the server enforces."
          meta={[`${officerRows.length} officers`]}
          actions={(
            <button type="button" className="p-btn" onClick={() => openGrant(emptyGrant)}>
              Grant a role
            </button>
          )}
        />
        <DataTable
          caption="Every officer account, the scopes it reaches, and whether that person has signed into the portal yet."
          columns={officerColumns}
          rows={officerRows}
          rowKey={(row) => row.email}
          defaultSort={{ columnId: 'role', direction: 'ascending' }}
          rowActions={(row) => (row.email === selfEmail ? (
            <span className="p-meta">Ask the other co-president</span>
          ) : (
            <button type="button" className="p-btn p-btn--sm" onClick={() => openGrant(grantFor(row))}>
              Change role
              <span className="p-visually-hidden">{` for ${row.name}`}</span>
            </button>
          ))}
        />
        <p className="p-meta">
          A role can only be granted to an email that has signed in at least once — the account has
          to exist before there is anything to write to.
        </p>
      </section>

      <section className="p-panel" aria-labelledby="console-audit-heading">
        <PanelHead
          id="console-audit-heading"
          title="Audit log"
          description="Every mutating action, newest first, written inside the same transaction as the change it describes."
          meta={[`${entries.length} of the last ${AUDIT_LIMIT}`]}
          updatedAt={entries[0]?.at}
        />
        <DataTable
          caption={`The ${AUDIT_LIMIT} most recent portal writes, newest first.`}
          columns={auditColumns}
          rows={entries}
          rowKey={(row) => row.id}
          manualSort
          empty={(
            <EmptyState
              title="Nothing has been changed yet."
              body="The first admit, edit or publish lands here the moment it happens — and it can never diverge from the change itself."
              align="left"
            />
          )}
        />
      </section>

      <section className="p-panel" aria-labelledby="console-health-heading">
        <PanelHead
          id="console-health-heading"
          title="Backend and launch readiness"
          description="Where the portal is reading from right now, and what is still in the way."
          updatedAt={backend.updatedAt}
        />
        <div className="console-backend">
          <StatusPill
            label={backend.source === 'vercel' ? 'Vercel Blob' : backend.source === 'sheets' ? 'Google Sheets' : 'Local preview'}
            tone={backend.source === 'vercel' ? 'success' : 'info'}
          />
          <p>{backend.message}</p>
        </div>
        <ul className="console-checks">
          {readiness.checks.map((check) => (
            <li key={check.id} className="console-check">
              <StatusPill label={READINESS_LABEL[check.status]} tone={READINESS_TONE[check.status]} />
              <span className="console-check__label">{check.label}</span>
              <span className="p-meta">{check.detail}</span>
            </li>
          ))}
        </ul>
        <p className="p-meta">
          {'Overall: '}
          {READINESS_LABEL[readiness.overall]}
          {readiness.generatedAt ? ' · checked ' : ''}
          {readiness.generatedAt ? <time dateTime={readiness.generatedAt}>{formatStamp(readiness.generatedAt)}</time> : null}
        </p>
      </section>

      <section className="p-panel" aria-labelledby="console-export-heading">
        <PanelHead
          id="console-export-heading"
          title="Roster export"
          description="One CSV of the membership roster. It is logged in the audit trail above."
          actions={(
            <button type="button" className="p-btn p-btn--primary" onClick={() => void exportRoster()} disabled={exporting}>
              <IconDownload />
              {exporting ? 'Preparing…' : 'Export roster CSV'}
            </button>
          )}
        />
        <p>
          The file carries names, status, source, year, school, interests and attendance counts. It
          carries no access needs, no accommodation notes, no phone numbers and no officer notes —
          those never leave the portal, in any export.
        </p>
      </section>

      <PortalDialog
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="Grant a role"
        description="Writes the role and scopes straight onto the account, so it works even if Google sign-in does not."
        size="narrow"
        closeLabel="the grant role form"
        footer={(
          <>
            <button type="button" className="p-btn" onClick={() => setGrantOpen(false)}>Cancel</button>
            <button type="submit" form="console-grant-form" className="p-btn p-btn--primary" disabled={granting}>
              {granting ? 'Saving…' : 'Grant role'}
            </button>
          </>
        )}
      >
        <ErrorSummary errors={grantErrors} headingLevel={3} />
        <form
          className="console-grant"
          id="console-grant-form"
          noValidate
          onSubmit={(event) => { event.preventDefault(); void submitGrant() }}
        >
          <Field
            label="Email"
            type="email"
            required
            autoComplete="email"
            hint="They must have signed into the portal at least once."
            value={grant.email}
            onChange={(event) => setGrant({ ...grant, email: event.target.value })}
          />
          <SelectField
            label="Role"
            value={grant.role}
            onChange={(event) => setGrant({ ...grant, role: event.target.value as DashboardRole })}
            options={[
              { value: 'member', label: 'Member — the member portal only' },
              { value: 'exec', label: 'Exec — the sections you tick below' },
              { value: 'super-admin', label: 'Super admin — everything, including this console' },
            ]}
          />
          <FieldGroup
            legend="Sections they can reach"
            hint={grant.role === 'member'
              ? 'A member reaches no admin sections. These are cleared on save.'
              : 'Super admin satisfies every section regardless of what is ticked.'}
          >
            {ADMIN_SCOPES.map((scope) => (
              <Choice
                key={scope}
                type="checkbox"
                label={SCOPE_LABEL[scope]}
                checked={grant.scopes.includes(scope)}
                disabled={grant.role === 'member'}
                onChange={(event) => setGrant({
                  ...grant,
                  scopes: event.target.checked
                    ? [...grant.scopes, scope]
                    : grant.scopes.filter((value) => value !== scope),
                })}
              />
            ))}
          </FieldGroup>
          <Field
            label="Title"
            hint="Shown in the account menu. Leave blank to use the roster title."
            value={grant.title}
            onChange={(event) => setGrant({ ...grant, title: event.target.value })}
          />
        </form>
      </PortalDialog>
    </PortalPage>
  )
}
