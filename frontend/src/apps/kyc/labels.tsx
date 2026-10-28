import { StatusBadge, type BadgeTone } from '@/shared/components'
import type { KycStatus, ReviewAction, RiskLevel } from './types'

const statusTone: Record<KycStatus, BadgeTone> = { pending: 'info', approved: 'success', rejected: 'danger', escalated: 'warning' }
const riskTone: Record<RiskLevel, BadgeTone> = { low: 'neutral', medium: 'warning', high: 'danger' }

export const statusLabel: Record<KycStatus, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', escalated: 'Escalated' }
export const riskLabel: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' }

export const actionMeta: Record<ReviewAction, { label: string; past: string; pastLabel: string; variant: 'primary' | 'danger' | 'warning'; description: string }> = {
  approve: { label: 'Approve', past: 'approved', pastLabel: 'Approved', variant: 'primary', description: 'Marks the customer as verified. This is final in the prototype.' },
  reject: { label: 'Reject', past: 'rejected', pastLabel: 'Rejected', variant: 'danger', description: 'Declines verification. This is final in the prototype.' },
  escalate: { label: 'Escalate', past: 'escalated', pastLabel: 'Escalated', variant: 'warning', description: 'Sends the case for senior review; it can still be approved or rejected.' },
}

export const reviewerNames: Record<string, string> = { 'ana.reviewer': 'Ana Okafor', 'ben.reviewer': 'Ben Castillo' }

export function StatusPill({ status }: { status: KycStatus }) {
  return <StatusBadge tone={statusTone[status]} label={statusLabel[status]} />
}

export function RiskPill({ risk }: { risk: RiskLevel }) {
  return <StatusBadge tone={riskTone[risk]} label={`${riskLabel[risk]} risk`} />
}

export function reviewerName(id: string | null) {
  return id ? reviewerNames[id] ?? id : 'Unassigned'
}
