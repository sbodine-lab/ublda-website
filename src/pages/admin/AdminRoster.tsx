import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PortalPage } from '../../components/portal/PortalShell'
import PanelHead from '../../components/portal/PanelHead'
import EmptyState from '../../components/portal/EmptyState'
import StatCard from '../../components/portal/StatCard'
import StatusPill from '../../components/portal/StatusPill'
import DataTable from '../../components/portal/DataTable'
import type { DataTableColumn } from '../../components/portal/DataTable'
import ErrorSummary from '../../components/portal/ErrorSummary'
import { SelectField, Field } from '../../components/portal/Field'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import { MemberDrawer, formatDay, memberStatusTone } from '../../components/portal/MemberDrawer'
import type { MemberAdminPatch } from '../../components/portal/MemberDrawer'
import { IconDownload } from '../../components/portal/Icons'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { callPortal } from '../../lib/portalClient'
import type { AdminBootstrap, PortalBootstrap, PortalExportData, UnprocessedIntakeRow } from '../../lib/portalClient'
import { isAdminBootstrap } from '../../lib/portalClient'
import {
  MEMBER_INTERESTS,
  MEMBER_SCHOOLS,
  MEMBER_SOURCES,
  MEMBER_STATUSES,
  MEMBER_YEARS,
  memberDisplayName,
} from '../../lib/portalMembers'
import type {
  MemberAdminRow,
  MemberInterest,
  MemberSchool,
  MemberSource,
  MemberStatus,
  MemberYear,
} from '../../lib/portalMembers'
import './AdminRoster.css'

/**
 * `/dashboard/roster` (spec §6 T1).
 *
 * Two panels, in this order and no other: the unprocessed-intake queue, then the
 * roster itself. Intake is pinned to the top because it is the reason this screen
 * gets opened the week of September 2 — a Festifall QR scan creates an `accounts`
 * row and nothing else, and until someone admits it the person is invisible to the
 * club.
 *
 * The club has roughly one member today, so the empty states are the product. They
 * are written by hand, in the club's voice, and no row on this screen is invented.
 */

const STATUS_LABEL: Record<MemberStatus, string> = {
  prospect: 'Prospect',
  active: 'Active',
  inactive: 'Inactive',
  alumni: 'Alumni',
}

const SOURCE_LABEL: Record<MemberSource, string> = {
  'self-signup': 'Signed up',
  festifall: 'Festifall',
  'interest-form': 'Interest form',
  referral: 'Referral',
  recruiting: 'Recruiting',
  manual: 'Added by an officer',
}

const ANNOUNCE_DEBOUNCE_MS = 500
const RECENT_ATTENDANCE_DAYS = 30

/** The BBA Council recognition line the club is measured against. */
const ROSS_SHARE_FLOOR = 2 / 3

const members1 = (count: number) => (count === 1 ? 'member' : 'members')

const intakeName = (row: UnprocessedIntakeRow) => (
  `${row.firstName} ${row.lastName}`.trim() || row.uniqname || row.email
)

const attendedWithin = (iso: string, days: number, now: number) => {
  if (!iso) return false
  const stamp = Date.parse(iso)
  return !Number.isNaN(stamp) && now - stamp <= days * 24 * 60 * 60 * 1000
}

const matchesSearch = (member: MemberAdminRow, term: string) => {
  if (!term) return true
  const haystack = [
    member.firstName, member.lastName, member.preferredName, member.uniqname, member.email,
  ].join(' ').toLowerCase()
  return haystack.includes(term)
}

export default function AdminRoster() {
  const { sessionToken, isSuperAdmin } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selectedIntake, setSelectedIntake] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<MemberStatus>('active')
  const [bulkSource, setBulkSource] = useState<MemberSource>('festifall')
  const [bulkYear, setBulkYear] = useState<MemberYear>('')
  const [bulkSchool, setBulkSchool] = useState<MemberSchool>('')
  const [bulkErrors, setBulkErrors] = useState<string[]>([])
  const [admitting, setAdmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [interestFilter, setInterestFilter] = useState('')

  // Two pieces of state, not one: closing must not unmount the dialog, or the
  // native <dialog> never runs close() and focus never returns to the row button.
  const [openEmail, setOpenEmail] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [savingMember, setSavingMember] = useState(false)
  const [memberErrors, setMemberErrors] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async (signal: { cancelled: boolean }) => {
    try {
      const data = await callPortal<PortalBootstrap>('portal.bootstrap', sessionToken)
      if (signal.cancelled) return
      if (!isAdminBootstrap(data)) {
        setLoadError('This account is not an officer account.')
        setBootstrap(null)
        return
      }
      setBootstrap(data)
      setLoadError('')
    } catch (error) {
      if (signal.cancelled) return
      setLoadError(error instanceof Error ? error.message : 'The roster did not load.')
    } finally {
      if (!signal.cancelled) setLoading(false)
    }
  }, [sessionToken])

  // React 19 StrictMode double-invokes effects; the flag keeps the second pass
  // from writing state after the first one has already been torn down.
  useEffect(() => {
    const signal = { cancelled: false }
    setLoading(true)
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load])

  const refresh = useCallback(async () => {
    const signal = { cancelled: false }
    await load(signal)
  }, [load])

  const members = useMemo(() => bootstrap?.admin.members || [], [bootstrap])
  const intake = useMemo(() => bootstrap?.admin.unprocessedIntake || [], [bootstrap])
  const events = useMemo(() => bootstrap?.admin.events || [], [bootstrap])
  const rsvps = useMemo(() => bootstrap?.admin.rsvps || [], [bootstrap])

  const counts = useMemo(() => {
    const now = Date.now()
    return {
      active: members.filter((member) => member.status === 'active').length,
      prospect: members.filter((member) => member.status === 'prospect').length,
      inactive: members.filter((member) => member.status === 'inactive').length,
      alumni: members.filter((member) => member.status === 'alumni').length,
      ross: members.filter((member) => member.school === 'Ross').length,
      recent: members.filter((member) => attendedWithin(member.lastAttendedAt, RECENT_ATTENDANCE_DAYS, now)).length,
    }
  }, [members])

  const rossFloor = Math.ceil(members.length * ROSS_SHARE_FLOOR)
  const rossShort = members.length > 0 && counts.ross < rossFloor

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return members.filter((member) => (
      matchesSearch(member, term)
      && (!statusFilter || member.status === statusFilter)
      && (!yearFilter || member.year === yearFilter)
      && (!schoolFilter || member.school === schoolFilter)
      && (!interestFilter || member.interests.includes(interestFilter as MemberInterest))
    ))
  }, [members, search, statusFilter, yearFilter, schoolFilter, interestFilter])

  /**
   * Filter results announce politely, debounced past the typing rate — a live
   * region that fires on every keystroke is unusable with a screen reader on.
   */
  const filterSignature = `${search}|${statusFilter}|${yearFilter}|${schoolFilter}|${interestFilter}`
  const lastSignature = useRef(filterSignature)
  useEffect(() => {
    if (lastSignature.current === filterSignature) return
    const timer = window.setTimeout(() => {
      lastSignature.current = filterSignature
      announce(`${filtered.length} of ${members.length} ${members.length === 1 ? 'member' : 'members'} match.`)
    }, ANNOUNCE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [announce, filterSignature, filtered.length, members.length])

  const openMember = useMemo(
    () => members.find((member) => member.email === openEmail) || null,
    [members, openEmail],
  )

  const admit = async () => {
    setBulkErrors([])
    setAdmitting(true)
    try {
      await callPortal('admin.member.bulkAdmit', sessionToken, {
        emails: selectedIntake,
        status: bulkStatus,
        source: bulkSource,
        year: bulkYear,
        school: bulkSchool,
      })
      const count = selectedIntake.length
      setSelectedIntake([])
      await refresh()
      announce(`Admitted ${count} ${count === 1 ? 'person' : 'people'} as ${STATUS_LABEL[bulkStatus].toLowerCase()}.`)
    } catch (error) {
      const failure = error as { message?: string; errors?: string[] }
      const list = failure.errors && failure.errors.length > 0
        ? failure.errors
        : [failure.message || 'That intake batch did not save.']
      setBulkErrors(list)
      announceUrgent(list[0])
    } finally {
      setAdmitting(false)
    }
  }

  const saveMember = async (patch: MemberAdminPatch) => {
    setMemberErrors([])
    setSavingMember(true)
    try {
      await callPortal('admin.member.upsert', sessionToken, { ...patch })
      await refresh()
      announce(`Saved ${patch.firstName} ${patch.lastName}.`.replace(/\s+/g, ' ').trim())
    } catch (error) {
      const failure = error as { message?: string; errors?: string[] }
      const list = failure.errors && failure.errors.length > 0
        ? failure.errors
        : [failure.message || 'That member did not save.']
      setMemberErrors(list)
      announceUrgent(list[0])
    } finally {
      setSavingMember(false)
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
      announce(`Roster exported as ${data.filename}. It carries no access needs, no phone numbers and no officer notes.`)
    } catch (error) {
      announceUrgent(error instanceof Error ? error.message : 'That export did not run.')
    } finally {
      setExporting(false)
    }
  }

  const intakeColumns: DataTableColumn<UnprocessedIntakeRow>[] = [
    { id: 'name', header: 'Name', isRowHeader: true, cell: (row) => intakeName(row), sortValue: (row) => intakeName(row) },
    { id: 'email', header: 'Email', cell: (row) => row.email, sortValue: (row) => row.email },
    { id: 'uniqname', header: 'Uniqname', cell: (row) => row.uniqname || '—' },
    {
      id: 'createdAt',
      header: 'Signed up',
      sortValue: (row) => row.createdAt,
      cell: (row) => (row.createdAt
        ? <time dateTime={row.createdAt}>{formatDay(row.createdAt)}</time>
        : '—'),
    },
  ]

  const memberColumns: DataTableColumn<MemberAdminRow>[] = [
    {
      id: 'name',
      header: 'Name',
      isRowHeader: true,
      sortValue: (row) => `${row.lastName} ${row.firstName}`.trim() || row.email,
      cell: (row) => memberDisplayName(row),
    },
    { id: 'email', header: 'Email', cell: (row) => row.email, sortValue: (row) => row.email },
    { id: 'uniqname', header: 'Uniqname', cell: (row) => row.uniqname || '—' },
    {
      id: 'status',
      header: 'Status',
      sortValue: (row) => row.status,
      cell: (row) => <StatusPill label={STATUS_LABEL[row.status]} tone={memberStatusTone(row.status)} />,
    },
    { id: 'year', header: 'Year', sortValue: (row) => row.year, cell: (row) => row.year || '—' },
    { id: 'school', header: 'School', sortValue: (row) => row.school, cell: (row) => row.school || '—' },
    { id: 'source', header: 'Source', sortValue: (row) => row.source, cell: (row) => SOURCE_LABEL[row.source] },
    {
      id: 'joinedAt',
      header: 'Joined',
      sortValue: (row) => row.joinedAt,
      cell: (row) => (row.joinedAt ? <time dateTime={row.joinedAt}>{formatDay(row.joinedAt)}</time> : '—'),
    },
    {
      id: 'lastAttendedAt',
      header: 'Last attended',
      sortValue: (row) => row.lastAttendedAt,
      cell: (row) => (row.lastAttendedAt
        ? <time dateTime={row.lastAttendedAt}>{formatDay(row.lastAttendedAt)}</time>
        : '—'),
    },
    {
      id: 'attendanceCount',
      header: 'Events attended',
      align: 'end',
      sortValue: (row) => row.attendanceCount,
      cell: (row) => <span className="p-num">{row.attendanceCount}</span>,
    },
  ]

  if (loading) {
    return (
      <PortalPage title="Roster" lede="Everyone the club knows about, and everyone still waiting to be admitted.">
        <div className="p-panel" aria-busy="true">
          <p className="p-visually-hidden" role="status">Loading the roster.</p>
          <div className="p-skeleton" style={{ height: 18, maxWidth: 220 }} aria-hidden="true" />
          <div className="p-skeleton" style={{ height: 160 }} aria-hidden="true" />
        </div>
      </PortalPage>
    )
  }

  if (loadError || !bootstrap) {
    return (
      <PortalPage title="Roster" lede="Everyone the club knows about, and everyone still waiting to be admitted.">
        <section className="p-panel" aria-labelledby="roster-error">
          <PanelHead id="roster-error" title="The roster did not load" />
          <p>{loadError || 'The roster did not load.'}</p>
          <div className="p-btnrow">
            <button type="button" className="p-btn p-btn--primary" onClick={() => { setLoading(true); void refresh() }}>
              Try again
            </button>
          </div>
        </section>
      </PortalPage>
    )
  }

  const newestMemberUpdate = members
    .map((member) => member.updatedAt)
    .filter(Boolean)
    .sort()
    .pop() || ''

  return (
    <PortalPage
      title="Roster"
      lede="Everyone the club knows about, and everyone still waiting to be admitted."
      actions={isSuperAdmin ? (
        <button type="button" className="p-btn" onClick={() => void exportRoster()} disabled={exporting}>
          <IconDownload />
          {exporting ? 'Preparing…' : 'Export CSV'}
        </button>
      ) : undefined}
    >
      <section className="roster-stats" aria-labelledby="roster-stats-heading">
        <h2 className="p-visually-hidden" id="roster-stats-heading">Roster at a glance</h2>
        <div className="p-statgrid">
          <StatCard label="Active" value={counts.active} qualifier={members1(counts.active)} />
          <StatCard label="Prospects" value={counts.prospect} qualifier="waiting" />
          <StatCard label="Inactive" value={counts.inactive} qualifier={members1(counts.inactive)} />
          <StatCard label="Alumni" value={counts.alumni} qualifier={members1(counts.alumni)} />
          <StatCard
            label="From Ross"
            value={counts.ross}
            qualifier={members1(counts.ross)}
            tone={rossShort ? 'attention' : 'default'}
            hint={members.length === 0
              ? 'BBA Council recognition asks for two-thirds of the roster from Ross.'
              : `BBA Council recognition asks for two-thirds from Ross — that is ${rossFloor} of the ${members.length} on the roster today.`}
          />
          <StatCard
            label="Attended recently"
            value={counts.recent}
            qualifier={members1(counts.recent)}
            hint={`Checked in at an event in the last ${RECENT_ATTENDANCE_DAYS} days.`}
          />
        </div>
      </section>

      {/* Panel 1, pinned. The Festifall landing zone. */}
      <section className="p-panel" aria-labelledby="roster-intake-heading">
        <PanelHead
          id="roster-intake-heading"
          title="Unprocessed intake"
          description="Accounts that have signed in but are not on the roster yet. Admit them and they become members."
          meta={[`${intake.length} waiting`]}
          attention={intake.length > 0 ? `${intake.length} need a decision` : undefined}
        />

        <DataTable
          caption="People who created an account but have no roster record yet, oldest first."
          columns={intakeColumns}
          rows={intake}
          rowKey={(row) => row.email}
          defaultSort={{ columnId: 'createdAt', direction: 'ascending' }}
          selection={{
            selectedIds: selectedIntake,
            onChange: setSelectedIntake,
            rowLabel: (row) => `Admit ${intakeName(row)} (${row.email})`,
            selectAllLabel: 'Select every unprocessed signup',
          }}
          empty={(
            <EmptyState
              title="Nobody is waiting."
              body="Every account that has signed in is already on the roster. New signups land here the moment they arrive."
              align="left"
            />
          )}
        />

        {intake.length > 0 ? (
          <div className="roster-bulk">
            <ErrorSummary errors={bulkErrors} headingLevel={3} />
            <fieldset className="roster-bulk__fields">
              <legend className="p-legend">Admit the selected people as</legend>
              <div className="roster-bulk__grid">
                <SelectField
                  label="Status"
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value as MemberStatus)}
                  options={MEMBER_STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] }))}
                />
                <SelectField
                  label="Where they came from"
                  value={bulkSource}
                  onChange={(event) => setBulkSource(event.target.value as MemberSource)}
                  options={MEMBER_SOURCES.map((source) => ({ value: source, label: SOURCE_LABEL[source] }))}
                />
                <SelectField
                  label="Year"
                  hint="Leave unset when you do not know."
                  value={bulkYear}
                  onChange={(event) => setBulkYear(event.target.value as MemberYear)}
                  options={MEMBER_YEARS.map((year) => ({ value: year, label: year || 'Not set' }))}
                />
                <SelectField
                  label="School"
                  hint="Leave unset when you do not know."
                  value={bulkSchool}
                  onChange={(event) => setBulkSchool(event.target.value as MemberSchool)}
                  options={MEMBER_SCHOOLS.map((school) => ({ value: school, label: school || 'Not set' }))}
                />
              </div>
            </fieldset>
            <div className="roster-bulk__act">
              <button
                type="button"
                className="p-btn p-btn--primary"
                onClick={() => void admit()}
                disabled={selectedIntake.length === 0 || admitting}
              >
                {admitting
                  ? 'Admitting…'
                  : `Admit ${selectedIntake.length} ${selectedIntake.length === 1 ? 'person' : 'people'}`}
              </button>
              <p className="p-meta">
                {selectedIntake.length === 0
                  ? 'Tick someone in the table above to admit them.'
                  : 'You can change any of this afterwards from the member record.'}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {/* Panel 2. The roster itself. */}
      <section className="p-panel" aria-labelledby="roster-members-heading">
        <PanelHead
          id="roster-members-heading"
          title="Members"
          description="One row per person, with where they came from and the last event they attended."
          meta={[`${members.length} on the roster`, `${filtered.length} shown`, `${counts.ross} from Ross`]}
          updatedAt={newestMemberUpdate || undefined}
        />

        <div className="roster-filters">
          <Field
            label="Search"
            type="search"
            className="roster-filters__search"
            placeholder="Name or uniqname"
            hint="Matches name, preferred name, uniqname and email."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SelectField
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={[{ value: '', label: 'Any status' }, ...MEMBER_STATUSES.map((status) => ({
              value: status, label: STATUS_LABEL[status],
            }))]}
          />
          <SelectField
            label="Year"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            options={[{ value: '', label: 'Any year' }, ...MEMBER_YEARS.filter(Boolean).map((year) => ({
              value: year, label: year,
            }))]}
          />
          <SelectField
            label="School"
            value={schoolFilter}
            onChange={(event) => setSchoolFilter(event.target.value)}
            options={[{ value: '', label: 'Any school' }, ...MEMBER_SCHOOLS.filter(Boolean).map((school) => ({
              value: school, label: school,
            }))]}
          />
          <SelectField
            label="Interest"
            value={interestFilter}
            onChange={(event) => setInterestFilter(event.target.value)}
            options={[{ value: '', label: 'Any interest' }, ...MEMBER_INTERESTS.map((interest) => ({
              value: interest, label: interest,
            }))]}
          />
        </div>

        <DataTable
          caption={`The club roster. ${filtered.length} of ${members.length} shown.`}
          columns={memberColumns}
          rows={filtered}
          rowKey={(row) => row.email}
          defaultSort={{ columnId: 'name', direction: 'ascending' }}
          rowActions={(row) => (
            <button
              type="button"
              className="p-btn p-btn--sm"
              onClick={() => { setMemberErrors([]); setOpenEmail(row.email); setDrawerOpen(true) }}
            >
              Open
              <span className="p-visually-hidden">{` ${memberDisplayName(row)}`}</span>
            </button>
          )}
          empty={members.length === 0 ? (
            <EmptyState
              title="You're the first."
              body="Fall recruiting opens at Festifall on September 2 — this list fills fast. Anyone who signs in before then lands in intake above."
              align="left"
            />
          ) : (
            <EmptyState
              title="Nobody matches those filters."
              body="Clear a filter or search for a different name. Everyone on the roster is still here."
              align="left"
              action={(
                <button
                  type="button"
                  className="p-btn"
                  onClick={() => {
                    setSearch(''); setStatusFilter(''); setYearFilter(''); setSchoolFilter(''); setInterestFilter('')
                  }}
                >
                  Clear filters
                </button>
              )}
            />
          )}
        />
      </section>

      <MemberDrawer
        open={drawerOpen && Boolean(openMember)}
        member={openMember}
        events={events}
        rsvps={rsvps}
        onClose={() => { setDrawerOpen(false); setMemberErrors([]) }}
        onSave={saveMember}
        saving={savingMember}
        errors={memberErrors}
      />
    </PortalPage>
  )
}
