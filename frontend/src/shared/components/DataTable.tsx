import type { ReactNode } from 'react'
import { cx } from './cx'
import { EmptyState, LoadingState } from './States'

/** One column: `render` receives the whole row so cells can combine fields. */
export interface Column<Row> {
  key: string
  header: string
  render: (row: Row) => ReactNode
  className?: string
}

/**
 * Generic list table with loading/empty states, optional row click (keyboard accessible)
 * and a highlighted `selectedKey` row. Sorting and pagination are intentionally absent.
 */
export interface DataTableProps<Row> {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  onRowClick?: (row: Row) => void
  selectedKey?: string | null
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

/**
 * Reusable read-only data table: sticky header, clickable rows, selection
 * highlight, loading and empty states. Sorting/pagination intentionally left
 * out until an app needs them.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  loading,
  emptyTitle = 'No results',
  emptyDescription = 'Try adjusting your search or filters.',
}: DataTableProps<Row>) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cx('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500', c.className)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const key = rowKey(row)
              const selected = selectedKey === key
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cx(
                    onRowClick &&
                      'cursor-pointer hover:bg-blue-50/60 focus:outline-none focus-visible:bg-blue-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
                    selected && 'bg-blue-50',
                  )}
                  aria-selected={selected || undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cx('whitespace-nowrap px-4 py-3 text-slate-700', c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
        {loading && rows.length === 0 && <LoadingState />}
      </div>
      {loading && rows.length > 0 && (
        <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-blue-500" aria-hidden />
      )}
    </div>
  )
}
