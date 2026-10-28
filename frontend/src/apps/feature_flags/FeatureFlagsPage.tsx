// Feature-flag list page: debounced search + environment/state filters, selected flag kept in `?flag=`.
import { useMemo, useState } from 'react'
import { useQuery } from '@/shared/api/useQuery'
import { useDebounced, useUrlParam } from '@/shared/hooks'
import { Button, DataTable, ErrorState, FilterBar, PageHeader, RefreshError, SearchInput, SelectFilter, type Column } from '@/shared/components'
import { formatDateTime } from '@/shared/format'
import { featureFlagsApi } from './api'
import { FlagDetailPanel } from './FlagDetailPanel'
import { EnvironmentPill, StatePill, environmentOptions, stateOptions } from './labels'
import type { FeatureFlag, FlagFilters } from './types'

const EMPTY: FlagFilters = { q: '', environment: '', enabled: '' }

export function FeatureFlagsPage() {
  const [selectedId, select] = useUrlParam('flag')
  const [filters, setFilters] = useState<FlagFilters>(EMPTY)
  const debouncedQ = useDebounced(filters.q, 250)

  const effective = useMemo<FlagFilters>(() => ({ ...filters, q: debouncedQ }), [filters.environment, filters.enabled, debouncedQ]) // eslint-disable-line react-hooks/exhaustive-deps
  const query = useQuery(() => featureFlagsApi.listFlags(effective), [effective])

  const rows = query.data?.items ?? []
  const hasFilters = Boolean(filters.q || filters.environment || filters.enabled)

  const columns: Column<FeatureFlag>[] = [
    {
      key: 'name',
      header: 'Flag',
      render: (r) => (
        <div>
          <div className="font-mono text-sm text-slate-900">{r.name}</div>
          <div className="font-mono text-xs text-slate-500">{r.id}</div>
        </div>
      ),
    },
    { key: 'description', header: 'Description', className: 'max-w-md whitespace-normal', render: (r) => <span className="text-slate-600">{r.description}</span> },
    { key: 'environment', header: 'Environment', render: (r) => <EnvironmentPill environment={r.environment} /> },
    { key: 'enabled', header: 'State', render: (r) => <StatePill enabled={r.enabled} /> },
    { key: 'updated', header: 'Last updated', render: (r) => <span className="text-slate-500">{formatDateTime(r.updated_at)}</span> },
    { key: 'updated_by', header: 'Updated by', render: (r) => r.updated_by },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Feature-Flag Admin Panel"
        description="Inspect feature flags per environment. Development and staging flags can be toggled by a reviewer persona; production is locked. Every change is audited."
        actions={
          <span className="text-sm text-slate-500">
            {query.data ? `${query.data.total} flag${query.data.total === 1 ? '' : 's'}${hasFilters ? ' match' : ''}` : ''}
          </span>
        }
      />

      <FilterBar>
        <SearchInput value={filters.q} onChange={(q) => setFilters((f) => ({ ...f, q }))} placeholder="Flag name or ID" />
        <SelectFilter label="Environment" value={filters.environment} onChange={(environment) => setFilters((f) => ({ ...f, environment }))} options={environmentOptions} allLabel="All environments" />
        <SelectFilter label="State" value={filters.enabled} onChange={(enabled) => setFilters((f) => ({ ...f, enabled }))} options={stateOptions} allLabel="Enabled or disabled" />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)}>
            Clear filters
          </Button>
        )}
      </FilterBar>

      {query.status === 'error' && query.data && <RefreshError message={query.error.message} onRetry={query.refetch} />}
      {query.status === 'error' && !query.data ? (
        <ErrorState message={query.error.message} onRetry={query.refetch} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => select(r.id)}
          selectedKey={selectedId}
          loading={query.status === 'loading'}
          emptyTitle={hasFilters ? 'No flags match these filters' : 'No feature flags'}
          emptyDescription={hasFilters ? 'Try a different name, environment or state.' : 'Seed the database with `python -m app.cli init-db --reset --seed`.'}
        />
      )}

      <FlagDetailPanel flagId={selectedId} onClose={() => select(null)} onChanged={query.refetch} />
    </div>
  )
}
