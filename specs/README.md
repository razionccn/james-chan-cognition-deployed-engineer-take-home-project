# Writing a spec

A spec is the only input the `create-internal-tool` Skill needs. You describe **what** the tool must
do — data, rules, endpoints, screens, acceptance tests. Devin decides **how**, using the shared
template (`AGENTS.md`). Start from `TEMPLATE.yaml`, keep `kyc.yaml` and `feature_flags.yaml` open as
worked examples, and run `python -c "import sys, yaml; yaml.safe_load(open(sys.argv[1]))" specs/<app_id>.yaml`
before asking for a build.

Writing rules of thumb: be exact about enum values, HTTP codes and field names; be loose about layout
and wording; if you do not know something, leave it out rather than guess — the build records what it
had to assume in `.agents/skills/create-internal-tool/LEARNINGS.md`, and that becomes the next field here.

## Field by field

### `app`
| Field | Meaning | Notes |
|---|---|---|
| `id` | Machine name of the tool | snake_case. Becomes `backend/app/apps/<id>/`, `frontend/src/apps/<id>/`, `/api/<id>`, the table prefix and this file's name. `test_core` fails if they disagree. |
| `name` | Human name | Sidebar entry, page title, home card. |
| `console` | Always `Fintech Operations Console` | — |
| `purpose` | 2–3 sentences | Who uses it, what they look at, what they can change, what is recorded. Read by the builder and shown on the home card. |
| `data_policy` | What must never appear | Always "synthetic only"; name the specific real data to avoid. |

### `roles` / `roles_note`
Which of the two global persona roles may write. There are no per-app roles yet: a write role is
always `reviewer`, read-only is `viewer`; unknown or missing persona = viewer. Describe what each
role may do *in this tool*. Keep `roles_note` verbatim — it is the "this is not authentication" disclaimer.

### `data_model`
One block per table. Every tool has an entity table and an `<entity>_audit_events` table.
- `primary_key`: `id` with a readable prefix (`KYC-1001`, `FF-1001`) for the entity; `id (autoincrement)` for audit rows.
- `fields`: `<name>: <type>` with `string | boolean | datetime | json | enum [...] | fk -> table.col`. Enumerations are exhaustive — the backend rejects anything else with 422. Comment formats and examples inline.
- Always include `updated_at` (and `updated_by` if the UI shows it). All datetimes are ISO-8601 UTC `Z`, second precision.
- `constraints`: uniqueness and the like, in words.
- Audit table: `action`, `previous_<field>`, `new_<field>`, `actor_id`, `actor_name`, `reason`, `created_at`. Say whether `reason` is required ("non-empty") or optional.

### Domain rules block (`workflow` **or** `environments`)
Pick the shape that matches the tool; delete the other. This is what `rules.py` mirrors and what the
UI uses to show only allowed controls.
- `workflow`: `states`, `initial`, `terminal`, and the exhaustive `transitions` list `{action, from, to}`. Anything not listed is a 409.
- `environments` (or tenants, regions…): list of `{id, editable}`; `editable: false` means the API refuses writes regardless of role (403 `environment_locked`).

### `business_rules`
Numbered `BR-n`, one sentence each, each one testable. The `on_violation` is the exact HTTP status and
error code the API must return — the test suite asserts it. Codes available: `403 forbidden`,
`403 environment_locked` (or your own 403 code), `404 not_found`, `409 invalid_transition`,
`422 validation_error`. Always include: who may write; what changes are allowed; required/limited input;
"update + exactly one audit event in one transaction, conditional update"; unknown id → 404; "backend
enforces everything, UI only hides".

### `api`
`base_path` is `/api/<app_id>`. Then one entry per endpoint: `method`, `path`, `query` (name → meaning
or enum), `body`, `auth` (which role), `response` (named shape or `{...}`), `errors`. The convention
every app follows — keep it unless you have a reason not to:

| Purpose | Endpoint |
|---|---|
| Enums / editability / transitions for the UI | `GET /meta` |
| List with search + filters | `GET /<entities>?q=&<filter>=` → `{ items, total }` |
| Detail incl. history | `GET /<entities>/{id}` → summary + `audit_events` (newest first) |
| Each consequential action | `POST /<entities>/{id}/<action>` (or `/actions` with an `action` field) → updated detail |

### `pages` — and how UI elements map to the API
Two pages: a list (`route: /<kebab-route>`) and a detail panel (`route: /<kebab-route>?<entity>={id}` —
a side panel over the list; the URL keeps it shareable). `elements` are prose bullets; the shared
components (`DataTable`, `FilterBar`, `DetailPanel`, `ConfirmDialog`, `Toggle`, `AuditTimeline`, toasts,
states) cover them, so describe content, not layout.

**Which endpoint feeds which element?** By default Devin applies the fixed convention:

| Element | Endpoint |
|---|---|
| search input, filters, data table | `GET /<entities>` with `q` / filter query params (debounced, refetched on change) |
| detail header, summary grid | `GET /<entities>/{id}` |
| audit history list | `audit_events` from the same detail response |
| each action button / toggle | `POST /<entities>/{id}/<action>`, then the detail is refetched and the list refreshed |
| filter options, allowed actions | `GET /meta` |

When you want to pin or override a mapping, add `# source: <GET endpoint>` (what an element displays)
or `# calls: <POST endpoint>` (what an element triggers) to the element line, as `TEMPLATE.yaml` shows.
Devin follows an explicit `source`/`calls` and falls back to the table above when it is absent. If an
element needs an endpoint that is not in `api`, add the endpoint — the spec, not the build, owns the API.

### `seed_data`
`count` (10–30), `distribution` per important field, and `requirements`. Always keep: deterministic;
some records with history; `updated_at` equals the newest audit event (`test_core` checks it); enough
variety that every filter value returns something.

### `acceptance_criteria`
`AC-n` as given / when / then; each becomes one `test_ac<n>_…` pytest that runs through real HTTP and a
real SQLite file. Cover at minimum: list; filters + invalid filter → 422; search; the happy-path action;
a disallowed action → 409; invalid input → 422; persistence across restart; exactly one audit row;
viewer → 403. Then `kind: regression` (existing apps' tests still pass) and `kind: browser` with the
manual checklist as bullets — the recorded browser run is ticked against them.

### `non_goals`
What the tool deliberately does not do (real SSO, external integrations, workflows, pagination). This
stops the build from gold-plating and tells reviewers what "done" means.

## After the spec
Ask Devin: *"Use the `create-internal-tool` skill to implement `specs/<app_id>.yaml`."* The Skill
reads `LEARNINGS.md` first, builds backend → frontend → tests, runs everything, and ends with a
retrospective that improves this template for the next spec.
