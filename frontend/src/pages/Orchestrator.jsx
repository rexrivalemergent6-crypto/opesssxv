import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Broadcast, ArrowsClockwise, Scales, StopCircle, CircleNotch, CaretDown } from "@phosphor-icons/react";
import { api, fmtTime, fmtRel, agentName } from "@/lib/api";
import { PageHeader, StatusBadge, Empty, Btn } from "@/components/Common";
import { Input } from "@/components/ui/input";

const VERD = { supported: "text-[hsl(var(--success))]", contested: "text-accent", refuted: "text-destructive" };
const HEALTH = { good: "bg-[hsl(var(--success))]", watch: "bg-accent", poor: "bg-destructive" };

const DebateCard = ({ d, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-soft overflow-hidden" data-testid={`debate-${d.id}`}>
      <button onClick={() => setOpen(!open)} className="w-full text-left p-4 sm:p-5 flex items-start gap-3 hover:bg-secondary/50">
        <Scales size={20} className="text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-snug">{d.topic}</div>
          <div className="font-mono text-[11px] text-muted-foreground mt-1">{d.turns?.length || 0}/4 turns · {fmtRel(d.created_at)}
            {d.resolution && <> · <span className={`uppercase ${VERD[d.resolution.verdict]}`}>{d.resolution.verdict}</span> ({d.resolution.confidence})</>}</div>
        </div>
        <StatusBadge status={d.status} />
        <CaretDown size={14} className={`shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t p-4 sm:p-5 space-y-3">
          {d.turns?.map((t, i) => (
            <div key={i} className={`rounded-xl p-4 text-sm rise ${t.role === "proponent" ? "bg-primary/5 border border-primary/20 sm:mr-10" : "bg-accent/5 border border-accent/20 sm:ml-10"}`}>
              <div className="label-xs mb-1">{t.role} · {agentName(t.agent)}</div>
              <p className="leading-relaxed">{t.argument}</p>
              {t.points?.length > 0 && <ul className="mt-2 space-y-1">{t.points.map((p, k) => <li key={k} className="text-xs text-muted-foreground">• {p.claim} {p.pmids?.length > 0 && <span className="font-mono">[{p.pmids.join(", ")}]</span>}</li>)}</ul>}
            </div>
          ))}
          {d.status === "running" && <div className="text-xs text-muted-foreground inline-flex items-center gap-2"><CircleNotch className="animate-spin" size={14} /> Next argument in progress…</div>}
          {d.resolution && (
            <div className="rounded-xl border-2 border-primary/30 p-4">
              <div className="label-xs mb-1">Orchestrator resolution</div>
              <div className={`font-display text-2xl capitalize ${VERD[d.resolution.verdict]}`}>{d.resolution.verdict} <span className="font-mono text-sm text-muted-foreground">confidence {d.resolution.confidence}</span></div>
              <p className="text-sm mt-2 leading-relaxed">{d.resolution.summary}</p>
              {d.resolution.next_steps?.length > 0 && <><div className="label-xs mt-3 mb-1">Next steps</div><ul className="text-sm list-disc pl-5 space-y-1">{d.resolution.next_steps.map((s, k) => <li key={k}>{s}</li>)}</ul></>}
            </div>
          )}
          {d.evidence?.length > 0 && <div className="flex flex-wrap gap-1.5">{d.evidence.map((e) => <a key={e.pmid} href={e.url} target="_blank" rel="noreferrer" className="font-mono text-[10px] border rounded-full px-2 py-0.5 hover:text-primary">PMID {e.pmid}</a>)}</div>}
          {d.error && <p className="text-xs text-destructive">{d.error}</p>}
        </div>
      )}
    </div>
  );
};

export default function Orchestrator() {
  const [params] = useSearchParams();
  const focus = params.get("debate");
  const [runs, setRuns] = useState([]);
  const [corr, setCorr] = useState([]);
  const [debates, setDebates] = useState([]);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState("");
  const nav = useNavigate();

  const load = () => {
    api.get("/runs?limit=100").then((r) => setRuns(r.data.filter((x) => ["queued", "running"].includes(x.status))));
    api.get("/orchestrator/self-corrections").then((r) => setCorr(r.data));
    api.get("/debates").then((r) => setDebates(r.data));
  };
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);

  const act = async (k, fn) => { setBusy(k); try { await fn(); } catch (e) { toast.error(e.response?.data?.detail || "Action failed"); } setBusy(""); load(); };
  const scan = () => act("scan", async () => { const { data } = await api.post("/orchestrator/daily-scan"); toast.success("Daily scan initiated"); nav(`/app/runs/${data.id}`); });
  const correct = () => act("corr", async () => { await api.post("/orchestrator/self-correction"); toast.success("Self-correction cycle started"); });
  const debate = () => act("deb", async () => {
    if (topic.trim().length < 5) throw { response: { data: { detail: "Enter a debate motion" } } };
    await api.post("/debates", { topic: topic.trim() }); setTopic(""); toast.success("Debate convened");
  });
  const cancel = (id) => act("c" + id, async () => { await api.post(`/runs/${id}/cancel`); toast.success("Task cancelled"); });

  return (
    <div data-testid="orchestrator-page">
      <PageHeader eyebrow="Advanced Orchestrator Controls" title="Master Orchestrator"
        lede="Wake the foundry for a daily scan, force a long-horizon self-correction cycle, convene multi-agent debates and cancel running tasks." />

      <div className="grid md:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <div className="card-soft p-5 sm:p-6 flex flex-col">
          <Broadcast size={26} className="text-primary" weight="duotone" />
          <h3 className="font-semibold mt-3">Daily scan</h3>
          <p className="text-sm text-muted-foreground mt-1 flex-1">Scans the newest 7 days of PubMed and trial updates, sets its own goal and runs the full pipeline.</p>
          <Btn data-testid="daily-scan-btn" onClick={scan} disabled={busy === "scan"} className="mt-4 self-start">{busy === "scan" && <CircleNotch className="animate-spin" size={14} />}Initiate daily scan</Btn>
        </div>
        <div className="card-soft p-5 sm:p-6 flex flex-col">
          <ArrowsClockwise size={26} className="text-accent" weight="duotone" />
          <h3 className="font-semibold mt-3">Self-correction</h3>
          <p className="text-sm text-muted-foreground mt-1 flex-1">Reviews failures, scores and bias, writes adaptations to memory, retires stale lessons and proposes goals.</p>
          <Btn data-testid="self-correction-btn" onClick={correct} disabled={busy === "corr" || corr.some((c) => ["queued", "running"].includes(c.status))} className="mt-4 self-start">
            {corr.some((c) => ["queued", "running"].includes(c.status)) ? <><CircleNotch className="animate-spin" size={14} /> Correcting…</> : "Initiate self-correction"}</Btn>
        </div>
        <div className="card-soft p-5 sm:p-6 flex flex-col">
          <Scales size={26} className="text-violet-500" weight="duotone" />
          <h3 className="font-semibold mt-3">Resolve a debate</h3>
          <p className="text-sm text-muted-foreground mt-1">Proponent vs skeptic over live PubMed evidence, arbitrated by the orchestrator.</p>
          <div className="flex gap-2 mt-4">
            <Input data-testid="debate-topic-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Motion, e.g. GLP-1 agonists slow AD" className="rounded-lg flex-1 min-w-0" />
            <Btn data-testid="debate-start-btn" onClick={debate} disabled={busy === "deb"} className="!px-4">Go</Btn>
          </div>
        </div>
      </div>

      <section className="mb-10">
        <div className="label-xs mb-3">Active tasks ({runs.length})</div>
        {runs.length === 0 ? <Empty testid="active-tasks-empty">No tasks running. Launch a run, goal or daily scan.</Empty> : (
          <div className="card-soft overflow-hidden" data-testid="active-tasks">
            {runs.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3.5 border-b last:border-0">
                <Link to={`/app/runs/${r.id}`} className="flex-1 text-sm hover:text-primary">{r.goal}</Link>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">{r.origin}</span>
                  <StatusBadge status={r.status} />
                  <Btn variant="danger" data-testid={`cancel-task-${r.id}`} onClick={() => cancel(r.id)} className="!py-1 !px-3 text-xs"><StopCircle size={14} /> Cancel</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid xl:grid-cols-2 gap-8">
        <section>
          <div className="label-xs mb-3">Multi-agent debates</div>
          <div className="space-y-3" data-testid="debate-list">
            {debates.length === 0 && <Empty>No debates yet.</Empty>}
            {debates.map((d) => <DebateCard key={d.id} d={d} defaultOpen={d.id === focus || d.status === "running"} />)}
          </div>
        </section>
        <section>
          <div className="label-xs mb-3">Self-correction history</div>
          <div className="space-y-3" data-testid="correction-list">
            {corr.length === 0 && <Empty>No self-correction cycles yet. They also run automatically after every N completed runs (Settings).</Empty>}
            {corr.map((c) => (
              <div key={c.id} className="card-soft p-4 sm:p-5" data-testid={`correction-${c.id}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-[11px] text-muted-foreground">{fmtTime(c.created_at)} · {c.trigger}</span><StatusBadge status={c.status} /></div>
                {c.result && (
                  <div className="mt-3 space-y-3 text-sm">
                    <p className="leading-relaxed">{c.result.diagnosis}</p>
                    {c.result.performance_assessment?.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-2">{c.result.performance_assessment.map((p, k) => (
                        <div key={k} className="text-xs border rounded-lg p-2.5"><span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${HEALTH[p.health] || "bg-muted"}`} /><b>{agentName(p.agent)}</b><p className="text-muted-foreground mt-1">{p.assessment}</p></div>
                      ))}</div>
                    )}
                    <div><div className="label-xs mb-1">Adaptations written to memory</div><ul className="list-disc pl-5 space-y-1">{c.result.adaptations?.map((a, k) => <li key={k}>{a}</li>)}</ul></div>
                    {c.result.proposed_goals?.length > 0 && <div><div className="label-xs mb-1">Proposed goals</div><ul className="list-disc pl-5 space-y-1">{c.result.proposed_goals.map((g, k) => <li key={k}>{g.goal}</li>)}</ul><Link to="/app/goals" className="text-xs text-primary">Review in Goals →</Link></div>}
                    {c.retired?.length > 0 && <div className="font-mono text-[11px] text-muted-foreground">{c.retired.length} stale lesson(s) retired</div>}
                  </div>
                )}
                {c.error && <p className="text-xs text-destructive mt-2">{c.error}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
