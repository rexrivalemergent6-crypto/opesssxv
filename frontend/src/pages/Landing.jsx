import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, BookOpenText, ShieldCheck, Fingerprint, LockKey, Scales, ArrowsClockwise, Broadcast } from "@phosphor-icons/react";
import { api, AGENT_META, fmtDate, fmtRel } from "@/lib/api";
import { CellsCanvas, Gate, Reveal, CountUp, SiteNav, SiteFooter, SecHead, fingerprint, asciiBar } from "@/components/Site";
import { EXAMPLES } from "@/components/NewRunForm";
import { NeuronMark } from "@/components/Layout";

const NEURON = "https://images.unsplash.com/photo-1716833322990-acbeae5cc3eb?crop=entropy&cs=srgb&fm=jpg&q=80&w=1000";
const NEURON2 = "https://images.unsplash.com/photo-1748520109126-9e1ada959feb?crop=entropy&cs=srgb&fm=jpg&q=80&w=1000";

const ART = [
  "   .        ·            .             ·          .",
  "     literature ───╮",
  "     biomarkers ───┤",
  "      chemistry ───┼───▶ ●  orchestrator",
  "         trials ───┤",
  "       pathways ───╯",
  "   ·          .             ·            .        ·",
];

const LOOP = [
  { k: "Scan", d: "Wake daily, read the newest 7 days of PubMed and trial registry updates.", icon: Broadcast },
  { k: "Plan", d: "Set or advance a research goal; decompose it into sub-agent tasks.", icon: ArrowRight },
  { k: "Retrieve", d: "Five agents query live PubMed, ClinicalTrials.gov, Open Targets, ChEMBL and Reactome.", icon: ArrowRight },
  { k: "Hypothesise", d: "Harmonise evidence into one graph and synthesise falsifiable hypotheses.", icon: ArrowRight },
  { k: "Debate", d: "Validator verifies every citation, a skeptic attacks, the orchestrator arbitrates.", icon: Scales },
  { k: "Audit", d: "Bias Detection flags demographic, cohort and publication bias; collaborators are matched.", icon: ShieldCheck },
  { k: "Learn", d: "Lessons are written to strategy memory and self-correction retires what no longer works.", icon: ArrowsClockwise },
];

const METHOD = [
  ["novelty", "Hypothesis Validator", "distance from prior art & previous foundry insights", "0–100"],
  ["confidence", "Hypothesis Validator", "strength & consistency of cited evidence", "0–100"],
  ["rigor", "Hypothesis Validator", "falsifiability and quality of the proposed validation", "0–100"],
  ["citations", "PubMed · ClinicalTrials.gov", "every PMID / NCT ID re-checked against the registry", "✓ / ✗"],
  ["verdict", "Master Orchestrator", "debate resolution: accept · revise · reject", "—"],
  ["bias", "Bias Detection Service", "demographic, cohort, publication, confirmation bias", "low–high"],
];

/* hero visual: orchestrator with orbiting agents */
const Orbit = () => {
  const ks = Object.keys(AGENT_META).filter((k) => k !== "orchestrator");
  return (
    <div className="relative w-full max-w-[420px] aspect-square mx-auto" aria-hidden="true">
      <div className="absolute inset-[6%] rounded-full border border-dashed border-primary/25 spin-slow" />
      <div className="absolute inset-[22%] rounded-full border border-primary/15" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
        {ks.map((k, i) => {
          const a = (i / ks.length) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(a) * 40, y = 50 + Math.sin(a) * 40;
          return <line key={k} x1="50" y1="50" x2={x} y2={y} stroke={AGENT_META[k].hex} strokeOpacity="0.35" strokeWidth="0.35" strokeDasharray="1.2 1.2">
            <animate attributeName="stroke-dashoffset" from="0" to="-12" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" />
          </line>;
        })}
      </svg>
      {ks.map((k, i) => {
        const a = (i / ks.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <motion.div key={k} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${50 + Math.cos(a) * 40}%`, top: `${50 + Math.sin(a) * 40}%` }}
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.08 }}>
            <span className="w-3.5 h-3.5 rounded-full ring-4 ring-background shadow floaty" style={{ background: AGENT_META[k].hex, animationDelay: `${i * 0.4}s` }} />
            <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground mt-1 whitespace-nowrap">{AGENT_META[k].short}</span>
          </motion.div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary grid place-items-center shadow-xl shadow-primary/30">
          <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
          <NeuronMark className="relative w-10 h-10 sm:w-12 sm:h-12 bg-white spin-slow" />
        </div>
        <div className="font-mono text-[10px] text-muted-foreground mt-2">orchestrator</div>
      </div>
    </div>
  );
};

/* live terminal fed by the audit trail */
const Terminal = () => {
  const [logs, setLogs] = useState([]);
  const [typed, setTyped] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const box = useRef(null);
  useEffect(() => {
    const load = () => api.get("/audit?limit=14").then((r) => setLogs(r.data.slice().reverse())).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  const last = logs.at(-1);
  const lastLine = last ? `${AGENT_META[last.agent]?.short || last.agent}: ${last.action.toLowerCase()}` : "idle: waiting for a research goal";
  useEffect(() => {
    let i = 0;
    setTyped("");
    const t = setInterval(() => { i++; setTyped(lastLine.slice(0, i)); if (i >= lastLine.length) clearInterval(t); }, 18);
    return () => clearInterval(t);
  }, [lastLine]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [typed]);

  const run = async (g) => {
    const v = (g ?? goal).trim();
    if (v.length < 5) return toast.error("Give the foundry a research goal (5+ characters)");
    setBusy(true);
    try {
      const { data } = await api.post("/runs", { goal: v });
      toast.success("Orchestrator dispatched");
      nav(`/app/runs/${data.id}`);
    } catch { toast.error("Could not start run"); setBusy(false); }
  };

  return (
    <div className="card-soft overflow-hidden" data-testid="live-terminal">
      <div className="flex items-center justify-between px-4 h-10 border-b bg-secondary/50 font-mono text-[11px]">
        <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary pulse-dot" /> openalz</span>
        <span className="text-muted-foreground">{last ? `live · ${fmtRel(last.timestamp)}` : "live"}</span>
      </div>
      <div ref={box} className="font-mono text-[11px] sm:text-xs leading-relaxed p-4 h-[300px] sm:h-[340px] overflow-y-auto bg-card">
        {ART.map((l, i) => <pre key={i} className="text-primary/60 whitespace-pre overflow-hidden">{l}</pre>)}
        <div className="h-3" />
        {logs.slice(0, -1).map((l) => (
          <p key={l.id} className="text-muted-foreground"><span className="text-primary/70">&lt;{AGENT_META[l.agent]?.short || l.agent}&gt;</span> {l.action.toLowerCase()}</p>
        ))}
        <p><span className="text-primary">&lt;openalz&gt;</span> <span className="caret">{typed}</span></p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex items-center gap-2 border-t px-3 sm:px-4 py-2.5 font-mono text-sm">
        <span className="text-primary">$</span>
        <input data-testid="terminal-goal-input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="a research goal, e.g. TREM2 and tau spread"
          className="flex-1 min-w-0 bg-transparent outline-none text-base sm:text-sm placeholder:text-muted-foreground/70" />
        <button data-testid="terminal-run-btn" disabled={busy} className="rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-xs disabled:opacity-50">{busy ? "…" : "run"}</button>
      </form>
    </div>
  );
};

export default function Landing() {
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState([]);
  const [lessons, setLessons] = useState([]);
  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/insights").then((r) => setInsights(r.data)).catch(() => {});
    api.get("/learnings").then((r) => setLessons(r.data)).catch(() => {});
  }, []);

  const funnel = useMemo(() => {
    const t = insights.length;
    const survived = insights.filter((i) => i.verdict !== "reject").length;
    const acc = insights.filter((i) => i.verdict === "accept").length;
    const verified = insights.filter((i) => i.citations?.length && i.citations.every((c) => c.verified)).length;
    const novel = insights.filter((i) => (i.novelty || 0) >= 70).length;
    const rows = [
      [t, "hypotheses generated from live literature, trials, targets & pathways"],
      [verified, "with every cited PMID / NCT ID verified against the registry"],
      [survived, "survived adversarial debate (accept or revise)"],
      [novel, "scored novelty ≥ 70 by the validator"],
      [acc, "accepted by the orchestrator after arbitration"],
    ];
    return rows.map(([n, lab]) => ({ n, lab, w: t ? Math.max(6, (Math.log(n + 1) / Math.log(t + 1)) * 100) : 6 }));
  }, [insights]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden" data-testid="landing-page">
      <Gate />
      <SiteNav />

      {/* HERO */}
      <section className="relative pt-24 sm:pt-28 pb-16 sm:pb-20">
        <div className="absolute inset-0 -z-0"><CellsCanvas /></div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="label-xs text-primary">Self-evolving Alzheimer's research foundry</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}
              className="font-display text-[2.4rem] leading-[1.05] sm:text-6xl lg:text-[4.1rem] font-normal tracking-tight mt-4 text-balance" data-testid="hero-title">
              Ten AI agents working on Alzheimer's disease, <em className="text-primary">in public.</em>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="text-base sm:text-lg text-muted-foreground mt-6 max-w-xl leading-relaxed">
              Give it a research goal. A Master Orchestrator dispatches specialised agents to five live public databases, synthesises falsifiable hypotheses,
              verifies every citation, debates itself, audits for bias, and writes what it learned into a memory that rewrites its own strategy.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link to="/app" data-testid="hero-open-app" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3.5 text-sm font-medium shadow-lg shadow-primary/25 hover:gap-3 transition-all">Open the foundry <ArrowRight size={16} /></Link>
              <Link to="/doc" data-testid="hero-docs" className="inline-flex items-center justify-center gap-2 rounded-full border bg-card px-6 py-3.5 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors"><BookOpenText size={16} /> Read the research docs</Link>
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="font-mono text-[11px] sm:text-xs text-muted-foreground mt-7" data-testid="hero-ticker">
              {stats ? `${stats.runs_completed} runs completed · ${stats.insights_total} hypotheses · ${stats.learnings_total} lessons learned · ${stats.runs_active} running now` : "connecting to the foundry…"}
            </motion.p>
          </div>
          <div className="lg:col-span-5"><Orbit /></div>
        </div>

        {/* funnel */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 mt-14">
          <Reveal>
            <div className="card-soft p-5 sm:p-7" data-testid="hero-funnel">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5"><span className="label-xs">Where the hypotheses stand</span><span className="font-mono text-[10px] text-muted-foreground">live from the database · log-scaled bars</span></div>
              <ol className="space-y-3.5">
                {funnel.map((f, i) => (
                  <li key={i} className="grid grid-cols-[56px_1fr] sm:grid-cols-[80px_1fr] gap-3 sm:gap-4 items-center">
                    <span className="font-mono text-xl sm:text-2xl font-semibold text-right"><CountUp to={f.n} /></span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm text-foreground/80 leading-snug">{f.lab}</div>
                      <div className="h-1.5 mt-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400" initial={{ width: 0 }} whileInView={{ width: `${f.w}%` }} viewport={{ once: true }} transition={{ duration: 1.2, delay: i * 0.12 }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="font-mono text-[10px] text-muted-foreground mt-5">{lessons.length} lessons in strategy memory · <Link to="/doc#method" className="text-primary">how scoring works</Link></p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* data source marquee */}
      <div className="border-y bg-card overflow-hidden py-4" aria-hidden="true">
        <div className="marquee flex gap-12 whitespace-nowrap w-max font-mono text-xs text-muted-foreground">
          {Array(2).fill(["PubMed E-utilities", "ClinicalTrials.gov API v2", "Open Targets Platform", "ChEMBL", "Reactome Analysis Service", "Swappable OpenAlz reasoning engines", "Append-only audit trail", "Bias Detection Service", "Open science"]).flat().map((s, i) => (
            <span key={i} className="inline-flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-primary/60" />{s}</span>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* 01 LIVE */}
        <section className="py-16 sm:py-24 grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <SecHead num="01" title="Live" id="live">
              This is the foundry working, as it happens — every line below is streamed from the append-only audit trail.
              Type a research goal and the Master Orchestrator will plan it, dispatch the swarm and stream each step to you.
            </SecHead>
            <Reveal delay={0.1}>
              <div className="mt-6 space-y-2">
                <div className="label-xs">Try a goal</div>
                {EXAMPLES.map((e, i) => <p key={i} className="font-mono text-xs text-muted-foreground">→ {e}</p>)}
              </div>
            </Reveal>
          </div>
          <div className="lg:col-span-7"><Reveal delay={0.1}><Terminal /></Reveal></div>
        </section>

        {/* 02 LOOP */}
        <section className="py-16 sm:py-20 border-t">
          <SecHead num="02" title="The self-evolving loop" id="loop">
            Most research tools answer a question and forget. OpenAlz runs a long-horizon loop: every cycle ends by changing how the next one behaves.
          </SecHead>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {LOOP.map((s, i) => (
              <Reveal key={s.k} delay={i * 0.06}>
                <div className={`card-soft p-5 h-full relative overflow-hidden group hover:border-primary/40 transition-colors ${i === 6 ? "lg:col-span-1 bg-primary text-primary-foreground border-primary" : ""}`}>
                  <span className={`font-mono text-[11px] ${i === 6 ? "text-primary-foreground/70" : "text-primary"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-lg font-semibold mt-2">{s.k}</h3>
                  <p className={`text-sm mt-2 leading-relaxed ${i === 6 ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{s.d}</p>
                  <s.icon size={64} weight="thin" className={`absolute -right-3 -bottom-3 opacity-10 group-hover:opacity-20 transition-opacity`} />
                </div>
              </Reveal>
            ))}
            <Reveal delay={0.45}>
              <div className="border border-dashed rounded-xl p-5 h-full grid place-items-center text-center">
                <p className="font-mono text-xs text-muted-foreground">↻ repeat daily<br />in autonomous mode</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 03 SWARM */}
        <section className="py-16 sm:py-20 border-t">
          <SecHead num="03" title="The swarm" id="swarm">
            Ten agents with distinct expertise, each registered with the Agent Registry, each grounded in a real data source, each able to reflect on its own failures.
          </SecHead>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border">
            {[
              ["orchestrator", "Plans daily scans, coordinates the swarm, arbitrates debates and runs self-correction.", "OpenAlz reasoning engine"],
              ["literature_bridger", "Bridges AD literature with an adjacent field to surface non-obvious mechanisms.", "PubMed"],
              ["biomarker_hunter", "Finds fluid, imaging, genetic and digital biomarker candidates.", "PubMed + Open Targets"],
              ["drug_screener", "Screens clinical-stage and repurposable compounds against AD targets.", "ChEMBL + Open Targets"],
              ["trial_optimizer", "Reads the trial landscape for failure patterns, endpoints and cohort gaps.", "ClinicalTrials.gov"],
              ["pathway_modeler", "Runs pathway enrichment over the evidence gene set and models crosstalk.", "Reactome"],
              ["data_harmonizer", "Reconciles entities across sources into one evidence graph; flags inconsistencies.", "All sources"],
              ["hypothesis_validator", "Verifies every citation and argues the skeptic's case before scoring.", "PubMed + CT.gov"],
              ["collaboration_matchmaker", "Matches each insight to real researchers from retrieved author records.", "PubMed authors"],
              ["bias_detection", "Detects demographic, cohort, publication and confirmation bias; proposes fixes.", "Trial cohorts + text"],
            ].map(([k, d, src], i) => (
              <Reveal key={k} delay={(i % 3) * 0.06} className={`bg-card ${i === 0 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
                <div className="p-5 sm:p-6 h-full hover:bg-secondary/40 transition-colors">
                  <div className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: AGENT_META[k].hex }} /><h3 className="font-semibold">{AGENT_META[k].name}</h3></div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{d}</p>
                  <p className="font-mono text-[10px] text-primary mt-3">{src}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 04 BACKGROUND */}
        <section className="py-16 sm:py-20 border-t grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <SecHead num="04" title="Why this matters" id="background">
              <p>Alois Alzheimer described the disease in 1906. More than a century later, over 55 million people live with dementia, and the first
                anti-amyloid antibodies approved in 2023–2024 slow decline modestly — they do not stop it.</p>
              <p className="mt-4">The evidence needed for the next breakthrough is scattered across millions of papers, thousands of trials and dozens of databases.
                No single researcher can read it all. A swarm of agents that reads continuously, argues with itself, and remembers what failed can help humans decide what to test next.</p>
            </SecHead>
          </div>
          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 gap-3">
              <figure className="card-soft overflow-hidden"><img src={NEURON} alt="Stained motor neuron under a microscope" className="w-full aspect-[4/5] object-cover grayscale-[30%]" loading="lazy" /><figcaption className="font-mono text-[10px] text-muted-foreground p-3">A stained neuron. AD destroys these cells years before symptoms.</figcaption></figure>
              <figure className="card-soft overflow-hidden mt-10"><img src={NEURON2} alt="Glowing neurons with connected dendrites" className="w-full aspect-[4/5] object-cover" loading="lazy" /><figcaption className="font-mono text-[10px] text-muted-foreground p-3">Connections — synapses — are lost first.</figcaption></figure>
            </div>
          </Reveal>
        </section>

        {/* 05 METHOD */}
        <section className="py-16 sm:py-20 border-t">
          <SecHead num="05" title="Method" id="method">
            Every hypothesis is scored by an adversarial validator, checked against the source registries, and arbitrated by the orchestrator. Unverified citations are penalised.
          </SecHead>
          <Reveal delay={0.1}>
            <div className="mt-8 card-soft overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr className="text-left border-b">{["score", "assigned by", "measures", "range"].map((h) => <th key={h} className="label-xs p-4">{h}</th>)}</tr></thead>
                <tbody>{METHOD.map((r) => <tr key={r[0]} className="border-b last:border-0"><td className="p-4 font-mono text-primary">{r[0]}</td><td className="p-4">{r[1]}</td><td className="p-4 text-muted-foreground">{r[2]}</td><td className="p-4 font-mono text-right">{r[3]}</td></tr>)}</tbody>
              </table>
            </div>
          </Reveal>
        </section>

        {/* 06 NOTEBOOK */}
        <section className="py-16 sm:py-20 border-t">
          <SecHead num="06" title="Notebook" id="notebook">
            The newest hypotheses, straight from the database. Each one links to a full research report with its evidence trail, debate and bias audit.
          </SecHead>
          <div className="mt-10 grid md:grid-cols-2 gap-4" data-testid="landing-insights">
            {insights.length === 0 && <p className="text-sm text-muted-foreground">No hypotheses yet — launch the first run above.</p>}
            {insights.slice(0, 6).map((i, k) => (
              <Reveal key={i.id} delay={(k % 2) * 0.08}>
                <article className="card-soft p-5 sm:p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-snug">{i.title}</h3>
                    <span className={`shrink-0 font-mono text-[10px] uppercase rounded-full px-2 py-0.5 border ${i.verdict === "accept" ? "text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]" : i.verdict === "reject" ? "text-destructive border-destructive/30" : "text-accent border-accent/30"}`}>{i.verdict}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-4">{i.statement}</p>
                  <pre className="font-mono text-[11px] text-primary/80 mt-4 leading-relaxed overflow-hidden">{`novelty    ${asciiBar(i.novelty)}  ${i.novelty}\nconfidence ${asciiBar(i.confidence)}  ${i.confidence}\nrigor      ${asciiBar(i.rigor)}  ${i.rigor}`}</pre>
                  <div className="flex items-center justify-between mt-auto pt-4 font-mono text-[10px] text-muted-foreground">
                    <span>{i.citations?.filter((c) => c.verified).length}/{i.citations?.length} citations verified · {fmtDate(i.created_at)}</span>
                    <Link to={`/doc/research/${i.run_id}`} className="text-primary hover:underline">report →</Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 07 RECEIPTS */}
        <section className="py-16 sm:py-20 border-t">
          <SecHead num="07" title="Receipts of what it learned" id="receipts">
            After every run, and in every self-correction cycle, the foundry prints a lesson. The newest twelve are injected into every agent on the next run.
            Each receipt carries a fingerprint of the lesson and the one before it.
          </SecHead>
          <div className="mt-10 flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x" data-testid="landing-receipts">
            {lessons.length === 0 && <p className="text-sm text-muted-foreground">No lessons yet.</p>}
            {lessons.slice(0, 10).map((l, k) => {
              const n = lessons.length - k;
              const prev = lessons[k + 1];
              return (
                <Reveal key={l.id} delay={Math.min(k, 4) * 0.06} className="snap-start shrink-0 w-[270px] sm:w-[300px]">
                  <div className="bg-card border rounded-sm p-5 font-mono text-[11px] leading-relaxed shadow-sm h-full" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 23px, hsl(var(--border)/0.4) 24px)" }}>
                    <div className="flex justify-between"><b>OPENALZ · LESSON</b><span>no. {String(n).padStart(4, "0")}</span></div>
                    <div className="text-muted-foreground">{fmtDate(l.created_at)}</div>
                    <hr className="my-3 border-dashed" />
                    <p className="text-foreground text-xs leading-relaxed font-sans">{l.lesson}</p>
                    <hr className="my-3 border-dashed" />
                    <div className="text-muted-foreground">source: {l.source === "self_correction" ? "self-correction" : "run debrief"}</div>
                    <div className="mt-3 inline-block border-2 border-primary text-primary px-2 py-0.5 -rotate-3 font-bold">IN MEMORY</div>
                    <div className="mt-3 text-muted-foreground break-all">{fingerprint(l.lesson)}<br />follows {prev ? fingerprint(prev.lesson).slice(0, 12) : "genesis"}… ✓</div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* 08 ETHICS */}
        <section className="py-16 sm:py-20 border-t">
          <SecHead num="08" title="Ethics, privacy & limits" id="ethics" />
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              [LockKey, "Privacy-preserving", "Only public, aggregate data is used. No patient-level data is ever read or moved. Prompts pass PII redaction."],
              [Fingerprint, "Full audit trail", "Every decision, step and reasoning output is written to an append-only log you can inspect."],
              [ShieldCheck, "Bias detection", "A dedicated agent audits evidence and hypotheses for demographic, cohort and publication bias."],
              [Scales, "Honest limits", "Nothing here is lab-validated or medical advice. Hypotheses are starting points for human scientists."],
            ].map(([I, t, d], k) => (
              <Reveal key={t} delay={k * 0.06}><div className="card-soft p-5 h-full"><I size={26} weight="duotone" className="text-primary" /><h3 className="font-semibold mt-3">{t}</h3><p className="text-sm text-muted-foreground mt-2 leading-relaxed">{d}</p></div></Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-8 sm:p-14">
              <div className="absolute inset-0 opacity-40"><CellsCanvas density={0.5} /></div>
              <div className="relative max-w-2xl">
                <h2 className="font-display text-3xl sm:text-5xl font-normal tracking-tight text-balance">Put the swarm to work on your question.</h2>
                <p className="mt-4 text-primary-foreground/85 leading-relaxed">Open the foundry, set a goal and watch ten agents plan, retrieve, debate and learn — or read the full documentation and research library first.</p>
                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <Link to="/app" data-testid="cta-open-app" className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-primary px-6 py-3.5 text-sm font-medium hover:gap-3 transition-all">Open the foundry <ArrowRight size={16} /></Link>
                  <Link to="/doc" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-3.5 text-sm font-medium hover:bg-white/10"><BookOpenText size={16} /> Documentation</Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
