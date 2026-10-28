import { useState } from 'react'
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
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const detail = query.data
  const canReview = current?.role === 'reviewer'

  async function confirm(reason: string) {
    if (!caseId || !pendingAction) return
    setSubmitting(true)
    setActionError(null)
    try {
      const updated = await kycApi.reviewCase(caseId, pendingAction, reason)
      notify('success', `${updated.id} ${actionMeta[pendingAction].past} — now ${statusLabel[updated.status]}.`)
      setPendingAction(null)
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
            <Button key={a} variant={actionMeta[a].variant} onClick={() => setPendingAction(a)}>
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
        open={pendingAction !== null}
        title={pendingAction && detail ? `${actionMeta[pendingAction].label} ${detail.id}?` : ''}
        description={pendingAction ? actionMeta[pendingAction].description : undefined}
        confirmLabel={pendingAction ? actionMeta[pendingAction].label : 'Confirm'}
        confirmVariant={pendingAction ? actionMeta[pendingAction].variant : 'primary'}
        requireReason
        reasonLabel="Reason (recorded in the audit trail)"
        busy={submitting}
        error={actionError}
        onCancel={() => {
          setPendingAction(null)
          setActionError(null)
        }}
        onConfirm={confirm}
      />
    </>
  )
}
