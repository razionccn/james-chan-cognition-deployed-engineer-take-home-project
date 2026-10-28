export type Environment = 'development' | 'staging' | 'production'
export type FlagAction = 'enable' | 'disable'

export interface FeatureFlag {
  id: string
  name: string
  description: string
  environment: Environment
  enabled: boolean
  updated_at: string
  updated_by: string
}

export interface FlagAuditEvent {
  id: number
  flag_id: string
  action: FlagAction
  previous_enabled: boolean
  new_enabled: boolean
  actor_id: string
  actor_name: string
  reason: string
  created_at: string
}

export interface FeatureFlagDetail extends FeatureFlag {
  editable: boolean
  audit_events: FlagAuditEvent[]
}

export interface FlagListResponse {
  items: FeatureFlag[]
  total: number
}

export interface FlagFilters {
  q: string
  environment: string
  enabled: string
}
