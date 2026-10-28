// Typed calls to /api/kyc; the only place this app touches the network.
import { api, buildQuery } from '@/shared/api/client'
import type { CaseFilters, CaseListResponse, KycCaseDetail, ReviewAction } from './types'

const BASE = '/api/kyc'

export const kycApi = {
  listCases: (filters: CaseFilters) =>
    api.get<CaseListResponse>(`${BASE}/cases${buildQuery({ q: filters.q || undefined, status: filters.status || undefined, risk_level: filters.risk_level || undefined })}`),
  getCase: (caseId: string) => api.get<KycCaseDetail>(`${BASE}/cases/${encodeURIComponent(caseId)}`),
  reviewCase: (caseId: string, action: ReviewAction, reason: string) =>
    api.post<KycCaseDetail>(`${BASE}/cases/${encodeURIComponent(caseId)}/actions`, { action, reason }),
}
