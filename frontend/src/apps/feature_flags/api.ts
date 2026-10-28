// Typed calls to /api/feature_flags; the only place this app touches the network.
import { api, buildQuery } from '@/shared/api/client'
import type { FeatureFlagDetail, FlagFilters, FlagListResponse } from './types'

const BASE = '/api/feature_flags'

export const featureFlagsApi = {
  listFlags: (filters: FlagFilters) =>
    api.get<FlagListResponse>(
      `${BASE}/flags${buildQuery({ q: filters.q || undefined, environment: filters.environment || undefined, enabled: filters.enabled || undefined })}`,
    ),
  getFlag: (flagId: string) => api.get<FeatureFlagDetail>(`${BASE}/flags/${encodeURIComponent(flagId)}`),
  toggleFlag: (flagId: string, enabled: boolean, reason: string) =>
    api.post<FeatureFlagDetail>(`${BASE}/flags/${encodeURIComponent(flagId)}/toggle`, { enabled, reason }),
}
