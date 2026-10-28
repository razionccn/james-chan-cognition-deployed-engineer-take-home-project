# Fintech Operations Console — Internal Tool Development Template + KYC Review Queue

Proof of concept for a Cognition Deployed Engineer case study: a repeatable
**Internal Tool Development Template** (the "Golden Path" in the case brief) for building
internal business tools with Devin, and a working KYC review application built by following it.

> Status: **Internal Tool Development Template foundation** (this PR). The KYC application follows in PR #2
> and this README will be expanded with full run/test/limitations/evidence sections.

## Internal Tool Development Template in one glance

| Piece | Where |
|---|---|
| Structured app specification | `specs/kyc.yaml` |
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
