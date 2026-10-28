import { api } from '@/shared/api/client'
import type { SpecMeta, SpecValidationResult } from './types'

export const specApi = {
  meta: () => api.get<SpecMeta>('/api/specs/meta'),
  validate: (spec: Record<string, unknown>) => api.post<SpecValidationResult>('/api/specs/validate', { spec }),
}
