import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/shared/api/client'
import { useQuery } from '@/shared/api/useQuery'
import {
  Button,
  CheckboxGroup,
  ErrorState,
  LoadingState,
  PageHeader,
  SelectField,
  StatusBadge,
  TextArea,
  TextField,
  Toggle,
  useToast,
} from '@/shared/components'
import { specApi } from './api'
import { applyCategoryDefaults, buildSpec, devinPrompt, emptyDraft, emptyField, slug, stateOptions } from './buildSpec'
import type { Draft, DraftAction, DraftField, DraftRole, FieldType, Permission, SpecValidationResult } from './types'

const STEPS = ['App basics', 'Data', 'Workflows & access', 'Review & hand off'] as const
const STORAGE_KEY = 'console.appRequestDraft'

const fieldTypeOptions: Array<{ value: FieldType; label: string }> = [
  { value: 'string', label: 'Short text' },
  { value: 'text', label: 'Long text' },
  { value: 'integer', label: 'Whole number' },
  { value: 'number', label: 'Decimal number' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'enum', label: 'One of a fixed list' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'email', label: 'Email' },
  { value: 'json', label: 'Structured data (JSON)' },
]

const permissionOptions: Array<{ value: Permission; label: string; description: string }> = [
  { value: 'view', label: 'View', description: 'See records and history' },
  { value: 'act', label: 'Act', description: 'Run workflow actions (approve, reject…)' },
  { value: 'create', label: 'Create', description: 'Add new records' },
  { value: 'edit', label: 'Edit', description: 'Change editable fields' },
  { value: 'delete', label: 'Delete', description: 'Remove records' },
  { value: 'admin', label: 'Admin', description: 'Everything, incl. settings' },
]

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...emptyDraft(), ...(JSON.parse(raw) as Draft) } : emptyDraft()
  } catch {
    return emptyDraft()
  }
}

export function RequestAppPage() {
  const meta = useQuery(() => specApi.meta(), [])
  const { notify } = useToast()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [result, setResult] = useState<SpecValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [validateError, setValidateError] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  }, [draft])

  const spec = useMemo(() => buildSpec(draft), [draft])
  const appId = (spec.app as { id: string }).id
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const stepProblems = useMemo(() => localChecks(draft, step), [draft, step])

  async function validate() {
    setValidating(true)
    setValidateError(null)
    try {
      setResult(await specApi.validate(spec))
    } catch (e) {
      setValidateError(e instanceof ApiError ? e.message : 'Could not reach the validator.')
    } finally {
      setValidating(false)
    }
  }

  function next() {
    if (step === 3) return
    const target = step + 1
    setStep(target)
    if (target === 3) void validate()
  }

  function reset() {
    setDraft(emptyDraft())
    setResult(null)
    setStep(0)
  }

  if (meta.status === 'loading') return <LoadingState label="Loading…" />
  if (meta.status === 'error') return <ErrorState message={meta.error.message} onRetry={meta.refetch} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request a new internal app"
        description="Describe what you need in plain language. The result is a validated application specification that an engineer reviews and Devin implements — nothing is created or deployed automatically."
        actions={
          <Button variant="ghost" size="sm" onClick={reset}>
            Start over
          </Button>
        }
      />

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`rounded-full px-3 py-1 ${i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-slate-100 text-slate-500'}`}
              disabled={i > step}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        {step === 0 && (
          <StepBasics draft={draft} update={update} categories={meta.data.categories} />
        )}
        {step === 1 && <StepData draft={draft} update={update} />}
        {step === 2 && <StepWorkflow draft={draft} update={update} />}
        {step === 3 && (
          <StepReview
            draft={draft}
            spec={spec}
            appId={appId}
            result={result}
            validating={validating}
            validateError={validateError}
            onRevalidate={validate}
            onCopied={() => notify('success', 'Copied to clipboard.')}
          />
        )}
      </div>

      {step < 3 && (
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {stepProblems.length > 0 && <span className="text-sm text-rose-600">{stepProblems[0]}</span>}
            <Button onClick={next} disabled={stepProblems.length > 0}>
              {step === 2 ? 'Review specification' : 'Continue'}
            </Button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => setStep(2)}>
            Back
          </Button>
        </div>
      )}
    </div>
  )
}

function localChecks(d: Draft, step: number): string[] {
  const problems: string[] = []
  if (step === 0) {
    if (d.name.trim().length < 3) problems.push('Give the app a name (3+ characters).')
    if (d.purpose.trim().length < 10) problems.push('Describe the business purpose (10+ characters).')
    if (!d.category) problems.push('Pick an app type.')
  }
  if (step === 1) {
    if (!d.entityName.trim()) problems.push('Name the records the app manages.')
    const named = d.fields.filter((f) => f.name.trim())
    if (named.length < 2) problems.push('Add at least two fields.')
    if (!named.some((f) => f.showInList)) problems.push('Show at least one field in the list.')
    if (named.some((f) => f.type === 'enum' && !f.options.trim())) problems.push('List the allowed values for each "fixed list" field.')
  }
  if (step === 2) {
    if (d.roles.length === 0) problems.push('Add at least one role.')
    if (d.category === 'review_queue') {
      if (stateOptions(d).length < 2) problems.push('The status field needs at least two values.')
      if (!d.initialState) problems.push('Pick the starting status.')
      if (d.actions.filter((a) => a.id.trim()).length === 0) problems.push('Add at least one action.')
    }
    if (d.category !== 'review_queue' && !d.fields.some((f) => f.editable)) problems.push('Mark at least one field as editable for this app type.')
  }
  return problems
}

function StepBasics({ draft, update, categories }: { draft: Draft; update: (p: Partial<Draft>) => void; categories: Array<{ id: Draft['category']; label: string; example: string }> }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField label="Application name" value={draft.name} onChange={(name) => update({ name })} required placeholder="e.g. Feature-Flag Admin Panel" help={draft.name ? `Identifier: ${slug(draft.name) || '—'}` : undefined} />
      <SelectField
        label="What kind of app is it?"
        value={draft.category}
        onChange={(c) => update(applyCategoryDefaults({ ...draft, category: c as Draft['category'] }))}
        options={categories.map((c) => ({ value: c.id as string, label: `${c.label} — e.g. ${c.example}` }))}
        placeholder="Choose one…"
        required
      />
      <TextArea className="sm:col-span-2" label="Business purpose" value={draft.purpose} onChange={(purpose) => update({ purpose })} required rows={3} placeholder="What problem does it solve, and what decision or change does it support?" />
      <TextArea className="sm:col-span-2" label="Who will use it?" value={draft.users} onChange={(users) => update({ users })} rows={2} placeholder="One per line, e.g. Platform engineers / On-call engineers (read-only)" />
    </div>
  )
}

function StepData({ draft, update }: { draft: Draft; update: (p: Partial<Draft>) => void }) {
  const setField = (i: number, patch: Partial<DraftField>) => update({ fields: draft.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const removeField = (i: number) => update({ fields: draft.fields.filter((_, j) => j !== i) })
  const isReview = draft.category === 'review_queue'
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="What records does the app manage?" value={draft.entityName} onChange={(entityName) => update({ entityName })} required placeholder="e.g. Feature flag, Refund request, Merchant" help={draft.entityName ? `Entity id: ${slug(draft.entityName) || '—'}` : 'Singular noun.'} />
        <SelectField
          label="Where does the data come from?"
          value={draft.dataSource}
          onChange={(v) => update({ dataSource: v as Draft['dataSource'] })}
          options={[
            { value: 'mock', label: 'Synthetic / mock data is fine for now' },
            { value: 'existing_api', label: 'An existing API or database (describe below)' },
          ]}
        />
        <TextArea className="sm:col-span-2" label="Notes about the data source" value={draft.dataSourceNotes} onChange={(dataSourceNotes) => update({ dataSourceNotes })} rows={2} placeholder="e.g. Flags live in LaunchDarkly; for the prototype copy ~30 flags across staging and production." help="Free text for the engineer and Devin. No integration is built automatically." />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Fields to track</h3>
          <Button size="sm" variant="secondary" onClick={() => update({ fields: [...draft.fields, emptyField()] })}>
            Add field
          </Button>
        </div>
        <div className="space-y-3">
          {draft.fields.map((f, i) => (
            <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <TextField label="Field" value={f.name} onChange={(name) => setField(i, { name, label: f.label || name })} placeholder="e.g. environment" />
                <TextField label="Label shown to users" value={f.label} onChange={(label) => setField(i, { label })} placeholder="e.g. Environment" />
                <SelectField label="Type" value={f.type} onChange={(t) => setField(i, { type: t as FieldType, filterable: t === 'enum' || t === 'boolean' ? f.filterable : false })} options={fieldTypeOptions} />
                {f.type === 'enum' ? (
                  <TextField label="Allowed values" value={f.options} onChange={(options) => setField(i, { options })} placeholder="comma separated" required />
                ) : (
                  <div />
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-700">
                <Check label="Required" checked={f.required} onChange={(v) => setField(i, { required: v })} />
                <Check label="Show in list" checked={f.showInList} onChange={(v) => setField(i, { showInList: v })} />
                <Check label="Searchable" checked={f.searchable} onChange={(v) => setField(i, { searchable: v })} />
                <Check label="Filter by it" checked={f.filterable} onChange={(v) => setField(i, { filterable: v })} disabled={!(f.type === 'enum' || f.type === 'boolean')} />
                <Check label="Users can edit it" checked={f.editable} onChange={(v) => setField(i, { editable: v })} disabled={isReview && f.name === draft.stateField} />
                <button type="button" className="ml-auto text-xs text-rose-600 hover:underline" onClick={() => removeField(i)} disabled={draft.fields.length <= 1}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Only "fixed list" and "yes / no" fields can be used as filters. {isReview && 'For review queues the status field drives the workflow in the next step.'}
        </p>
      </div>
    </div>
  )
}

function StepWorkflow({ draft, update }: { draft: Draft; update: (p: Partial<Draft>) => void }) {
  const states = stateOptions(draft)
  const enumFields = draft.fields.filter((f) => f.type === 'enum' && f.name.trim())
  const setAction = (i: number, patch: Partial<DraftAction>) => update({ actions: draft.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) })
  const setRole = (i: number, patch: Partial<DraftRole>) => update({ roles: draft.roles.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const isReview = draft.category === 'review_queue'
  return (
    <div className="space-y-8">
      {isReview && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Workflow</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Status field" value={draft.stateField} onChange={(stateField) => update({ stateField, initialState: '', terminalStates: [], actions: [] })} options={enumFields.map((f) => ({ value: f.name, label: f.label || f.name }))} placeholder="Choose…" help="A 'fixed list' field from the previous step." />
            <SelectField label="Starting status" value={draft.initialState} onChange={(initialState) => update({ initialState })} options={states.map((s) => ({ value: s, label: s }))} placeholder="Choose…" />
            <CheckboxGroup label="Final statuses (no further actions)" options={states.map((s) => ({ value: s, label: s }))} value={draft.terminalStates} onChange={(terminalStates) => update({ terminalStates })} columns={1} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">Actions users can take</h4>
              <Button size="sm" variant="secondary" onClick={() => update({ actions: [...draft.actions, { id: '', label: '', from: [], to: '', requiresReason: true }] })}>
                Add action
              </Button>
            </div>
            <div className="space-y-3">
              {draft.actions.map((a, i) => (
                <div key={i} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
                  <TextField label="Action" value={a.label} onChange={(label) => setAction(i, { label, id: slug(label) })} placeholder="e.g. Approve" />
                  <CheckboxGroup label="Allowed from" options={states.filter((s) => !draft.terminalStates.includes(s)).map((s) => ({ value: s, label: s }))} value={a.from} onChange={(from) => setAction(i, { from })} columns={1} />
                  <SelectField label="Moves to" value={a.to} onChange={(to) => setAction(i, { to })} options={states.map((s) => ({ value: s, label: s }))} placeholder="Choose…" />
                  <div className="flex flex-col justify-between">
                    <Check label="Requires a reason" checked={a.requiresReason} onChange={(v) => setAction(i, { requiresReason: v })} />
                    <button type="button" className="self-end text-xs text-rose-600 hover:underline" onClick={() => update({ actions: draft.actions.filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Roles and permissions</h3>
          <Button size="sm" variant="secondary" onClick={() => update({ roles: [...draft.roles, { id: '', description: '', can: ['view'] }] })}>
            Add role
          </Button>
        </div>
        {draft.roles.map((r, i) => (
          <div key={i} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
            <TextField label="Role" value={r.id} onChange={(id) => setRole(i, { id: slug(id) || id })} placeholder="e.g. flag_admin" />
            <TextField label="Description" value={r.description} onChange={(description) => setRole(i, { description })} placeholder="Who is this?" />
            <div className="flex items-start justify-between gap-2">
              <CheckboxGroup label="Can" options={permissionOptions} value={r.can} onChange={(can) => setRole(i, { can: can as Permission[] })} columns={2} className="flex-1" />
              <button type="button" className="mt-6 text-xs text-rose-600 hover:underline" onClick={() => update({ roles: draft.roles.filter((_, j) => j !== i) })} disabled={draft.roles.length <= 1}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <p className="text-xs text-slate-500">Roles are enforced by the backend. In the prototype they are simulated personas, not real sign-in.</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Audit and review requirements</h3>
        <Toggle label="Keep an audit history of every change" checked={draft.auditEnabled} onChange={(auditEnabled) => update({ auditEnabled })} description="Who did what, previous → new value, reason and time. Required for anything that changes data." />
        <Toggle label="Require a written reason for every change" checked={draft.requireReason} onChange={(requireReason) => update({ requireReason })} />
        <TextArea label="How will we know it works? (acceptance criteria)" value={draft.acceptance} onChange={(acceptance) => update({ acceptance })} rows={4} placeholder={'One per line, e.g.\nFiltering by environment=staging shows only staging flags\nTurning a staging flag on persists after refresh and shows in history\nA viewer cannot change anything'} help="These become the tests Devin writes." />
      </section>
    </div>
  )
}

function StepReview({ draft, spec, appId, result, validating, validateError, onRevalidate, onCopied }: { draft: Draft; spec: Record<string, unknown>; appId: string; result: SpecValidationResult | null; validating: boolean; validateError: string | null; onRevalidate: () => void; onCopied: () => void }) {
  const yamlText = result?.yaml ?? ''
  const fileName = `${appId}.yaml`
  const prompt = devinPrompt(appId)

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    onCopied()
  }
  const download = () => {
    const blob = new Blob([yamlText], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const entity = (spec.entities as Array<{ name: string; fields: Array<{ name: string; type: string }> }>)[0]
  const roles = spec.roles as Array<{ id: string; can: string[] }>
  const workflow = spec.workflow as { states: string[]; actions: Array<{ label: string; from: string[]; to: string }> } | undefined
  const forms = spec.forms as Array<{ fields: string[]; roles: string[] }>

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-slate-800">Summary</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="App" v={`${draft.name} (${draft.category.replace('_', ' ')})`} />
          <Row k="Purpose" v={draft.purpose} />
          <Row k="Users" v={draft.users || '—'} />
          <Row k="Records" v={`${entity.name}: ${entity.fields.map((f) => f.name).join(', ')}`} />
          <Row k="Roles" v={roles.map((r) => `${r.id} (${r.can.join(', ')})`).join('; ')} />
          {workflow && <Row k="Workflow" v={workflow.actions.map((a) => `${a.label}: ${a.from.join('/')} → ${a.to}`).join('; ')} />}
          {forms.length > 0 && <Row k="Editable" v={forms.map((f) => `${f.fields.join(', ')} by ${f.roles.join(', ')}`).join('; ')} />}
          <Row k="Audit" v={draft.auditEnabled ? 'Every change recorded with actor, previous/new value, reason, time' : 'Disabled'} />
        </dl>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-800">Validation</h3>
          {validating ? (
            <StatusBadge tone="info" label="Checking…" />
          ) : result ? (
            <StatusBadge tone={result.valid ? 'success' : 'danger'} label={result.valid ? 'Specification is valid' : `${result.errors.length} problem${result.errors.length === 1 ? '' : 's'}`} />
          ) : null}
          <Button size="sm" variant="ghost" onClick={onRevalidate} loading={validating}>
            Re-check
          </Button>
        </div>
        {validateError && <ErrorState message={validateError} onRetry={onRevalidate} />}
        {result && !result.valid && (
          <ul className="space-y-1 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {result.errors.map((e, i) => (
              <li key={i}>
                <span className="font-mono text-xs">{e.path}</span>: {e.message}
              </li>
            ))}
          </ul>
        )}
        {result?.valid && result.warnings.length > 0 && (
          <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">Validation checks structure and consistency against the shared spec schema (the same check engineers run with <code>python -m app.cli validate-spec</code>). It does not build or deploy anything.</p>
      </section>

      {result?.valid && (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Specification — <span className="font-mono text-xs">specs/{fileName}</span></h3>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => copy(yamlText)}>
                  Copy YAML
                </Button>
                <Button size="sm" variant="secondary" onClick={download}>
                  Download
                </Button>
              </div>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md border border-slate-200 bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{yamlText}</pre>
          </section>

          <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
            <h3 className="font-semibold">What happens next (manual steps — nothing is automatic)</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Send the downloaded <span className="font-mono text-xs">{fileName}</span> to an engineer, or open a pull request that adds it under <span className="font-mono text-xs">specs/</span>.</li>
              <li>The engineer reviews and adjusts the spec (data source, permissions, edge cases) and merges it.</li>
              <li>The engineer asks Devin to implement it with the prompt below. Devin follows the template's Skill, reuses the shared components, writes one test per acceptance criterion, and opens a PR for review.</li>
              <li>After code review and testing, the app appears in this console's sidebar.</li>
            </ol>
            <div className="mt-3 flex items-start gap-2">
              <code className="flex-1 rounded border border-blue-200 bg-white p-2 text-xs">{prompt}</code>
              <Button size="sm" variant="secondary" onClick={() => copy(prompt)}>
                Copy prompt
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="contents">
      <dt className="font-medium text-slate-600">{k}</dt>
      <dd className="text-slate-900">{v}</dd>
    </div>
  )
}

function Check({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-1.5 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
      {label}
    </label>
  )
}
