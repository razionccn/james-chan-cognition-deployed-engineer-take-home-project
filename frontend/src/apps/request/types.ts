export type Category = 'review_queue' | 'crud' | 'admin_panel'
export type FieldType = 'string' | 'text' | 'integer' | 'number' | 'boolean' | 'enum' | 'date' | 'datetime' | 'email' | 'json'
export type Permission = 'view' | 'act' | 'create' | 'edit' | 'delete' | 'admin'

export interface DraftField {
  name: string
  label: string
  type: FieldType
  options: string
  required: boolean
  searchable: boolean
  filterable: boolean
  showInList: boolean
  editable: boolean
}

export interface DraftAction {
  id: string
  label: string
  from: string[]
  to: string
  requiresReason: boolean
}

export interface DraftRole {
  id: string
  description: string
  can: Permission[]
}

export interface Draft {
  name: string
  purpose: string
  users: string
  category: Category | ''
  entityName: string
  entityDescription: string
  dataSource: 'mock' | 'existing_api'
  dataSourceNotes: string
  fields: DraftField[]
  stateField: string
  initialState: string
  terminalStates: string[]
  actions: DraftAction[]
  roles: DraftRole[]
  auditEnabled: boolean
  requireReason: boolean
  acceptance: string
}

export interface SpecError {
  path: string
  message: string
}

export interface SpecValidationResult {
  valid: boolean
  errors: SpecError[]
  warnings: string[]
  normalized: Record<string, unknown> | null
  yaml: string | null
}

export interface SpecMeta {
  spec_version: number
  categories: Array<{ id: Category; label: string; example: string }>
  field_types: FieldType[]
  permissions: Permission[]
  automation_note: string
}
