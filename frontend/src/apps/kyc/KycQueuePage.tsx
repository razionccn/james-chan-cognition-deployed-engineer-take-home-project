// KYC Review Queue list page: debounced search + filters, DataTable, selected case kept in `?case=`.
import { useMemo, useState } from 'react'
import { useQuery } from '@/shared/api/useQuery'
import { useDebounced, useUrlParam } from '@/shared/hooks'
import { Button, DataTable, ErrorState, FilterBar, PageHeader, SearchInput, SelectFilter, type Column } from '@/shared/components'
import { kycApi } from './api'
import { CaseDetailPanel } from './CaseDetailPanel'
import { formatDate, formatDateTime } from '@/shared/format'
import { RiskPill, StatusPill, reviewerName, riskLabel, statusLabel } from './labels'
import type { CaseFilters, KycCaseSummary } from './types'

const statusOptions = (Object.keys(statusLabel) as Array<keyof typeof statusLabel>).map((v) => ({ value: v, label: statusLabel[v] }))
const riskOptions = (Object.keys(riskLabel) as Array<keyof typeof riskLabel>).map((v) => ({ value: v, label: riskLabel[v] }))

export function KycQueuePage() {
  const [selectedId, select] = useUrlParam('case')
  const [filters, setFilters] = useState<CaseFilters>({ q: '', status: '', risk_level: '' })
  const debouncedQ = useDebounced(filters.q, 250)

  const effective = useMemo<CaseFilters>(() => ({ ...filters, q: debouncedQ }), [filters.status, filters.risk_level, debouncedQ]) // eslint-disable-line react-hooks/exhaustive-deps
  const query = useQuery(() => kycApi.listCases(effective), [effective])

  const rows = query.data?.items ?? []
  const hasFilters = Boolean(filters.q || filters.status || filters.risk_level)

  const columns: Column<KycCaseSummary>[] = [
    { key: 'id', header: 'Case ID', render: (r) => <span className="font-mono text-xs text-slate-600">{r.id}</span> },
    {
      key: 'customer',
      header: 'Customer',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-900">{r.customer_name}</div>
          <div className="text-xs text-slate-500">
            {r.country} · {r.account_type === 'business' ? 'Business' : 'Individual'}
          </div>
        </div>
      ),
    },
    { key: 'risk', header: 'Risk', render: (r) => <RiskPill risk={r.risk_level} /> },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
    { key: 'submitted', header: 'Submitted', render: (r) => formatDate(r.submitted_at) },
    { key: 'reviewer', header: 'Assigned reviewer', render: (r) => <span className={r.assigned_reviewer ? '' : 'text-slate-400'}>{reviewerName(r.assigned_reviewer)}</span> },
    { key: 'updated', header: 'Last updated', render: (r) => <span className="text-slate-500">{formatDateTime(r.updated_at)}</span> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="KYC Review Queue"
        description="Review customer identity-verification cases. Every decision requires a reason and is recorded in the audit trail."
        actions={
          <span className="text-sm text-slate-500">
            {query.data ? `${query.data.total} case${query.data.total === 1 ? '' : 's'}${hasFilters ? ' match' : ''}` : ''}
          </span>
        }
      />

      <FilterBar>
        <SearchInput value={filters.q} onChange={(q) => setFilters((f) => ({ ...f, q }))} placeholder="Customer name or case ID" />
        <SelectFilter label="Status" value={filters.status} onChange={(status) => setFilters((f) => ({ ...f, status }))} options={statusOptions} allLabel="All statuses" />
        <SelectFilter label="Risk level" value={filters.risk_level} onChange={(risk_level) => setFilters((f) => ({ ...f, risk_level }))} options={riskOptions} allLabel="All risk levels" />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ q: '', status: '', risk_level: '' })}>
            Clear filters
          </Button>
        )}
      </FilterBar>

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
          emptyTitle={hasFilters ? 'No cases match these filters' : 'No KYC cases'}
          emptyDescription={hasFilters ? 'Try a different search term, status or risk level.' : 'Seed the database with `python -m app.cli init-db --reset --seed`.'}
        />
      )}

      <CaseDetailPanel caseId={selectedId} onClose={() => select(null)} onChanged={query.refetch} />
    </div>
  )
}
