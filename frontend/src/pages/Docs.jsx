import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlass, ArrowRight, CaretDown } from "@phosphor-icons/react";
import { api, AGENT_META, fmtDate } from "@/lib/api";
import { SiteNav, SiteFooter } from "@/components/Site";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const TOC = [
  ["overview", "Overview"], ["quickstart", "Quick start"], ["evolution", "How self-evolution works"], ["agents", "The agents"],
  ["sources", "Data sources"], ["method", "Methodology & scoring"], ["debate", "Multi-agent debate"], ["ethics", "Privacy & ethics"],
  ["architecture", "Architecture"], ["api", "API reference"], ["faq", "FAQ"], ["library", "Research library"],
];

const H = ({ id, n, children }) => (
  <h2 id={id} className="scroll-mt-24 font-display text-3xl sm:text-4xl font-medium tracking-tight pt-14 first:pt-0 mb-5">
    <span className="font-mono text-xs text-primary block mb-2">{String(n).padStart(2, "0")}</span>{children}
  </h2>
);
const P = ({ children }) => <p className="text-[15px] leading-[1.8] text-foreground/85 mb-4">{children}</p>;
const Code = ({ children }) => <pre className="font-mono text-[11px] sm:text-xs bg-card border rounded-xl p-4 overflow-x-auto leading-relaxed my-4">{children}</pre>;
const Table = ({ head, rows }) => (
  <div className="overflow-x-auto border rounded-xl bg-card my-5">
    <table className="w-full text-sm min-w-[560px]">
      <thead><tr className="border-b text-left">{head.map((h) => <th key={h} className="label-xs p-3">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-0 align-top">{r.map((c, k) => <td key={k} className={`p-3 ${k === 0 ? "font-mono text-xs text-primary whitespace-nowrap" : "text-foreground/80"}`}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

const API = [
  ["POST /api/runs", "Launch a research run {goal, goal_id?}"], ["GET /api/runs", "List runs (?status, ?goal_id)"], ["GET /api/runs/{id}", "Run with steps & insights"],
  ["POST /api/runs/{id}/cancel", "Cancel a running task"], ["GET|POST|PATCH|DELETE /api/goals", "Research goals (ACTIVE · PROPOSED · COMPLETED · ARCHIVED)"],
  ["POST /api/goals/{id}/pursue", "Launch a run for a goal"], ["POST /api/orchestrator/daily-scan", "Autonomous daily scan → self-set goal → run"],
  ["POST /api/orchestrator/self-correction", "Start a self-correction cycle"], ["GET /api/orchestrator/self-corrections", "Self-correction history"],
  ["POST /api/debates", "Convene a debate {topic, insight_id?}"], ["GET /api/debates/{id}", "Debate transcript & resolution"],
  ["GET /api/agents", "Agent registry"], ["POST /api/agents/{key}/reflect", "Trigger agent self-reflection"],
  ["GET /api/insights", "Insights (?verdict, ?starred)"], ["POST /api/insights/{id}/star", "Toggle star"], ["GET /api/learnings", "Strategy memory"],
  ["POST /api/bias/detect", "Bias analysis {content, content_type, context?}"], ["GET /api/bias/reports/{id}", "Bias report"],
  ["POST /api/chat/sessions", "New assistant conversation"], ["POST /api/chat/sessions/{id}/message", "Send message (Server-Sent Events stream)"],
  ["GET|PUT /api/settings", "Autonomy, models, alerts"], ["GET /api/audit", "Audit trail (?agent, ?run_id)"], ["GET /api/stats · /api/health", "Metrics & system status"],
  ["POST /api/cron/tick", "Platform scheduler hook (Bearer secret)"],
];

const FAQ = [
  ["Is this medical advice?", "No. OpenAlz generates research hypotheses from public literature and registries. Nothing has been validated in a lab or clinic. Never use it to make decisions about a person's care."],
  ["Does it use patient data?", "No. OpenAlz reads only public, aggregate sources (PubMed abstracts, trial registry records, target-disease associations, compound indications, pathway databases). No patient-level data is ever read, stored or moved."],
  ["What makes it \"self-evolving\"?", "Four mechanisms: run debriefs write lessons to strategy memory; self-correction cycles analyse failures and scores, add adaptations and retire stale lessons; each agent can self-reflect and its adjustments are injected into its own prompts; the daily scan sets new goals from new data."],
  ["Can citations be hallucinated?", "The validator re-checks every PMID and NCT ID against PubMed and ClinicalTrials.gov. Each citation is shown with a verified (✓) or unverified (✗) mark, and unverified citations lower the confidence score."],
  ["Why does a run take several minutes?", "A run makes ~13 sequential reasoning steps plus live API calls. LLM calls are queued one at a time to respect the provider's concurrency limit; interactive chat is given priority over background research."],
  ["Which reasoning engine is used?", "OpenAlz runs on swappable reasoning engines selectable in Settings: Standard (default), Advanced for deeper reasoning, Balanced for speed, and Explorer for long context. All agents share the selected engine."],
  ["Who builds OpenAlz?", "OpenAlz is an independent open-science project. Every report, citation and audit event is public inside the platform so anyone can inspect how a conclusion was reached."],
];

export default function Docs() {
  const [active, setActive] = useState("overview");
  const [runs, setRuns] = useState([]);
  const [insights, setInsights] = useState([]);
  const [q, setQ] = useState("");
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    api.get("/runs?status=completed&limit=200").then((r) => setRuns(r.data)).catch(() => {});
    api.get("/insights").then((r) => setInsights(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    const obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-20% 0px -70% 0px" });
    TOC.forEach(([id]) => { const el = document.getElementById(id); el && obs.observe(el); });
    if (window.location.hash) setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView(), 300);
    return () => obs.disconnect();
  }, []);

  const byRun = useMemo(() => insights.reduce((m, i) => ((m[i.run_id] = m[i.run_id] || []).push(i), m), {}), [insights]);
  const lib = runs.filter((r) => (r.goal + (byRun[r.id] || []).map((i) => i.title).join(" ")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-background" data-testid="docs-page">
      <SiteNav />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-10">
        <p className="label-xs text-primary">Documentation</p>
        <h1 className="font-display text-4xl sm:text-6xl font-normal tracking-tight mt-3 text-balance">The OpenAlz research foundry, explained.</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl leading-relaxed">Everything about how the platform works — from the self-evolving loop and the ten agents to scoring, ethics, the API — plus a live library of every research report the foundry has produced.</p>
      </div>

      {/* mobile TOC */}
      <div className="lg:hidden sticky top-16 z-30 bg-background/95 backdrop-blur border-y">
        <button onClick={() => setTocOpen(!tocOpen)} data-testid="docs-toc-toggle" className="w-full flex items-center justify-between px-4 py-3 text-sm">
          <span><span className="label-xs mr-2">On this page</span>{TOC.find((t) => t[0] === active)?.[1]}</span>
          <CaretDown size={14} className={`transition-transform ${tocOpen ? "rotate-180" : ""}`} />
        </button>
        {tocOpen && (
          <nav className="px-4 pb-3 grid grid-cols-2 gap-1">
            {TOC.map(([id, l]) => <a key={id} href={`#${id}`} onClick={() => setTocOpen(false)} className={`text-sm py-1.5 ${active === id ? "text-primary" : "text-muted-foreground"}`}>{l}</a>)}
          </nav>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[220px_1fr] gap-10 pb-20">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-0.5" data-testid="docs-toc">
            <div className="label-xs mb-3">On this page</div>
            {TOC.map(([id, l], i) => (
              <a key={id} href={`#${id}`} className={`flex gap-3 text-sm py-1.5 border-l-2 pl-3 transition-colors ${active === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <span className="font-mono text-[10px] mt-0.5">{String(i + 1).padStart(2, "0")}</span>{l}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <H id="overview" n={1}>Overview</H>
          <P><b>OpenAlz</b> is a long-horizon, agentic research platform for Alzheimer's disease (AD). A <b>Master Orchestrator</b> coordinates a swarm of specialised sub-agents that continuously read public biomedical data, generate falsifiable hypotheses, verify their own citations, debate one another, audit for bias and — crucially — learn from every cycle so the next one is better.</P>
          <P>OpenAlz is built as a single, transparent research service: one orchestrator, nine specialist agents, an ethical reasoning gateway, a bias detection service, an agent registry and an append-only audit trail — all reading five live public databases and writing to one shared evidence store.</P>
          <div className="grid sm:grid-cols-3 gap-3 my-6">
            {[["10", "specialised agents"], ["5", "live public data sources"], ["4", "self-evolution mechanisms"]].map(([n, l]) => (
              <div key={l} className="card-soft p-5"><div className="font-display text-4xl text-primary">{n}</div><div className="text-sm text-muted-foreground mt-1">{l}</div></div>
            ))}
          </div>

          <H id="quickstart" n={2}>Quick start</H>
          <ol className="space-y-3 mb-4">
            {[
              ["Open the foundry", <>Go to <Link className="text-primary" to="/app">/app</Link>. The Command Center shows live stats and the LLM queue.</>],
              ["Set or launch a goal", "Type a research goal (e.g. “TREM2 signalling and tau propagation”) and press Launch run — or create a long-horizon goal under Research Goals and press Pursue."],
              ["Watch the agents", "The run page streams every agent step; expand any step to see the raw evidence (PMIDs, NCT IDs, targets, pathways)."],
              ["Read the insights", "Each hypothesis shows novelty / confidence / rigor, verified citations, the debate, bias flags and suggested collaborators. Convene further debates from any insight."],
              ["Let it evolve", "Turn on Autonomous mode in Settings for daily scans, and let self-correction run every N runs. Inspect Strategy Memory to see what it learned."],
            ].map(([t, d], i) => (
              <li key={i} className="flex gap-4"><span className="font-mono text-xs w-7 h-7 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center">{i + 1}</span><div><div className="font-medium">{t}</div><p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{d}</p></div></li>
            ))}
          </ol>

          <H id="evolution" n={3}>How self-evolution works</H>
          <P>OpenAlz doesn't just answer — it changes itself. Four feedback mechanisms close the loop:</P>
          <Table head={["mechanism", "what happens", "effect on future runs"]} rows={[
            ["run debrief", "At the end of each run the orchestrator reviews validator scores, debate resolutions, the bias audit and failed agents, and distils three reusable lessons.", "The newest 12 lessons are injected into every agent's system prompt."],
            ["self-correction", "Every N completed runs (or on demand) the orchestrator reviews agent success/failure counters, recent failures, score distributions and current memory.", "Writes adaptations to memory, retires stale lessons, proposes new goals."],
            ["agent reflection", "Any agent can critique its own recent steps: strengths, weaknesses, a self-rating and concrete adjustments.", "Adjustments are injected into that agent's own instructions."],
            ["daily scan", "In autonomous mode the orchestrator wakes daily, reads the last 7 days of PubMed and trial updates, and sets or advances a goal.", "The research agenda follows new evidence without a human prompt."],
          ]} />
          <Code>{`Scan ─▶ Plan ─▶ Retrieve ─▶ Hypothesise ─▶ Debate ─▶ Audit ─▶ Learn
  ▲                                                          │
  └────────── strategy memory · reflections · goals ◀────────┘`}</Code>

          <H id="agents" n={4}>The agents</H>
          <Table head={["agent", "role", "grounded in"]} rows={[
            ["orchestrator", "Daily scans, goal setting, task decomposition, hypothesis synthesis, debate arbitration, self-correction.", "LLM reasoning"],
            ["literature_bridger", "Searches AD literature and an orchestrator-chosen adjacent field; finds mechanistic bridges and gaps.", "PubMed E-utilities"],
            ["biomarker_hunter", "Proposes fluid / imaging / genetic / digital biomarkers with evidence strength.", "PubMed + Open Targets"],
            ["drug_screener", "Shortlists clinical-stage and repurposable drugs; identifies untargeted genes.", "ChEMBL + Open Targets"],
            ["trial_optimizer", "Analyses trial landscape, failure patterns, endpoints and cohort gaps.", "ClinicalTrials.gov v2"],
            ["pathway_modeler", "Enriches the evidence gene set and models pathway crosstalk.", "Reactome Analysis Service"],
            ["data_harmonizer", "Unifies entities across agents; flags convergent signals & inconsistencies.", "All agent outputs"],
            ["hypothesis_validator", "Verifies citations, raises the strongest objection, scores novelty/confidence/rigor.", "PubMed + ClinicalTrials.gov"],
            ["collaboration_matchmaker", "Matches insights to real authors from retrieved papers.", "PubMed author records"],
            ["bias_detection", "Audits evidence, trial cohorts and hypotheses for bias; powers the Bias Portal.", "Trial demographics + text"],
          ].map(([k, ...r]) => [AGENT_META[k].name, ...r])} />

          <H id="sources" n={5}>Data sources</H>
          <Table head={["source", "used for", "endpoint"]} rows={[
            ["PubMed", "Literature search (5-year window; 7-day for daily scans), abstracts, authors, citation verification", "eutils.ncbi.nlm.nih.gov"],
            ["ClinicalTrials.gov", "AD trial landscape, enrollment, age & sex criteria, NCT verification", "clinicaltrials.gov/api/v2"],
            ["Open Targets", "Top AD (MONDO_0004975) target–disease associations", "api.platform.opentargets.org"],
            ["ChEMBL", "Drug indications for Alzheimer's disease", "ebi.ac.uk/chembl/api"],
            ["Reactome", "Pathway over-representation for the evidence gene set", "reactome.org/AnalysisService"],
          ]} />

          <H id="method" n={6}>Methodology & scoring</H>
          <P>For each run the orchestrator generates three hypotheses grounded <i>only</i> in identifiers present in the retrieved evidence. The Hypothesis Validator then scores each one:</P>
          <Table head={["score", "meaning", "notes"]} rows={[
            ["novelty", "How far the hypothesis is from prior art and from the foundry's own previous insights", "0–100"],
            ["confidence", "Strength and consistency of the cited evidence", "Penalised for unverified citations"],
            ["rigor", "Falsifiability and quality of the proposed validation experiment", "0–100"],
            ["verdict", "Final orchestrator ruling after arbitration", "accept · revise · reject"],
          ]} />
          <P>Citation verification: every PMID is checked with PubMed <code>esummary</code>; every NCT ID with the ClinicalTrials.gov API. Each citation is shown with ✓ or ✗ in the UI and report.</P>

          <H id="debate" n={7}>Multi-agent debate</H>
          <P>Debates happen inside every run (validator objection → proponent rebuttal → orchestrator resolution) and on demand from the Orchestrator page or any insight. An on-demand debate retrieves fresh PubMed evidence, then runs four turns — proponent (Literature Bridger), skeptic (Hypothesis Validator), rebuttal, counter — before the orchestrator rules <b>supported</b>, <b>contested</b> or <b>refuted</b> with a confidence and next steps. The verdict is attached to the insight's debate history.</P>

          <H id="ethics" n={8}>Privacy & ethics</H>
          <ul className="space-y-2 mb-4 text-[15px] text-foreground/85 list-disc pl-5">
            <li><b>No patient data.</b> Only public, aggregate sources are queried.</li>
            <li><b>Ethical LLM gateway.</b> Chat prompts are screened for prompt-injection patterns and PII (emails, phone numbers, SSNs are redacted before reaching the model); flags are shown to the user.</li>
            <li><b>Full audit trail.</b> Every step start/finish/failure, self-correction and debate resolution is logged.</li>
            <li><b>Bias detection.</b> Each run ends with a bias audit; anyone can submit text to the Bias Detection Portal.</li>
            <li><b>Limits.</b> LLMs can be wrong; abstracts are truncated; short gene symbols can match unrelated papers; scores are model judgements, not statistics. Not medical advice.</li>
          </ul>

          <H id="architecture" n={9}>Architecture</H>
          <Code>{`React (landing · /doc · /app)  ──HTTPS──▶  FastAPI /api
                                            ├─ orchestrator + 9 agents (asyncio tasks)
                                            ├─ priority LLM limiter (chat > research)
                                            ├─ autonomy: daily scan · self-correction · debates · reflection
                                            ├─ ethical gateway · bias detection · notifications
                                            └─ MongoDB: runs · insights · goals · learnings · audit_logs …
Platform cron (every 15 min) ──▶ /api/cron/tick ──▶ due schedules + autonomous daily scan`}</Code>
          <Table head={["component", "responsibility"]} rows={[
            ["orchestrator", "Run pipeline, daily scan, self-correction, debate arbitration"],
            ["specialist agents (9)", "Literature, biomarkers, chemistry, trials, pathways, harmonisation, validation, matchmaking, bias"],
            ["reasoning gateway", "Swappable engines, priority queue (chat before research), prompt-injection & PII screening, streaming"],
            ["bias detection", "Bias audit in every run plus the open Bias Detection Portal"],
            ["audit trail", "Append-only log of every step, decision and failure"],
            ["agent registry", "Capabilities, data sources, counters, self-ratings, reflections"],
            ["data layer", "Live public APIs: PubMed, ClinicalTrials.gov, Open Targets, ChEMBL, Reactome"],
            ["scheduler", "Background tasks plus a 15-minute platform tick for schedules and autonomy"],
          ]} />

          <H id="api" n={10}>API reference</H>
          <P>All routes are prefixed with <code>/api</code> and return JSON.</P>
          <Table head={["endpoint", "description"]} rows={API} />

          <H id="faq" n={11}>FAQ</H>
          <Accordion type="single" collapsible className="card-soft px-5 mb-4">
            {FAQ.map(([q2, a], i) => (
              <AccordionItem key={i} value={`f${i}`} className={i === FAQ.length - 1 ? "border-0" : ""}>
                <AccordionTrigger className="text-left text-sm sm:text-base">{q2}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <H id="library" n={12}>Research library</H>
          <P>Every completed research run, with its full report: goal, plan, evidence trail, hypotheses, debates, bias audit and lessons learned.</P>
          <div className="relative mb-4">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input data-testid="library-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports and hypotheses…" className="w-full rounded-full border bg-card pl-9 pr-4 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-3" data-testid="research-library">
            {lib.length === 0 && <p className="text-sm text-muted-foreground">No completed reports yet.</p>}
            {lib.map((r) => {
              const ins = byRun[r.id] || [];
              return (
                <Link key={r.id} to={`/doc/research/${r.id}`} data-testid={`library-item-${r.id}`} className="block card-soft p-5 hover:border-primary/40 transition-colors group">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium leading-snug">{r.goal}</h3>
                    <ArrowRight size={16} className="shrink-0 mt-1 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-2">{fmtDate(r.finished_at || r.created_at)} · {ins.length} hypotheses · {ins.filter((i) => i.verdict === "accept").length} accepted · {r.origin}{r.bias_risk && ` · bias ${r.bias_risk}`}</div>
                  {ins.length > 0 && <ul className="mt-3 space-y-1">{ins.map((i) => <li key={i.id} className="text-sm text-muted-foreground truncate">— {i.title}</li>)}</ul>}
                </Link>
              );
            })}
          </div>
        </article>
      </div>
      <SiteFooter />
    </div>
  );
}
