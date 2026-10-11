import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, ArrowSquareOut } from "@phosphor-icons/react";
import { api, fmtTime, agentName } from "@/lib/api";
import { SiteNav, SiteFooter } from "@/components/Site";
import { InsightCard } from "@/components/InsightCard";

const Sec = ({ n, title, children }) => (
  <section className="pt-10 border-t mt-10 first:mt-0 first:border-0 first:pt-0 break-inside-avoid-page">
    <p className="font-mono text-xs text-primary">{n}</p>
    <h2 className="font-display text-2xl sm:text-3xl font-medium tracking-tight mt-1 mb-4">{title}</h2>
    {children}
  </section>
);
const Li = ({ items }) => items?.length ? <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed">{items.map((x, i) => <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}</ul> : <p className="text-sm text-muted-foreground">—</p>;

export default function ResearchReport() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api.get(`/runs/${id}`).then((r) => setRun(r.data)).catch(() => setErr(true));
    api.get("/learnings").then((r) => setLessons(r.data.filter((l) => l.run_id === id)));
  }, [id]);

  const step = (agent, n = 0) => (run?.steps || []).filter((s) => s.agent === agent)[n]?.output || {};
  const lit = step("literature_bridger"), bio = step("biomarker_hunter"), drg = step("drug_screener"), tri = step("trial_optimizer");
  const pwy = step("pathway_modeler"), har = step("data_harmonizer"), bias = step("bias_detection");
  const papers = [...(lit.papers || []), ...(lit.bridge_papers || []), ...(bio.papers || [])];

  return (
    <div className="min-h-screen bg-background" data-testid="research-report-page">
      <div className="print:hidden"><SiteNav /></div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-20">
        <div className="flex items-center justify-between gap-3 mb-8 print:hidden">
          <Link to="/doc#library" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Research library</Link>
          {run && <div className="flex gap-2">
            <Link to={`/app/runs/${id}`} className="inline-flex items-center gap-1.5 text-xs border rounded-full px-3 py-1.5 hover:border-primary hover:text-primary"><ArrowSquareOut size={14} /> Open in app</Link>
            <button onClick={() => window.print()} data-testid="report-print-btn" className="inline-flex items-center gap-1.5 text-xs border rounded-full px-3 py-1.5 hover:border-primary hover:text-primary"><Printer size={14} /> Print / PDF</button>
          </div>}
        </div>
        {err && <p className="text-sm text-destructive">Report not found.</p>}
        {!run && !err && <p className="text-sm text-muted-foreground">Loading report…</p>}
        {run && (
          <>
            <p className="label-xs text-primary">OpenAlz research report · {run.id.slice(0, 8)}</p>
            <h1 className="font-display text-3xl sm:text-5xl font-normal tracking-tight mt-3 leading-tight text-balance" data-testid="report-title">{run.goal}</h1>
            <div className="font-mono text-[11px] text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-1">
              <span>status: {run.status}</span><span>origin: {run.origin}</span><span>started {fmtTime(run.started_at)}</span>{run.finished_at && <span>finished {fmtTime(run.finished_at)}</span>}
              <span>{run.steps.length} agent steps</span><span>{papers.length} papers · {(tri.trials || []).length} trials</span>{run.bias_risk && <span>bias risk: {run.bias_risk}</span>}
            </div>

            <div className="mt-10">
              <Sec n="01" title="Abstract">
                <p className="text-[15px] leading-[1.8]">{run.plan?.objective || "—"}</p>
                {run.plan?.rationale && <p className="text-sm text-muted-foreground leading-relaxed mt-3"><b>Rationale.</b> {run.plan.rationale}</p>}
                <div className="grid sm:grid-cols-3 gap-3 mt-5">
                  {[["Hypotheses", run.insights.length], ["Accepted", run.insights.filter((i) => i.verdict === "accept").length], ["Verified citations", run.insights.flatMap((i) => i.citations || []).filter((c) => c.verified).length]].map(([l, v]) => (
                    <div key={l} className="card-soft p-4"><div className="label-xs">{l}</div><div className="font-display text-3xl text-primary mt-1">{v}</div></div>
                  ))}
                </div>
              </Sec>
              <Sec n="02" title="Search strategy">
                <div className="overflow-x-auto card-soft"><table className="w-full text-sm min-w-[480px]"><tbody>
                  {[["PubMed (AD)", run.plan?.pubmed_query], ["Bridge field", `${run.plan?.bridge_field || "—"} · ${run.plan?.bridge_query || ""}`], ["Biomarkers", run.plan?.biomarker_query], ["Trials", run.plan?.trials_term], ["Drug focus", run.plan?.drug_focus]].map(([k, v]) => (
                    <tr key={k} className="border-b last:border-0"><td className="p-3 label-xs w-36">{k}</td><td className="p-3 font-mono text-xs break-words">{v || "—"}</td></tr>
                  ))}
                </tbody></table></div>
              </Sec>
              <Sec n="03" title="Hypotheses, debate & verdicts">
                <div className="space-y-4">{run.insights.map((i) => <InsightCard key={i.id} insight={i} readOnly />)}</div>
              </Sec>
              <Sec n="04" title="Evidence: literature">
                {lit.key_findings?.length > 0 && <><div className="label-xs mb-2">Key findings</div><Li items={lit.key_findings.map((f) => `${f.finding} [${(f.pmids || []).join(", ")}]`)} /></>}
                {lit.bridges?.length > 0 && <><div className="label-xs mt-5 mb-2">Cross-field bridges</div><Li items={lit.bridges.map((b) => b.connection)} /></>}
                {lit.gaps?.length > 0 && <><div className="label-xs mt-5 mb-2">Knowledge gaps</div><Li items={lit.gaps} /></>}
                <div className="label-xs mt-5 mb-2">Papers retrieved ({papers.length})</div>
                <ol className="space-y-1.5 text-sm">{papers.map((p) => <li key={p.pmid}><a href={p.url} target="_blank" rel="noreferrer" className="hover:text-primary"><span className="font-mono text-xs text-muted-foreground">PMID {p.pmid} · {p.journal} {p.year}</span> — {p.title}</a></li>)}</ol>
              </Sec>
              <Sec n="05" title="Biomarkers & drug candidates">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="card-soft p-4"><div className="label-xs mb-2">Biomarker candidates</div><Li items={(bio.candidates || []).map((c) => `${c.biomarker} (${c.type}, ${c.strength}) — ${c.evidence}`)} /></div>
                  <div className="card-soft p-4"><div className="label-xs mb-2">Drug shortlist</div><Li items={(drg.shortlist || []).map((d) => `${d.drug}${d.repurposing ? " (repurposing)" : ""} — ${d.rationale}`)} /></div>
                </div>
              </Sec>
              <Sec n="06" title="Clinical trial landscape">
                <p className="text-sm leading-relaxed mb-4">{tri.landscape || "—"}</p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div><div className="label-xs mb-2">Failure patterns</div><Li items={tri.failure_patterns} /></div>
                  <div><div className="label-xs mb-2">Design recommendations</div><Li items={tri.design_recommendations} /></div>
                  <div><div className="label-xs mb-2">Cohort gaps</div><Li items={tri.cohort_gaps} /></div>
                </div>
                <div className="label-xs mt-5 mb-2">Trials reviewed</div>
                <ol className="space-y-1.5 text-sm">{(tri.trials || []).map((t) => <li key={t.nct_id}><a href={t.url} target="_blank" rel="noreferrer" className="hover:text-primary"><span className="font-mono text-xs text-muted-foreground">{t.nct_id} · {t.status}</span> — {t.title}</a></li>)}</ol>
              </Sec>
              <Sec n="07" title="Pathway model & harmonised evidence">
                <p className="text-sm leading-relaxed mb-3">{pwy.model || "—"}</p>
                <Li items={(pwy.key_pathways || []).map((p) => `${p.name} (${p.id}) — ${p.role}`)} />
                <div className="grid md:grid-cols-2 gap-4 mt-5">
                  <div><div className="label-xs mb-2">Convergent signals</div><Li items={har.convergent_signals} /></div>
                  <div><div className="label-xs mb-2">Inconsistencies</div><Li items={har.inconsistencies} /></div>
                </div>
              </Sec>
              <Sec n="08" title="Bias audit">
                <p className="text-sm mb-3">Overall risk: <b className="uppercase">{bias.overall_risk || run.bias_risk || "—"}</b></p>
                <Li items={(bias.flags || []).map((f) => `${f.type} (${f.severity}): ${f.description} — correction: ${f.correction}`)} />
              </Sec>
              <Sec n="09" title="Lessons written to strategy memory">
                <Li items={lessons.map((l) => l.lesson)} />
              </Sec>
              <Sec n="10" title="Agent execution trace">
                <ol className="space-y-1 font-mono text-[11px]">{run.steps.map((s, i) => <li key={s.id} className="flex gap-3"><span className="text-muted-foreground w-6">{i + 1}</span><span className="w-40 shrink-0 truncate">{agentName(s.agent)}</span><span className="flex-1 min-w-0 truncate">{s.action}</span><span className={s.status === "done" ? "text-[hsl(var(--success))]" : "text-destructive"}>{s.status}</span></li>)}</ol>
              </Sec>
              <p className="text-[11px] text-muted-foreground mt-12 border-t pt-4">Generated autonomously by OpenAlz from public data. Hypotheses are not lab-validated and are not medical advice.</p>
            </div>
          </>
        )}
      </div>
      <div className="print:hidden"><SiteFooter /></div>
    </div>
  );
}
