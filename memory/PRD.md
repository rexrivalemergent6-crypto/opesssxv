# AlzNexus — Agentic Alzheimer's Research Foundry

## Original request
"https://github.com/rexrivalemergent6-crypto/all-new build this here" — rebuild/run the imported repo in this environment.

## Architecture
- Backend: FastAPI (`server.py`, `agents.py` multi-agent pipeline, `sources.py` live APIs: PubMed, ClinicalTrials.gov v2, Open Targets, ChEMBL, Reactome)
- LLM: Claude Sonnet 4.5 via emergentintegrations + EMERGENT_LLM_KEY
- MongoDB collections: runs, insights, agents, audit_logs, learnings, schedules, cron_runs
- Frontend: React + shadcn, pages Dashboard, Runs, RunDetail, Insights, Agents, Schedules (Autonomy), Memory, Audit
- Platform cron `.emergent/crons.yml` -> POST /api/cron/tick every 15 min (Bearer WEBHOOK_CRON_SECRET)

## Done (2026-10-11)
- Recreated missing backend/.env + frontend/.env, installed deps, added httpx to requirements
- Fixed: LLM 429 concurrent_request_limit — global semaphore (LLM_CONCURRENCY, default 1) + retry/backoff in agents.llm
- Verified full run end-to-end (13 steps, 3 insights, learnings), cron auth 401/202

## Backlog
- P1: Live progress streaming in RunDetail; faster runs (higher concurrency if plan allows)
- P2: Export insights (PDF/CSV), insight comparison
