import { useState } from 'react'
import { ApiError } from '@/shared/api/client'
import { useQuery } from '@/shared/api/useQuery'
import {
  ConfirmDialog,
  DescriptionList,
  DetailPanel,
  ErrorState,
  LoadingState,
  Section,
  Toggle,
  useToast,
} from '@/shared/components'
import { formatDateTime } from '@/shared/format'
import { usePersona } from '@/shared/persona/PersonaContext'
import { featureFlagsApi } from './api'
import { EnvironmentPill, StatePill, environmentLabel } from './labels'

export function FlagDetailPanel({ flagId, onClose, onChanged }: { flagId: string | null; onClose: () => void; onChanged: () => void }) {
  const { current } = usePersona()
  const { notify } = useToast()
  const query = useQuery(() => (flagId ? featureFlagsApi.getFlag(flagId) : Promise.reject(new ApiError(0, 'none', 'No flag'))), [flagId])
  const [pendingValue, setPendingValue] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const flag = query.data
  const canToggle = current?.role === 'reviewer'
  const toggleAllowed = Boolean(flag?.editable && canToggle)

  async function confirm(reason: string) {
    if (!flagId || pendingValue === null) return
    setSubmitting(true)
    setActionError(null)
    try {
      const updated = await featureFlagsApi.toggleFlag(flagId, pendingValue, reason)
      notify('success', `${updated.name} (${environmentLabel[updated.environment]}) is now ${updated.enabled ? 'enabled' : 'disabled'}.`)
      setPendingValue(null)
      query.refetch()
      onChanged()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Unexpected error while updating the flag.')
      // The backend is the source of truth: reload so a stale panel shows the real state.
      query.refetch()
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  const footer = flag ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-slate-600">
        {!flag.editable ? (
          <span>
            <span className="font-medium text-amber-800">Production is locked.</span> Production flags cannot be changed from this panel; the backend rejects any attempt.
          </span>
        ) : !canToggle ? (
          <span>
            You are viewing as <span className="font-medium">{current?.name ?? 'a viewer'}</span> (read-only). Switch to a reviewer persona to change this flag.
          </span>
        ) : (
          <span>Toggling asks for confirmation and records an audit event.</span>
        )}
      </div>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
        {flag.enabled ? 'Enabled' : 'Disabled'}
        <Toggle checked={flag.enabled} onChange={(next) => setPendingValue(next)} label={`Toggle ${flag.name} in ${flag.environment}`} disabled={!toggleAllowed} busy={submitting} />
      </label>
    </div>
  ) : undefined

  return (
    <>
      <DetailPanel
        open={Boolean(flagId)}
        onClose={onClose}
        title={flag ? <span className="font-mono text-base">{flag.name}</span> : flagId ?? ''}
        subtitle={
          flag ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{flag.id}</span>
              <EnvironmentPill environment={flag.environment} />
              <StatePill enabled={flag.enabled} />
            </span>
          ) : undefined
        }
        footer={footer}
      >
        {query.status === 'loading' && !flag && <LoadingState label="Loading flag…" />}
        {query.status === 'error' && !flag && <ErrorState message={query.error.message} onRetry={query.refetch} />}
        {flag && (
          <>
            <DescriptionList
              items={[
                { label: 'Description', value: flag.description },
                { label: 'Environment', value: <EnvironmentPill environment={flag.environment} /> },
                { label: 'State', value: <StatePill enabled={flag.enabled} /> },
                { label: 'Editable here', value: flag.editable ? 'Yes' : 'No (locked environment)' },
                { label: 'Last updated', value: formatDateTime(flag.updated_at) },
                { label: 'Updated by', value: flag.updated_by },
              ]}
            />
            <Section title="Change history">
              {flag.audit_events.length === 0 ? (
                <p className="text-sm text-slate-500">No changes recorded for this flag yet.</p>
              ) : (
                <ol className="space-y-3">
                  {flag.audit_events.map((ev) => (
                    <li key={ev.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">
                          {ev.action === 'enable' ? 'Enabled' : 'Disabled'} by {ev.actor_name}
                        </span>
                        <span className="text-xs text-slate-500">{formatDateTime(ev.created_at)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {ev.previous_enabled ? 'Enabled' : 'Disabled'} → {ev.new_enabled ? 'Enabled' : 'Disabled'}
                      </div>
                      {ev.reason && <p className="mt-1 text-slate-700">{ev.reason}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </>
        )}
      </DetailPanel>

      <ConfirmDialog
        open={pendingValue !== null && Boolean(flag)}
        title={pendingValue ? `Enable ${flag?.name ?? 'flag'}?` : `Disable ${flag?.name ?? 'flag'}?`}
        description={
          flag ? (
            <span>
              This changes <span className="font-mono">{flag.name}</span> in <span className="font-medium">{environmentLabel[flag.environment]}</span> from{' '}
              <span className="font-medium">{flag.enabled ? 'enabled' : 'disabled'}</span> to{' '}
              <span className="font-medium">{pendingValue ? 'enabled' : 'disabled'}</span>. The change is recorded in the audit history.
            </span>
          ) : undefined
        }
        confirmLabel={pendingValue ? 'Enable flag' : 'Disable flag'}
        confirmVariant={pendingValue ? 'primary' : 'warning'}
        requireReason={false}
        reasonLabel="Reason (optional)"
        busy={submitting}
        error={actionError}
        onCancel={() => {
          setPendingValue(null)
          setActionError(null)
        }}
        onConfirm={confirm}
      />
    </>
  )
}
