import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, CircleNotch, Warning } from "@phosphor-icons/react";
import { api, fmtTime } from "@/lib/api";
import { PageHeader, StatusBadge, Empty, Btn } from "@/components/Common";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const SEV = { low: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.08)]", medium: "text-accent bg-accent/10", high: "text-destructive bg-destructive/10" };
const SAMPLE = "In our cohort of 412 participants recruited from two academic memory clinics in Boston (89% non-Hispanic white, mean education 16.8 years), plasma p-tau217 achieved an AUC of 0.96 for amyloid PET positivity. We therefore recommend p-tau217 as a universal screening tool for Alzheimer's disease in primary care worldwide.";

const Report = ({ r }) => {
  const x = r.result;
  if (!x) return null;
  return (
    <div className="space-y-5" data-testid="bias-report">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="label-xs">Bias score</div>
          <div className="font-display text-5xl">{x.overall_score}<span className="text-lg text-muted-foreground">/100</span></div>
        </div>
        <div><div className="label-xs">Overall risk</div><span className={`inline-block mt-1 font-mono text-xs uppercase rounded-full px-3 py-1 ${SEV[x.overall_risk]}`}>{x.overall_risk}</span></div>
        <div><div className="label-xs">Bias detected</div><div className="font-mono text-sm mt-1">{x.bias_detected ? "YES" : "NO"}</div></div>
      </div>
      <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 relative"><span className="absolute -top-1 w-4 h-4 rounded-full bg-card border-2 border-foreground" style={{ left: `calc(${x.overall_score}% - 8px)` }} /></div>
      <p className="text-sm leading-relaxed">{x.summary}</p>
      <div className="space-y-2">
        {x.categories?.map((c, i) => (
          <div key={i} className="border rounded-xl p-4">
            <div className="flex items-center gap-2"><Warning size={16} className="text-accent" /><b className="text-sm capitalize">{c.type}</b><span className={`ml-auto font-mono text-[10px] uppercase rounded-full px-2 py-0.5 ${SEV[c.severity]}`}>{c.severity}</span></div>
            <p className="text-sm mt-2">{c.evidence}</p>
            <p className="text-xs text-muted-foreground mt-1.5"><b>Correction:</b> {c.correction}</p>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><div className="label-xs mb-1">Recommendations</div><ul className="text-sm list-disc pl-5 space-y-1">{x.recommendations?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        <div><div className="label-xs mb-1">Mitigation strategies</div><ul className="text-sm list-disc pl-5 space-y-1">{x.mitigation_strategies?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
      </div>
    </div>
  );
};

export default function Bias() {
  const [content, setContent] = useState("");
  const [ctx, setCtx] = useState("");
  const [type, setType] = useState("research_text");
  const [list, setList] = useState([]);
  const [cur, setCur] = useState(null);

  const loadList = () => api.get("/bias/reports").then((r) => setList(r.data));
  useEffect(() => { loadList(); }, []);
  useEffect(() => {
    if (!cur || !["queued", "running"].includes(cur.status)) return;
    const t = setTimeout(() => api.get(`/bias/reports/${cur.id}`).then((r) => { setCur(r.data); if (!["queued", "running"].includes(r.data.status)) loadList(); }), 2500);
    return () => clearTimeout(t);
  }, [cur]);

  const submit = async () => {
    if (content.trim().length < 20) return toast.error("Paste at least 20 characters of content");
    const { data } = await api.post("/bias/detect", { content, content_type: type, context: ctx || null });
    setCur(data);
    loadList();
  };
  const open = (id) => api.get(`/bias/reports/${id}`).then((r) => setCur(r.data));

  return (
    <div data-testid="bias-page">
      <PageHeader eyebrow="Ethical AI & Transparency" title="Bias Detection Portal"
        lede="Submit any abstract, protocol, dataset description or agent output. The Bias Detection Service screens it for demographic, cohort, publication, confirmation, measurement and algorithmic bias and proposes corrections." />
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card-soft p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between"><span className="label-xs">Content to analyse</span><button onClick={() => setContent(SAMPLE)} data-testid="bias-sample-btn" className="text-xs text-primary">Use sample</button></div>
            <select value={type} onChange={(e) => setType(e.target.value)} data-testid="bias-type-select" className="w-full bg-background border rounded-lg text-sm px-3 py-2">
              <option value="research_text">Research text / abstract</option>
              <option value="trial_protocol">Clinical trial protocol</option>
              <option value="dataset_description">Dataset description</option>
              <option value="agent_output">Agent output / hypothesis</option>
            </select>
            <Textarea data-testid="bias-content-input" value={content} onChange={(e) => setContent(e.target.value)} rows={9} placeholder="Paste content here…" className="rounded-lg bg-background text-sm" />
            <Input data-testid="bias-context-input" value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder="Optional context (population, intended use)" className="rounded-lg" />
            <Btn data-testid="bias-submit-btn" onClick={submit} disabled={cur && ["queued", "running"].includes(cur.status)} className="w-full">
              {cur && ["queued", "running"].includes(cur.status) ? <><CircleNotch className="animate-spin" size={16} /> Analysing…</> : <><ShieldCheck size={16} /> Analyse for bias</>}
            </Btn>
          </div>
          <div className="card-soft overflow-hidden">
            <div className="label-xs p-4 pb-2">Previous reports</div>
            {list.length === 0 && <p className="px-4 pb-4 text-sm text-muted-foreground">None yet.</p>}
            {list.map((b) => (
              <button key={b.id} onClick={() => open(b.id)} data-testid={`bias-report-${b.id}`} className="w-full text-left px-4 py-3 border-t hover:bg-secondary/60 flex items-center gap-3">
                <div className="flex-1 min-w-0"><div className="text-xs truncate">{b.content_type.replace("_", " ")} · {b.result ? `score ${b.result.overall_score}` : b.status}</div><div className="font-mono text-[10px] text-muted-foreground">{fmtTime(b.created_at)}</div></div>
                <StatusBadge status={b.status} />
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-3 card-soft p-5 sm:p-7 min-h-[300px]">
          {!cur && <Empty>Your bias report will appear here.</Empty>}
          {cur && ["queued", "running"].includes(cur.status) && <div className="flex items-center gap-3 text-sm text-muted-foreground"><CircleNotch className="animate-spin" size={18} /> Bias Detection Service is analysing (≈15–40s)…</div>}
          {cur?.status === "failed" && <p className="text-sm text-destructive">{cur.error}</p>}
          {cur?.status === "completed" && <Report r={cur} />}
        </div>
      </div>
    </div>
  );
}
