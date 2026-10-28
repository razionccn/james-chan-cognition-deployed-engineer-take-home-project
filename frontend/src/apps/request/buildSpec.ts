import type { Draft, DraftField } from './types'

export const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 31)

const splitList = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean)

export function emptyField(partial: Partial<DraftField> = {}): DraftField {
  return { name: '', label: '', type: 'string', options: '', required: false, searchable: false, filterable: false, showInList: true, editable: false, ...partial }
}

export function emptyDraft(): Draft {
  return {
    name: '',
    purpose: '',
    users: '',
    category: '',
    entityName: '',
    entityDescription: '',
    dataSource: 'mock',
    dataSourceNotes: '',
    fields: [emptyField({ name: 'id', label: 'ID', type: 'string', required: true, searchable: true })],
    stateField: 'status',
    initialState: '',
    terminalStates: [],
    actions: [],
    roles: [
      { id: 'viewer', description: 'Read-only access', can: ['view'] },
    ],
    auditEnabled: true,
    requireReason: true,
    acceptance: '',
  }
}

/** Starter content per category so a non-engineer does not begin from a blank page. */
export function applyCategoryDefaults(d: Draft): Draft {
  if (d.category === 'review_queue') {
    const status = emptyField({ name: 'status', label: 'Status', type: 'enum', options: 'pending, approved, rejected', required: true, filterable: true })
    return {
      ...d,
      fields: d.fields.some((f) => f.name === 'status') ? d.fields : [...d.fields, status],
      stateField: 'status',
      initialState: 'pending',
      terminalStates: ['approved', 'rejected'],
      actions: d.actions.length
        ? d.actions
        : [
            { id: 'approve', label: 'Approve', from: ['pending'], to: 'approved', requiresReason: true },
            { id: 'reject', label: 'Reject', from: ['pending'], to: 'rejected', requiresReason: true },
          ],
      roles: d.roles.some((r) => r.id === 'reviewer') ? d.roles : [{ id: 'reviewer', description: 'Can review and decide', can: ['view', 'act'] }, ...d.roles],
    }
  }
  if (d.category === 'admin_panel' || d.category === 'crud') {
    const roleId = d.category === 'crud' ? 'editor' : 'admin'
    return {
      ...d,
      roles: d.roles.some((r) => r.id === roleId)
        ? d.roles
        : [{ id: roleId, description: d.category === 'crud' ? 'Can create and edit records' : 'Can change settings', can: d.category === 'crud' ? ['view', 'create', 'edit'] : ['view', 'edit'] }, ...d.roles],
    }
  }
  return d
}

export function stateOptions(d: Draft): string[] {
  const f = d.fields.find((x) => x.name === d.stateField)
  return f && f.type === 'enum' ? splitList(f.options) : []
}

/** Pure mapping Draft → spec_version 1 document. The backend validates it; nothing is generated here. */
export function buildSpec(d: Draft): Record<string, unknown> {
  const entityId = slug(d.entityName) || 'record'
  const appId = slug(d.name) || 'new_app'
  const fields = d.fields
    .filter((f) => f.name.trim())
    .map((f) => {
      const out: Record<string, unknown> = { name: slug(f.name), type: f.type }
      if (f.label.trim()) out.label = f.label.trim()
      if (f.required) out.required = true
      if (f.type === 'enum') out.options = splitList(f.options)
      if (f.searchable) out.searchable = true
      if (f.filterable) out.filterable = true
      return out
    })
  const fieldNames = fields.map((f) => f.name as string)
  const idField = fieldNames.includes('id') ? 'id' : fieldNames[0] ?? 'id'
  const listColumns = d.fields.filter((f) => f.name.trim() && f.showInList).map((f) => slug(f.name))
  const searchFields = d.fields.filter((f) => f.name.trim() && f.searchable).map((f) => slug(f.name))
  const filters = d.fields.filter((f) => f.name.trim() && f.filterable).map((f) => slug(f.name))
  const editable = d.fields.filter((f) => f.name.trim() && f.editable).map((f) => slug(f.name))
  const writerRoles = d.roles.filter((r) => r.can.some((p) => p !== 'view')).map((r) => r.id)
  const actorRoles = d.roles.filter((r) => r.can.includes('act') || r.can.includes('admin')).map((r) => r.id)

  const spec: Record<string, unknown> = {
    spec_version: 1,
    app: {
      id: appId,
      name: d.name.trim(),
      category: d.category || 'crud',
      purpose: d.purpose.trim(),
      users: splitList(d.users),
      data_policy: 'Synthetic data only in the prototype.',
    },
    roles: d.roles.map((r) => ({ id: slug(r.id), description: r.description, can: r.can })),
    entities: [
      {
        id: entityId,
        name: d.entityName.trim() || 'Record',
        id_field: idField,
        fields,
        ...(d.entityDescription.trim() ? { description: d.entityDescription.trim() } : {}),
      },
    ],
    views: {
      list: { entity: entityId, columns: listColumns, search_fields: searchFields, filters },
      detail: {
        entity: entityId,
        sections: [
          { title: 'Details', fields: fieldNames.filter((n) => n !== idField) },
          ...(d.auditEnabled ? [{ title: 'History', source: 'audit' }] : []),
        ],
      },
    },
    forms: editable.length
      ? [
          {
            id: `edit_${entityId}`,
            entity: entityId,
            label: `Update ${d.entityName.trim() || 'record'}`,
            mode: 'edit',
            fields: editable,
            roles: writerRoles,
            requires_reason: d.requireReason,
            confirm: true,
          },
        ]
      : [],
    audit: { enabled: d.auditEnabled },
    acceptance_criteria: splitList(d.acceptance).map((line, i) => ({ id: `AC-${i + 1}`, then: line })),
    seed_data: { source: d.dataSource, notes: d.dataSourceNotes.trim() || (d.dataSource === 'mock' ? 'Deterministic synthetic records.' : 'Existing API described above; prototype uses a synthetic copy.') },
  }
  if (d.category === 'review_queue' || d.actions.length) {
    spec.workflow = {
      entity: entityId,
      state_field: slug(d.stateField) || 'status',
      states: stateOptions(d),
      initial: d.initialState,
      terminal: d.terminalStates,
      actions: d.actions
        .filter((a) => a.id.trim())
        .map((a) => ({ id: slug(a.id), label: a.label.trim() || a.id, from: a.from, to: a.to, roles: actorRoles, requires_reason: a.requiresReason })),
    }
  }
  if ((spec.acceptance_criteria as unknown[]).length === 0) {
    spec.acceptance_criteria = [{ id: 'AC-1', then: `The ${d.entityName.trim() || 'record'} list loads with the configured columns, search and filters.` }]
  }
  return spec
}

export function devinPrompt(appId: string): string {
  return `Use the create-internal-tool skill to implement specs/${appId}.yaml. Reuse the shared template components, add one pytest per acceptance criterion, run the app and tests, and open a PR.`
}
