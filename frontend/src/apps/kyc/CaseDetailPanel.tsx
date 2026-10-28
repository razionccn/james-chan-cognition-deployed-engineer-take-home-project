import { useEffect, useState } from 'react'
import { ApiError } from '@/shared/api/client'
import { useQuery } from '@/shared/api/useQuery'
import {
  AuditTimeline,
  Button,
  ConfirmDialog,
  DescriptionList,
  DetailPanel,
  ErrorState,
  LoadingState,
  RefreshError,
  Section,
  StatusBadge,
  useToast,
} from '@/shared/components'
import { usePersona } from '@/shared/persona/PersonaContext'
import { kycApi } from './api'
import { formatDateTime } from '@/shared/format'
import { RiskPill, StatusPill, actionMeta, reviewerName, statusLabel } from './labels'
import type { Finding, ReviewAction } from './types'

const findingTone: Record<Finding['result'], 'success' | 'warning' | 'danger'> = { pass: 'success', warn: 'warning', fail: 'danger' }
const findingLabel: Record<Finding['result'], string> = { pass: 'Pass', warn: 'Review', fail: 'Fail' }

export function CaseDetailPanel({ caseId, onClose, onChanged }: { caseId: string | null; onClose: () => void; onChanged: () => void }) {
  const { current } = usePersona()
  const { notify } = useToast()
  const query = useQuery(() => (caseId ? kycApi.getCase(caseId) : Promise.reject(new ApiError(0, 'none', 'No case'))), [caseId])
  // A pending action is bound to the record it was started on; it is cancelled if the selection
  // changes, and the request always targets `pending.caseId`, never the current prop.
  const [pending, setPending] = useState<{ caseId: string; action: ReviewAction } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Only data for the selected record counts; the query hook keeps the previous record's data
  // while the next one loads, which must never be shown as the current record.
  const detail = query.data && query.data.id === caseId ? query.data : undefined
  const canReview = current?.role === 'reviewer'
  const pendingAction = pending && pending.caseId === caseId ? pending.action : null

  useEffect(() => {
    if (pending && pending.caseId !== caseId && !submitting) {
      setPending(null)
      setActionError(null)
    }
  }, [caseId, pending, submitting])

  async function confirm(reason: string) {
    if (!pending) return
    const target = pending
    setSubmitting(true)
    setActionError(null)
    try {
      const updated = await kycApi.reviewCase(target.caseId, target.action, reason)
      notify('success', `${updated.id} ${actionMeta[target.action].past} — now ${statusLabel[updated.status]}.`)
      setPending(null)
      query.refetch()
      onChanged()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Unexpected error while submitting the review.')
      // The backend is the source of truth: reload the case and queue so a stale
      // panel (e.g. 409 because another reviewer acted first) shows the real state.
      query.refetch()
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  const footer =
    detail && detail.allowed_actions.length > 0 ? (
      canReview ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {detail.allowed_actions.map((a) => (
            <Button key={a} variant={actionMeta[a].variant} onClick={() => caseId && setPending({ caseId, action: a })}>
              {actionMeta[a].label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          You are viewing as <span className="font-medium">{current?.name ?? 'a viewer'}</span> (read-only). Switch to a reviewer persona to act on this case.
        </p>
      )
    ) : detail ? (
      <p className="text-sm text-slate-500">This case is {statusLabel[detail.status].toLowerCase()} — no further actions are available.</p>
    ) : null

  return (
    <>
      <DetailPanel
        open={caseId !== null}
        onClose={onClose}
        title={detail ? detail.customer_name : caseId ?? ''}
        subtitle={
          detail ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{detail.id}</span>
              <StatusPill status={detail.status} />
              <RiskPill risk={detail.risk_level} />
            </span>
          ) : (
            caseId
          )
        }
        footer={footer}
      >
        {query.status === 'loading' && !detail && <LoadingState label="Loading case…" />}
        {query.status === 'error' && !detail && <ErrorState message={query.error.message} onRetry={query.refetch} />}
        {query.status === 'error' && detail && <RefreshError message={query.error.message} onRetry={query.refetch} />}
        {detail && (
          <div className="space-y-6">
            <Section title="Customer summary">
              <DescriptionList
                items={[
                  { label: 'Email', value: detail.customer_email },
                  { label: 'Country', value: detail.country },
                  { label: 'Account type', value: detail.account_type === 'business' ? 'Business' : 'Individual' },
                  { label: 'Submitted', value: formatDateTime(detail.submitted_at) },
                  { label: 'Assigned reviewer', value: reviewerName(detail.assigned_reviewer) },
                  { label: 'Last updated', value: formatDateTime(detail.updated_at) },
                ]}
              />
            </Section>

            <Section title="Verification findings">
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {detail.findings.map((f) => (
                  <li key={f.check} className="flex items-start gap-3 px-4 py-3">
                    <StatusBadge tone={findingTone[f.result]} label={findingLabel[f.result]} className="mt-0.5 w-16 justify-center" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{f.check}</p>
                      <p className="text-sm text-slate-500">{f.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Review history">
              <AuditTimeline
                emptyText="No review actions yet."
                entries={detail.audit_events.map((e) => ({
                  id: e.id,
                  title: `${actionMeta[e.action].pastLabel} by ${e.actor_name}`,
                  at: e.created_at,
                  change: `${statusLabel[e.previous_status]} → ${statusLabel[e.new_status]}`,
                  reason: e.reason,
                }))}
              />
            </Section>
          </div>
        )}
      </DetailPanel>

      <ConfirmDialog
        open={pendingAction !== null && caseId !== null}
        title={pendingAction ? `${actionMeta[pendingAction].label} ${caseId}?` : ''}
        description={pendingAction ? actionMeta[pendingAction].description : undefined}
        confirmLabel={pendingAction ? actionMeta[pendingAction].label : 'Confirm'}
        confirmVariant={pendingAction ? actionMeta[pendingAction].variant : 'primary'}
        requireReason
        reasonLabel="Reason (recorded in the audit trail)"
        busy={submitting}
        error={actionError}
        onCancel={() => {
          setPending(null)
          setActionError(null)
        }}
        onConfirm={confirm}
      />
    </>
  )
}
