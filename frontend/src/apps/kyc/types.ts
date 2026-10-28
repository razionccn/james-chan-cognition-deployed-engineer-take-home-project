// Wire types for the KYC Review Queue; mirror backend/app/apps/kyc/schemas.py.

export type KycStatus = 'pending' | 'approved' | 'rejected' | 'escalated'
export type RiskLevel = 'low' | 'medium' | 'high'
export type ReviewAction = 'approve' | 'reject' | 'escalate'

export interface KycCaseSummary {
  id: string
  customer_name: string
  customer_email: string
  country: string
  account_type: 'individual' | 'business'
  risk_level: RiskLevel
  status: KycStatus
  submitted_at: string
  updated_at: string
  assigned_reviewer: string | null
}

export interface Finding {
  check: string
  result: 'pass' | 'warn' | 'fail'
  detail: string
}

export interface AuditEvent {
  id: number
  case_id: string
  action: ReviewAction
  previous_status: KycStatus
  new_status: KycStatus
  actor_id: string
  actor_name: string
  reason: string
  created_at: string
}

export interface KycCaseDetail extends KycCaseSummary {
  findings: Finding[]
  audit_events: AuditEvent[]
  allowed_actions: ReviewAction[]
}

export interface CaseListResponse {
  items: KycCaseSummary[]
  total: number
}

export interface CaseFilters {
  q: string
  status: string
  risk_level: string
}
