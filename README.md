# Feature-Flag Admin Panel

Internal tool (Fintech Operations Console) for inspecting feature flags across
`development`, `staging` and `production`, and toggling flags in non-production
environments with a durable audit trail.

Stack: Python 3.10 + FastAPI + Pydantic + `sqlite3` (no ORM) · React 18 + TypeScript + Vite + Tailwind CSS.

## Layout

```
backend/
  feature_flags/      package: db.py (schema), seed.py, service.py (business rules), api.py, app.py, __main__.py (CLI)
  tests/              pytest suite (HTTP via TestClient against a real temp SQLite file)
  requirements.txt
frontend/
  src/                React app (App.tsx, api.ts, urlState.ts, components/)
```

## Backend

```bash
cd backend
python3 -m venv ../.venv && source ../.venv/bin/activate
pip install -r requirements.txt

# create schema, drop existing tables and insert the deterministic 14-flag seed
python -m feature_flags init-db --reset --seed          # writes ./feature_flags.db (override with --db PATH or FEATURE_FLAGS_DB)

# run the API on http://127.0.0.1:8000
python -m feature_flags serve                           # or: uvicorn feature_flags.app:app --reload

# tests
pytest
```

API base path: `/api/feature_flags` (`/meta`, `/flags`, `/flags/{id}`, `POST /flags/{id}/toggle`).
Interactive docs at `http://127.0.0.1:8000/docs`.

### Simulated identity (dev only)

Requests carry an `X-Demo-User` header naming a persona. Known personas:

| header value     | name        | role     |
|------------------|-------------|----------|
| `alice.reviewer` | Alice Nguyen| reviewer |
| `bob.reviewer`   | Bob Okafor  | reviewer |
| `carol.viewer`   | Carol Díaz  | viewer   |

Missing or unknown header → read-only viewer. Only `reviewer` may toggle, and only in
`development` / `staging` (`production` is locked). All rules are enforced server-side.

Error responses are `{ "code": "...", "message": "..." }` with codes
`not_found` (404), `forbidden` (403), `environment_locked` (403), `invalid_transition` (409),
`validation_error` (422).

## Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173/feature-flags  (proxies /api to http://127.0.0.1:8000)
npm run typecheck    # tsc --noEmit
npm run build        # tsc + vite build -> dist/
```

The persona is chosen from the header dropdown and stored in `localStorage`; the selected flag and
filters live in the URL (`/feature-flags?flag=FF-2001&environment=staging`) so links are shareable.

## Design decisions

- One SQLite connection per request (`PRAGMA journal_mode=WAL`, `busy_timeout=5000`); toggles run in a
  `BEGIN IMMEDIATE` transaction with a conditional `UPDATE ... WHERE enabled = <previous>`; a lost race
  returns `409 invalid_transition` and writes no audit row.
- Rule precedence for `POST /toggle`: 404 → 403 `environment_locked` → 403 `forbidden` → 409 → write.
  The lock check comes before the role check so viewers see the real reason a production flag is immutable.
- `reason` is optional, `""` when omitted, max 500 chars (422 otherwise).
- Timestamps are UTC ISO-8601 with `Z`, second precision.
