import type { FeatureFlag } from '../api'
import { formatDateTime } from '../format'
import { EnvironmentBadge, StateBadge } from './Badges'

interface Props {
  flags: FeatureFlag[]
  selectedId: string | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onSelect: (id: string) => void
}

const COLUMNS = ['Flag', 'Description', 'Environment', 'State', 'Last updated', 'Updated by']

export function FlagsTable({ flags, selectedId, loading, error, onRetry, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading && (
            <tr data-testid="loading-state">
              <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 align-middle" />
                <span className="ml-2 align-middle">Loading flags…</span>
              </td>
            </tr>
          )}
          {!loading && error && (
            <tr data-testid="error-state">
              <td colSpan={COLUMNS.length} className="px-4 py-10 text-center">
                <p className="font-medium text-rose-700">Could not load flags</p>
                <p className="mt-1 text-sm text-rose-600">{error}</p>
                <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                  Retry
                </button>
              </td>
            </tr>
          )}
          {!loading && !error && flags.length === 0 && (
            <tr data-testid="empty-state">
              <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-slate-500">
                No flags match the current search and filters.
              </td>
            </tr>
          )}
          {!loading &&
            !error &&
            flags.map((f) => {
              const selected = f.id === selectedId
              return (
                <tr
                  key={f.id}
                  data-testid={`flag-row-${f.id}`}
                  onClick={() => onSelect(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(f.id)
                    }
                  }}
                  tabIndex={0}
                  aria-selected={selected}
                  className={`cursor-pointer outline-none transition hover:bg-indigo-50/60 focus-visible:bg-indigo-50 ${
                    selected ? 'bg-indigo-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{f.name}</div>
                    <div className="font-mono text-xs text-slate-500">{f.id}</div>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    <span className="line-clamp-2">{f.description}</span>
                  </td>
                  <td className="px-4 py-3">
                    <EnvironmentBadge environment={f.environment} />
                  </td>
                  <td className="px-4 py-3">
                    <StateBadge enabled={f.enabled} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600" title={f.updated_at}>
                    {formatDateTime(f.updated_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{f.updated_by}</td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}
