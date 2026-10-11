import asyncio
import heapq
import json
import os
import re
import uuid
from collections import Counter
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

import sources

MODEL = ("anthropic", "claude-sonnet-4-5-20250929")

AGENTS = [
    {"key": "orchestrator", "name": "Master Orchestrator", "role": "Daily scan planning, sub-agent coordination, debate resolution and self-correction.", "source": "OpenAlz reasoning engine"},
    {"key": "literature_bridger", "name": "Literature Bridger", "role": "Bridges Alzheimer's literature with adjacent fields to surface hidden connections.", "source": "PubMed E-utilities (NCBI)"},
    {"key": "biomarker_hunter", "name": "Biomarker Hunter", "role": "Identifies candidate fluid, imaging and molecular biomarkers.", "source": "PubMed + Open Targets"},
    {"key": "drug_screener", "name": "Drug Screener", "role": "Screens clinical-stage and repurposable compounds against AD targets.", "source": "ChEMBL + Open Targets"},
    {"key": "trial_optimizer", "name": "Trial Optimizer", "role": "Optimises trial design: endpoints, cohorts, failure patterns.", "source": "ClinicalTrials.gov API v2"},
    {"key": "pathway_modeler", "name": "Pathway Modeler", "role": "Models enriched biological pathways over the evidence gene set.", "source": "Reactome Analysis Service"},
    {"key": "data_harmonizer", "name": "Data Harmonizer", "role": "Harmonises heterogeneous source data into a unified evidence graph.", "source": "All live sources"},
    {"key": "hypothesis_validator", "name": "Hypothesis Validator", "role": "Verifies citations against registries and adversarially debates hypotheses.", "source": "PubMed + ClinicalTrials.gov + OpenAlz engine"},
    {"key": "collaboration_matchmaker", "name": "Collaboration Matchmaker", "role": "Matches insights to active researchers and institutions.", "source": "PubMed author records"},
    {"key": "bias_detection", "name": "Bias Detection Service", "role": "Detects demographic, cohort, publication and confirmation bias; proposes corrections.", "source": "OpenAlz reasoning engine"},
]

SYSTEMS = {
    "orchestrator": "You are the Master Orchestrator of OpenAlz, an autonomous Alzheimer's disease research foundry. You plan, coordinate, resolve debates and self-correct. Output strict JSON only.",
    "literature_bridger": "You are the Literature Bridger agent. Find non-obvious mechanistic bridges between Alzheimer's research and an adjacent field, citing PMIDs. Output strict JSON only.",
    "biomarker_hunter": "You are the Biomarker Hunter agent. Identify candidate biomarkers with evidence strength, citing PMIDs and targets. Output strict JSON only.",
    "drug_screener": "You are the Drug Screener agent. Screen compounds for AD relevance and repurposing potential using target-association evidence. Output strict JSON only.",
    "trial_optimizer": "You are the Trial Optimizer agent. Analyse trial registry data for design weaknesses, endpoint choices, cohort gaps and propose optimisations. Output strict JSON only.",
    "pathway_modeler": "You are the Pathway Modeler agent. Interpret pathway enrichment results into mechanistic models. Output strict JSON only.",
    "data_harmonizer": "You are the Data Harmonizer agent. Reconcile entities across sources and flag inconsistencies. Output strict JSON only.",
    "hypothesis_validator": "You are the Hypothesis Validator. Be skeptical: identify weaknesses, prior art and over-claiming. Penalise unverified citations. Score harshly but fairly. Output strict JSON only.",
    "collaboration_matchmaker": "You are the Collaboration Matchmaker. Match research insights to real researchers from the provided author records only. Output strict JSON only.",
    "bias_detection": "You are the Bias Detection Service. Detect demographic, cohort, publication, and confirmation bias in evidence and reasoning. Output strict JSON only.",
}


def now():
    return datetime.now(timezone.utc).isoformat()


class PriorityLimiter:
    """Concurrency limiter where lower priority numbers are served first (interactive > background)."""

    def __init__(self, n: int):
        self.n, self.active, self.waiters, self.seq = n, 0, [], 0

    async def acquire(self, prio: int = 5):
        if self.active < self.n and not self.waiters:
            self.active += 1
            return
        fut = asyncio.get_event_loop().create_future()
        self.seq += 1
        heapq.heappush(self.waiters, (prio, self.seq, fut))
        try:
            await fut
        except asyncio.CancelledError:
            if fut.done() and not fut.cancelled():
                self.release()
            raise

    def release(self):
        self.active -= 1
        while self.waiters and self.active < self.n:
            _, _, f = heapq.heappop(self.waiters)
            if not f.done():
                self.active += 1
                f.set_result(True)

    def busy(self):
        return {"active": self.active, "queued": len(self.waiters), "limit": self.n}


LIMITER = PriorityLimiter(int(os.environ.get("LLM_CONCURRENCY", "1")))
AGENT_NOTES: dict = {}  # agent key -> list of self-reflection adjustments


def is_rate_limit(e: Exception) -> bool:
    m = str(e)
    return "429" in m or "RateLimit" in m or "concurrent" in m.lower()


def make_chat(session: str, system: str, model=None, history=None) -> LlmChat:
    prov, name = model or MODEL
    msgs = [{"role": "system", "content": system}] + (history or []) if history else None
    return LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session, system_message=system,
                   initial_messages=msgs).with_model(prov, name)


async def _llm_once(agent: str, sys: str, prompt: str, model=None) -> str:
    chat = make_chat(f"{agent}-{uuid.uuid4()}", sys, model)
    out = ""
    async for ev in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            out += ev.content
        elif isinstance(ev, StreamDone):
            break
    return out


async def llm_text(agent: str, sys: str, prompt: str, prio: int = 5, model=None) -> str:
    for i in range(5):
        await LIMITER.acquire(prio)
        try:
            return await _llm_once(agent, sys, prompt, model)
        except Exception as e:
            if i < 4 and is_rate_limit(e):
                await asyncio.sleep(3 * (i + 1))
                continue
            raise
        finally:
            LIMITER.release()


def parse_json(out: str) -> dict:
    m = re.search(r"\{.*\}", out, re.S)
    if not m:
        return {"raw": out}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return {"raw": out}


async def llm(agent: str, prompt: str, memory: list, prio: int = 5) -> dict:
    sys = SYSTEMS[agent]
    if memory:
        sys += "\n\nStrategy memory learned from previous runs (apply it):\n- " + "\n- ".join(memory)
    if AGENT_NOTES.get(agent):
        sys += "\n\nYour own self-reflection adjustments (apply them):\n- " + "\n- ".join(AGENT_NOTES[agent])
    out = await llm_text(agent, sys, prompt, prio)
    return parse_json(out)




def slim(papers):
    return [{k: p[k] for k in ("pmid", "title", "journal", "year", "url")} for p in papers]


class Run:
    def __init__(self, db, run_id):
        self.db, self.id = db, run_id

    async def audit(self, agent, action, details):
        await self.db.audit_logs.insert_one({"id": str(uuid.uuid4()), "run_id": self.id, "agent": agent,
                                             "action": action, "details": details, "timestamp": now()})

    async def do(self, agent, action, fn):
        sid = str(uuid.uuid4())
        await self.db.runs.update_one({"id": self.id}, {"$push": {"steps": {
            "id": sid, "agent": agent, "action": action, "status": "running", "output": None, "started_at": now(), "finished_at": None}}})
        await self.audit(agent, f"Started: {action}", {"step_id": sid})
        try:
            out, status = await fn(), "done"
        except Exception as e:
            out, status = {"error": f"{type(e).__name__}: {e}"}, "failed"
        await self.db.runs.update_one({"id": self.id, "steps.id": sid}, {"$set": {
            "steps.$.status": status, "steps.$.output": out, "steps.$.finished_at": now()}})
        await self.audit(agent, f"{'Completed' if status == 'done' else 'Failed'}: {action}", {"step_id": sid, **({"error": out["error"]} if status == "failed" else {})})
        await self.db.agents.update_one({"key": agent}, {"$inc": {"tasks_completed" if status == "done" else "tasks_failed": 1}, "$set": {"last_active": now()}})
        if status == "failed" and agent in ("orchestrator",):
            raise RuntimeError(out["error"])
        return out if status == "done" else {}


async def load_agent_notes(db):
    AGENT_NOTES.clear()
    async for r in db.reflections.find({"status": "completed"}, {"_id": 0}).sort("created_at", -1).limit(50):
        if r["agent"] not in AGENT_NOTES:
            AGENT_NOTES[r["agent"]] = (r.get("result") or {}).get("adjustments", [])[:4]


async def execute_run(db, run_id: str, goal: str):
    run = Run(db, run_id)
    await db.runs.update_one({"id": run_id}, {"$set": {"status": "running", "started_at": now()}})
    try:
        await load_agent_notes(db)
        memory = [m["lesson"] async for m in db.learnings.find({}, {"_id": 0}).sort("created_at", -1).limit(12)]
        prior = [i["title"] async for i in db.insights.find({}, {"_id": 0, "title": 1}).sort("created_at", -1).limit(30)]

        plan = await run.do("orchestrator", "Daily scan: decompose goal & assign sub-agent tasks", lambda: llm("orchestrator", f"""Research goal: {goal}
Previously generated insights (avoid duplicating): {prior}
Return JSON: {{"objective": str, "pubmed_query": "concise PubMed boolean query (alzheimer is appended automatically)",
"bridge_field": "an adjacent non-AD field/disease worth bridging", "bridge_query": "PubMed query for that field (no alzheimer)",
"biomarker_query": "PubMed query for biomarkers related to the goal", "trials_term": "short ClinicalTrials.gov term",
"drug_focus": str, "rationale": str}}""", memory))

        targets_task = asyncio.create_task(sources.opentargets_ad())

        async def literature():
            ad, br = await asyncio.gather(sources.pubmed_search(plan.get("pubmed_query", goal)),
                                          sources.pubmed_search(plan.get("bridge_query", plan.get("bridge_field", "")), 6, alzheimer=False))
            syn = await llm("literature_bridger", f"Goal: {goal}\nAD abstracts: {json.dumps(ad)}\nAdjacent field ({plan.get('bridge_field')}) abstracts: {json.dumps(br)}\n"
                            "Return JSON: {\"key_findings\": [{\"finding\": str, \"pmids\": [str]}], \"bridges\": [{\"connection\": str, \"ad_pmids\": [str], \"bridge_pmids\": [str]}], \"gaps\": [str]}", memory)
            return {"papers": slim(ad), "bridge_papers": slim(br), "_raw": ad + br, **syn}

        async def biomarkers():
            papers, tg = await asyncio.gather(sources.pubmed_search(plan.get("biomarker_query", goal + " biomarker"), 6), targets_task)
            syn = await llm("biomarker_hunter", f"Goal: {goal}\nBiomarker abstracts: {json.dumps(papers)}\nOpen Targets AD associations: {json.dumps(tg)}\n"
                            "Return JSON: {\"candidates\": [{\"biomarker\": str, \"type\": \"fluid|imaging|genetic|digital|molecular\", \"evidence\": str, \"pmids\": [str], \"genes\": [str], \"strength\": \"weak|moderate|strong\"}]}", memory)
            return {"papers": slim(papers), "targets": tg[:15], "_raw": papers, **syn}

        async def drugs():
            dr, tg = await asyncio.gather(sources.chembl_ad_drugs(), targets_task)
            syn = await llm("drug_screener", f"Goal: {goal}\nFocus: {plan.get('drug_focus')}\nChEMBL AD drug indications: {json.dumps(dr)}\nOpen Targets targets: {json.dumps([t['symbol'] for t in tg])}\n"
                            "Return JSON: {\"shortlist\": [{\"drug\": str, \"chembl_id\": str, \"rationale\": str, \"targets\": [str], \"repurposing\": bool}], \"untargeted_genes\": [str]}", memory)
            return {"drugs": dr, **syn}

        async def trials():
            ts = await sources.trials_search(plan.get("trials_term", goal))
            syn = await llm("trial_optimizer", f"Goal: {goal}\nTrials: {json.dumps(ts)}\n"
                            "Return JSON: {\"landscape\": str, \"failure_patterns\": [str], \"design_recommendations\": [str], \"cohort_gaps\": [str], \"notable_nct_ids\": [str]}", memory)
            return {"trials": ts, **syn}

        lit, bio, drg, tri = await asyncio.gather(
            run.do("literature_bridger", f"Bridge AD literature with {plan.get('bridge_field', 'adjacent field')}", literature),
            run.do("biomarker_hunter", "Hunt candidate biomarkers", biomarkers),
            run.do("drug_screener", "Screen compounds (ChEMBL)", drugs),
            run.do("trial_optimizer", "Analyse & optimise trial landscape", trials))
        targets = await targets_task

        async def pathways():
            genes = {t["symbol"] for t in targets[:20]}
            for c in bio.get("candidates", []):
                genes.update(c.get("genes", []))
            for d in drg.get("shortlist", []):
                genes.update(d.get("targets", []))
            pw = await sources.reactome_enrich(sorted(g for g in genes if g and g.isascii())[:60])
            syn = await llm("pathway_modeler", f"Goal: {goal}\nGene set: {sorted(genes)}\nReactome enrichment: {json.dumps(pw)}\n"
                            "Return JSON: {\"model\": str, \"key_pathways\": [{\"id\": str, \"name\": str, \"role\": str}], \"crosstalk\": [str]}", memory)
            return {"gene_set": sorted(genes), "pathways": pw, **syn}

        pwy = await run.do("pathway_modeler", "Model enriched Reactome pathways", pathways)

        async def harmonize():
            papers = {p["pmid"]: p for p in lit.get("papers", []) + lit.get("bridge_papers", []) + bio.get("papers", [])}
            graph = {"papers": len(papers), "trials": len(tri.get("trials", [])), "drugs": len(drg.get("drugs", [])),
                     "targets": len(targets), "pathways": len(pwy.get("pathways", [])), "genes": len(pwy.get("gene_set", []))}
            syn = await llm("data_harmonizer", f"Harmonise these agent outputs into unified entities.\nLiterature: {json.dumps({k: lit.get(k) for k in ('key_findings', 'bridges')})}\n"
                            f"Biomarkers: {json.dumps(bio.get('candidates'))}\nDrugs: {json.dumps(drg.get('shortlist'))}\nTrials: {json.dumps({k: tri.get(k) for k in ('failure_patterns', 'cohort_gaps')})}\n"
                            f"Pathways: {json.dumps(pwy.get('key_pathways'))}\n"
                            "Return JSON: {\"unified_entities\": [{\"entity\": str, \"type\": str, \"sources\": [str]}], \"convergent_signals\": [str], \"inconsistencies\": [str]}", memory)
            return {"entity_counts": graph, "pmid_index": list(papers), **syn}

        har = await run.do("data_harmonizer", "Harmonise multi-source evidence graph", harmonize)

        evidence = json.dumps({
            "literature": {k: lit.get(k) for k in ("papers", "bridge_papers", "key_findings", "bridges", "gaps")},
            "biomarkers": bio.get("candidates"), "drugs": drg.get("shortlist"),
            "trials": {k: tri.get(k) for k in ("landscape", "failure_patterns", "cohort_gaps", "notable_nct_ids")},
            "pathways": {k: pwy.get(k) for k in ("model", "key_pathways", "crosstalk")},
            "harmonized": {k: har.get(k) for k in ("convergent_signals", "inconsistencies")}})

        hyp = await run.do("orchestrator", "Coordinate sub-agents: synthesise cross-source hypotheses", lambda: llm("orchestrator", f"""Goal: {goal}
Evidence from sub-agents: {evidence}
Avoid these existing insights: {prior}
Generate 3 novel, falsifiable hypotheses grounded ONLY in cited evidence (use only PMIDs / NCT IDs present above).
Return JSON: {{"hypotheses": [{{"title": str, "statement": str, "mechanism": str, "supporting_pmids": [str], "supporting_nct_ids": [str], "targets": [str], "drugs": [str], "pathways": [str], "proposed_validation": str}}]}}""", memory))
        hyps = hyp.get("hypotheses", [])

        async def validate():
            pmids = sorted({p for h in hyps for p in h.get("supporting_pmids", [])})
            ncts = sorted({n for h in hyps for n in h.get("supporting_nct_ids", [])})
            pv, nv = await asyncio.gather(sources.pubmed_verify(pmids), sources.trials_verify(ncts))
            ver = {**pv, **nv}
            syn = await llm("hypothesis_validator", f"""Evidence: {evidence}
Citation verification against PubMed/ClinicalTrials.gov registries (true = exists): {json.dumps(ver)}
Hypotheses: {json.dumps(hyps)}
For each hypothesis (same order) run a debate: strongest objection, the proponent's best rebuttal, then scores 0-100.
Return JSON: {{"reviews": [{{"objection": str, "rebuttal": str, "novelty": int, "confidence": int, "rigor": int, "verdict": "accept"|"revise"|"reject", "revised_statement": str}}]}}""", memory)
            return {"citation_verification": ver, **syn}

        val = await run.do("hypothesis_validator", "Verify citations & adversarial debate", validate)
        reviews, verified = val.get("reviews", []), val.get("citation_verification", {})

        res = await run.do("orchestrator", "Resolve debate & finalise verdicts", lambda: llm("orchestrator", f"""Hypotheses: {json.dumps(hyps)}
Validator reviews: {json.dumps(reviews)}
As arbiter, resolve each debate. Return JSON: {{"resolutions": [{{"final_verdict": "accept"|"revise"|"reject", "reason": str}}]}}""", memory))
        resolutions = res.get("resolutions", [])

        bias = await run.do("bias_detection", "Audit evidence & hypotheses for bias", lambda: llm("bias_detection", f"""Evidence: {evidence}
Trial cohorts: {json.dumps([{k: t.get(k) for k in ('nct_id', 'enrollment', 'age_range', 'sex')} for t in tri.get('trials', [])])}
Hypotheses: {json.dumps(hyps)}
Return JSON: {{"overall_risk": "low"|"medium"|"high", "flags": [{{"type": str, "description": str, "severity": "low"|"medium"|"high", "correction": str, "hypothesis_index": int|null}}]}}""", memory))

        raw_papers = lit.get("_raw", []) + bio.get("_raw", [])

        async def collab():
            people = [{"name": a["name"], "affiliation": a["affiliation"], "pmid": p["pmid"]} for p in raw_papers for a in p.get("authors", [])]
            counts = Counter(x["name"] for x in people)
            syn = await llm("collaboration_matchmaker", f"Hypotheses: {json.dumps([h.get('title') for h in hyps])}\nAuthor records from retrieved papers: {json.dumps(people[:80])}\n"
                            "Return JSON: {\"matches\": [{\"hypothesis_index\": int, \"researchers\": [{\"name\": str, \"affiliation\": str, \"pmid\": str, \"why\": str}]}]}", memory)
            return {"author_count": len(counts), "top_authors": counts.most_common(8), **syn}

        col = await run.do("collaboration_matchmaker", "Match insights to researchers", collab)
        for p in raw_papers:
            p.pop("abstract", None)
        await db.runs.update_one({"id": run_id, "steps.agent": "literature_bridger"}, {"$unset": {"steps.$.output._raw": ""}})
        await db.runs.update_one({"id": run_id, "steps.agent": "biomarker_hunter"}, {"$unset": {"steps.$.output._raw": ""}})

        insight_ids = []
        matches = {m.get("hypothesis_index"): m.get("researchers", []) for m in col.get("matches", [])}
        for i, h in enumerate(hyps):
            rv = reviews[i] if i < len(reviews) else {}
            rs = resolutions[i] if i < len(resolutions) else {}
            doc = {"id": str(uuid.uuid4()), "run_id": run_id, "goal": goal, "title": h.get("title"),
                   "statement": rv.get("revised_statement") or h.get("statement"), "original_statement": h.get("statement"),
                   "mechanism": h.get("mechanism"), "targets": h.get("targets", []), "drugs": h.get("drugs", []), "pathways": h.get("pathways", []),
                   "citations": [{"type": "pubmed", "id": p, "verified": verified.get(p, False), "url": f"https://pubmed.ncbi.nlm.nih.gov/{p}/"} for p in h.get("supporting_pmids", [])]
                   + [{"type": "trial", "id": t, "verified": verified.get(t, False), "url": f"https://clinicaltrials.gov/study/{t}"} for t in h.get("supporting_nct_ids", [])],
                   "proposed_validation": h.get("proposed_validation"),
                   "debate": {"objection": rv.get("objection"), "rebuttal": rv.get("rebuttal"), "resolution": rs.get("reason")},
                   "novelty": rv.get("novelty", 0), "confidence": rv.get("confidence", 0), "rigor": rv.get("rigor", 0),
                   "verdict": rs.get("final_verdict") or rv.get("verdict", "revise"),
                   "bias_flags": [f for f in bias.get("flags", []) if f.get("hypothesis_index") in (i, None)],
                   "collaborators": matches.get(i, []), "starred": False, "created_at": now()}
            await db.insights.insert_one(dict(doc))
            insight_ids.append(doc["id"])

        lessons = await run.do("orchestrator", "Self-correction: distil lessons into strategy memory", lambda: llm("orchestrator", f"""Goal: {goal}
Plan: {json.dumps(plan)}
Failed sub-agents: {[s for s, o in (('literature_bridger', lit), ('biomarker_hunter', bio), ('drug_screener', drg), ('trial_optimizer', tri), ('pathway_modeler', pwy)) if not o]}
Validator reviews: {json.dumps(reviews)}
Debate resolutions: {json.dumps(resolutions)}
Bias audit: {json.dumps(bias)}
Return JSON: {{"lessons": [str, str, str]}} — short, actionable, reusable strategy lessons that will improve future runs.""", memory))
        for l in lessons.get("lessons", [])[:3]:
            await db.learnings.insert_one({"id": str(uuid.uuid4()), "lesson": l, "run_id": run_id, "goal": goal, "created_at": now()})

        await db.runs.update_one({"id": run_id}, {"$set": {"status": "completed", "finished_at": now(), "plan": plan,
                                                           "insight_ids": insight_ids, "bias_risk": bias.get("overall_risk")}})
        await run.audit("orchestrator", "Run completed", {"insights": len(insight_ids)})
    except asyncio.CancelledError:
        await db.runs.update_one({"id": run_id}, {"$set": {"status": "cancelled", "error": "Cancelled by researcher", "finished_at": now(),
                                                           "steps.$[s].status": "cancelled", "steps.$[s].finished_at": now()}},
                                 array_filters=[{"s.status": "running"}])
        await run.audit("orchestrator", "Run cancelled", {})
        raise
    except Exception as e:
        await db.runs.update_one({"id": run_id}, {"$set": {"status": "failed", "error": str(e), "finished_at": now()}})
        await run.audit("orchestrator", "Run failed", {"error": str(e)})
