# Fintech Operations Console — Devin Golden Path + KYC Review Queue

Proof of concept for a Cognition Deployed Engineer case study: a repeatable
"Golden Path" for building internal business tools with Devin, and a working
KYC review application built by following it.

> Status: **Golden Path foundation** (this PR). The KYC application follows in PR #2
> and this README will be expanded with full run/test/limitations/evidence sections.

## Golden Path in one glance

| Piece | Where |
|---|---|
| Structured app specification | `specs/kyc-review.yaml` |
| Repository instructions & conventions | `AGENTS.md` |
| Repeatable Devin procedure | `.agents/skills/create-internal-tool/SKILL.md` |
| Shared backend foundation | `backend/app/core/` |
| Shared frontend shell & components | `frontend/src/shared/` |
| Implementation record | `docs/IMPLEMENTATION_LOG.md` |

## Quick start

```bash
cd backend && pip install -r requirements.txt && python -m app.cli init-db --reset --seed
uvicorn app.main:app --reload --port 8000
# second terminal
cd frontend && npm install && npm run dev      # http://localhost:5173
```

Tests: `cd backend && python -m pytest` · `cd frontend && npm run typecheck`

All data is synthetic. The persona switcher is a development-only fixture, not authentication.
