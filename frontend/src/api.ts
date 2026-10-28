export type Environment = 'development' | 'staging' | 'production'

export interface FeatureFlag {
  id: string
  name: string
  description: string
  environment: Environment
  enabled: boolean
  updated_at: string
  updated_by: string
}

export interface AuditEvent {
  id: number
  flag_id: string
  action: 'enable' | 'disable'
  previous_enabled: boolean
  new_enabled: boolean
  actor_id: string
  actor_name: string
  reason: string
  created_at: string
}

export interface FeatureFlagDetail extends FeatureFlag {
  editable: boolean
  audit_events: AuditEvent[]
}

export interface Meta {
  environments: { id: Environment; editable: boolean }[]
  roles_that_can_toggle: string[]
}

export interface FlagFilters {
  q?: string
  environment?: Environment | ''
  enabled?: 'true' | 'false' | ''
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const BASE = '/api/feature_flags'

export interface Persona {
  id: string
  name: string
  role: 'reviewer' | 'viewer'
}

export const PERSONAS: Persona[] = [
  { id: 'alice.reviewer', name: 'Alice Nguyen', role: 'reviewer' },
  { id: 'bob.reviewer', name: 'Bob Okafor', role: 'reviewer' },
  { id: 'carol.viewer', name: 'Carol Díaz', role: 'viewer' },
  { id: '', name: 'No persona (anonymous viewer)', role: 'viewer' },
]

async function request<T>(path: string, personaId: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as Record<string, string>) }
  if (personaId) headers['X-Demo-User'] = personaId
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch (e) {
    throw new ApiError(0, 'network_error', `Could not reach the API (${(e as Error).message}).`)
  }
  if (!res.ok) {
    let code = 'http_error'
    let message = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body && typeof body.message === 'string') {
        code = body.code ?? code
        message = body.message
      }
    } catch {
      /* non-JSON error body: keep the status text */
    }
    throw new ApiError(res.status, code, message)
  }
  return (await res.json()) as T
}

export function getMeta(personaId: string) {
  return request<Meta>('/meta', personaId)
}

export function listFlags(filters: FlagFilters, personaId: string) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.environment) params.set('environment', filters.environment)
  if (filters.enabled) params.set('enabled', filters.enabled)
  const qs = params.toString()
  return request<{ items: FeatureFlag[]; total: number }>(`/flags${qs ? `?${qs}` : ''}`, personaId)
}

export function getFlag(flagId: string, personaId: string) {
  return request<FeatureFlagDetail>(`/flags/${encodeURIComponent(flagId)}`, personaId)
}

export function toggleFlag(flagId: string, enabled: boolean, reason: string, personaId: string) {
  return request<FeatureFlagDetail>(`/flags/${encodeURIComponent(flagId)}/toggle`, personaId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, reason }),
  })
}
