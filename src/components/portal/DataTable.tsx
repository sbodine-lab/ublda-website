import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { usePortalAnnouncer } from './PortalAnnouncer'
import '../../styles/portal.css'

/**
 * A real `<table>` (spec §7.1) — `<caption>`, `<thead>`, `<th scope="col">`,
 * `<th scope="row">` on the identifying cell, and `aria-sort` on every sortable
 * header, whose control is a real `<button>`.
 *
 * The scroll container is `role="region" tabIndex={0}` with `aria-labelledby`
 * pointing at the caption, so a keyboard user can scroll a wide table.
 *
 * Below 768px the table becomes a stacked card list — never a squeezed grid
 * (spec §8.3). That transform is CSS (`display: block`), which strips native
 * table semantics in several browsers, so the roles are stated explicitly here
 * and survive the change. The card labels are `aria-hidden` duplicates of the
 * column headers; the real association still comes from `<thead>`.
 */
export type DataTableSortDirection = 'ascending' | 'descending'
export type DataTableSort = { columnId: string; direction: DataTableSortDirection }

export type DataTableColumn<Row> = {
  id: string
  /** Column header text. Also used as the card label under 768px. */
  header: string
  cell: (row: Row) => ReactNode
  /** Supplying this makes the column sortable. Return a comparable primitive. */
  sortValue?: (row: Row) => string | number
  /** The identifying column, rendered `<th scope="row">`. Mark exactly one. */
  isRowHeader?: boolean
  /** `end` right-aligns and switches the cell to tabular figures. */
  align?: 'start' | 'end'
  /** Drop this column from the card list. Use for values the card title says. */
  cardHidden?: boolean
  /** CSS width for the column, e.g. '12rem'. */
  width?: string
}

export type DataTableSelection<Row> = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /** Names the row's checkbox. Say what is being selected: "Tommy Hartnett". */
  rowLabel: (row: Row) => string
  /** Names the select-all checkbox: "Select all unprocessed signups". */
  selectAllLabel: string
}

export type DataTableProps<Row> = {
  /** Describes the table. Always rendered — it is the region's name too. */
  caption: string
  columns: DataTableColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  /** Controlled sort. Omit to let the table own it. */
  sort?: DataTableSort | null
  onSortChange?: (sort: DataTableSort) => void
  defaultSort?: DataTableSort | null
  /** The caller already sorted `rows`; do not sort again. */
  manualSort?: boolean
  selection?: DataTableSelection<Row>
  /** Rendered in place of the rows. Hand-written, in the club's voice. */
  empty?: ReactNode
  /** Row-level controls. Every name must state its target. */
  rowActions?: (row: Row) => ReactNode
  /** Header for the actions column. Defaults to a visually hidden "Actions". */
  rowActionsHeader?: string
  /** Announce "Sorted by Name, ascending. 24 rows." on user sort. Default on. */
  announceSort?: boolean
  className?: string
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'en-US', { numeric: true, sensitivity: 'base' })
}

const SORT_GLYPH: Record<DataTableSortDirection | 'none', string> = {
  ascending: '↑',
  descending: '↓',
  none: '↕',
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  defaultSort = null,
  manualSort = false,
  selection,
  empty,
  rowActions,
  rowActionsHeader,
  announceSort = true,
  className,
}: DataTableProps<Row>) {
  const baseId = useId()
  const captionId = `${baseId}-caption`
  const { announce } = usePortalAnnouncer()
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(defaultSort)
  const activeSort = sort === undefined ? internalSort : sort

  const sortedRows = useMemo(() => {
    if (manualSort || !activeSort) return rows
    const column = columns.find((candidate) => candidate.id === activeSort.columnId)
    if (!column?.sortValue) return rows
    const read = column.sortValue
    const factor = activeSort.direction === 'descending' ? -1 : 1
    return [...rows].sort((a, b) => compareValues(read(a), read(b)) * factor)
  }, [rows, columns, activeSort, manualSort])

  const columnCount = columns.length + (selection ? 1 : 0) + (rowActions ? 1 : 0)
  const selectedIds = selection?.selectedIds ?? []
  const allKeys = sortedRows.map(rowKey)
  const allSelected = allKeys.length > 0 && allKeys.every((key) => selectedIds.includes(key))
  const someSelected = allKeys.some((key) => selectedIds.includes(key))

  const toggleSort = (column: DataTableColumn<Row>) => {
    const isActive = activeSort?.columnId === column.id
    const direction: DataTableSortDirection =
      isActive && activeSort?.direction === 'ascending' ? 'descending' : 'ascending'
    const next: DataTableSort = { columnId: column.id, direction }
    if (sort === undefined) setInternalSort(next)
    onSortChange?.(next)
    if (announceSort) {
      announce(`Sorted by ${column.header}, ${direction}. ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}.`)
    }
  }

  const toggleRow = (key: string, checked: boolean) => {
    if (!selection) return
    const next = checked
      ? [...selection.selectedIds, key].filter((value, index, list) => list.indexOf(value) === index)
      : selection.selectedIds.filter((value) => value !== key)
    selection.onChange(next)
  }

  const toggleAll = (checked: boolean) => {
    if (!selection) return
    if (checked) {
      const merged = [...selection.selectedIds, ...allKeys]
      selection.onChange(merged.filter((value, index, list) => list.indexOf(value) === index))
    } else {
      selection.onChange(selection.selectedIds.filter((value) => !allKeys.includes(value)))
    }
  }

  return (
    <div
      className={className ? `p-table-region ${className}` : 'p-table-region'}
      role="region"
      tabIndex={0}
      aria-labelledby={captionId}
    >
      <table className="p-table" role="table">
        <caption className="p-table__caption" id={captionId}>{caption}</caption>
        <thead role="rowgroup">
          <tr role="row">
            {selection ? (
              <th scope="col" role="columnheader" className="p-table__select">
                <input
                  type="checkbox"
                  aria-label={selection.selectAllLabel}
                  checked={allSelected}
                  ref={(node) => { if (node) node.indeterminate = !allSelected && someSelected }}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </th>
            ) : null}
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue)
              const isActive = activeSort?.columnId === column.id
              const direction = isActive && activeSort ? activeSort.direction : 'none'
              return (
                <th
                  key={column.id}
                  scope="col"
                  role="columnheader"
                  style={column.width ? { width: column.width } : undefined}
                  data-align={column.align === 'end' ? 'end' : undefined}
                  aria-sort={sortable ? direction : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="p-table__sort"
                      data-active={isActive ? 'true' : undefined}
                      onClick={() => toggleSort(column)}
                    >
                      {column.header}
                      <span className="p-table__sortglyph" aria-hidden="true">{SORT_GLYPH[direction]}</span>
                    </button>
                  ) : (
                    <span className="p-table__label">{column.header}</span>
                  )}
                </th>
              )
            })}
            {rowActions ? (
              <th scope="col" role="columnheader">
                {rowActionsHeader
                  ? <span className="p-table__label">{rowActionsHeader}</span>
                  : <span className="p-visually-hidden">Actions</span>}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {sortedRows.length === 0 ? (
            <tr role="row">
              <td role="cell" colSpan={columnCount} className="p-table__empty">{empty}</td>
            </tr>
          ) : (
            sortedRows.map((row) => {
              const key = rowKey(row)
              return (
                <tr key={key} role="row">
                  {selection ? (
                    <td role="cell" className="p-table__select">
                      <input
                        type="checkbox"
                        aria-label={selection.rowLabel(row)}
                        checked={selectedIds.includes(key)}
                        onChange={(event) => toggleRow(key, event.target.checked)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) =>
                    column.isRowHeader ? (
                      <th key={column.id} scope="row" role="rowheader">
                        {column.cell(row)}
                      </th>
                    ) : (
                      <td
                        key={column.id}
                        role="cell"
                        data-align={column.align === 'end' ? 'end' : undefined}
                        data-card-hidden={column.cardHidden ? 'true' : undefined}
                      >
                        <span className="p-table__cardlabel" aria-hidden="true">{column.header}</span>
                        <span>{column.cell(row)}</span>
                      </td>
                    ),
                  )}
                  {rowActions ? (
                    <td role="cell">
                      <div className="p-table__actions">{rowActions(row)}</div>
                    </td>
                  ) : null}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
