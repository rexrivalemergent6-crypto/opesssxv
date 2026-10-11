# OpenAlz — Self-Evolving Alzheimer's Research Foundry

## Original request
1. "build this here" (repo all-new). 2. Make it the *exact* self-evolving foundry from the reference design (all features), fix mobile UI, premium light/clinical UI, openable on mobile & PC, docs section of full research + /doc page, attractive informative landing page (agentalois.com-style animations). 3. Brand as **OpenAlz**, no third-party project/brand mentions, favicon & tab titles.

## User choices
- All source features ported; live public databases instead of AD Workbench; light clinical theme; landing `/`, app `/app/*`, docs `/doc`; docs = everything + live research library.

## Architecture
- Backend FastAPI: `server.py` (routes), `agents.py` (10-agent pipeline, PriorityLimiter LLM queue: chat prio 0 > research, AGENT_NOTES reflections, cancellation), `autonomy.py` (daily scan, self-correction, debates, reflection, bias portal, ethical gateway), `sources.py` (PubMed, CT.gov, Open Targets, ChEMBL, Reactome)
- Mongo: runs, insights, goals, learnings, audit_logs, agents, schedules, corrections, debates, reflections, bias_reports, chat_sessions, chat_messages, notifications, settings, cron_runs
- LLM via emergentintegrations + EMERGENT_LLM_KEY; models selectable in Settings (labels shown as "OpenAlz Engine · Standard/Advanced/Balanced/Explorer"); default research = claude-sonnet-4-5
- Frontend: Landing (canvas cells, boot gate, orbit, live audit terminal, funnel, receipts), Docs (12 sections + research library), ResearchReport `/doc/research/:id`, app pages incl. Goals, Orchestrator, Chat (SSE), Bias, Settings; responsive layout w/ mobile drawer
- Cron `.emergent/crons.yml` → `/api/cron/tick` every 15 min (schedules + autonomous daily scan)

## Done
- 2026-10-11: env recreated, LLM concurrency fix, cron double-trigger fix
- 2026-10-11: full feature port, premium UI, mobile, landing, docs, OpenAlz rebrand, favicon/manifest, per-route titles

## Backlog
- P1: insight export (CSV/PDF batch), live SSE progress for runs
- P2: comparison view, weekly digest
