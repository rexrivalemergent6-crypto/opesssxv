import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Star, CaretDown, Warning, Scales, CheckCircle, XCircle } from "@phosphor-icons/react";
import { api } from "@/lib/api";

const Score = ({ label, v, testid }) => (
  <div data-testid={testid} className="min-w-[90px]">
    <div className="label-xs">{label}</div>
    <div className="flex items-center gap-2 mt-1">
      <span className="font-mono text-lg font-semibold">{v}</span>
      <div className="h-1.5 w-14 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full grow-x" style={{ width: `${v}%` }} /></div>
    </div>
  </div>
);

export const VERDICT = {
  accept: "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]",
  revise: "bg-accent/10 text-accent border-accent/30",
  reject: "bg-destructive/10 text-destructive border-destructive/30",
};

export const InsightCard = ({ insight: i, onChange, readOnly }) => {
  const [open, setOpen] = useState(false);
  const [starred, setStarred] = useState(i.starred);
  const nav = useNavigate();
  const toggleStar = async () => {
    const { data } = await api.post(`/insights/${i.id}/star`);
    setStarred(data.starred);
    onChange && onChange();
  };
  const debate = async () => {
    const { data } = await api.post("/debates", { topic: i.title, insight_id: i.id });
    toast.success("Debate convened — proponent vs skeptic");
    nav(`/app/orchestrator?debate=${data.id}`);
  };
  return (
    <article data-testid={`insight-card-${i.id}`} className="card-soft p-5 sm:p-7 rise hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-3">
        <span className={`shrink-0 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${VERDICT[i.verdict] || VERDICT.revise}`}>{i.verdict}</span>
        <h3 className="text-base sm:text-lg font-semibold tracking-tight flex-1 leading-snug">{i.title}</h3>
        {!readOnly && (
          <button data-testid={`insight-star-${i.id}`} onClick={toggleStar} className="shrink-0 text-muted-foreground hover:text-accent transition-colors" aria-label="Star">
            <Star size={20} weight={starred ? "fill" : "regular"} className={starred ? "text-accent" : ""} />
          </button>
        )}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-foreground/90">{i.statement}</p>
      <div className="flex flex-wrap gap-x-8 gap-y-4 mt-5">
        <Score label="Novelty" v={i.novelty} testid={`insight-novelty-${i.id}`} />
        <Score label="Confidence" v={i.confidence} testid={`insight-confidence-${i.id}`} />
        <Score label="Rigor" v={i.rigor} testid={`insight-rigor-${i.id}`} />
        {i.targets?.length > 0 && (
          <div className="min-w-0"><div className="label-xs">Targets</div><div className="font-mono text-sm mt-1 break-words">{i.targets.join(" · ")}</div></div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-5">
        {i.citations?.map((c) => (
          <a key={c.type + c.id} href={c.url} target="_blank" rel="noreferrer" data-testid={`citation-${c.id}`}
            className="inline-flex items-center gap-1 font-mono text-[11px] border rounded-full px-2.5 py-1 text-muted-foreground hover:text-primary hover:border-primary transition-colors">
            {c.verified ? <CheckCircle size={12} className="text-[hsl(var(--success))]" /> : <XCircle size={12} className="text-destructive" />}
            {c.type === "pubmed" ? "PMID " : ""}{c.id}
          </a>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-5">
        <button data-testid={`insight-expand-${i.id}`} onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <CaretDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} /> Mechanism, debate & bias audit
        </button>
        {!readOnly && (
          <button data-testid={`insight-debate-${i.id}`} onClick={debate} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Scales size={14} /> Convene a debate
          </button>
        )}
        {i.debate_history?.length > 0 && <span className="font-mono text-[10px] text-muted-foreground">{i.debate_history.length} debate(s) · last: {i.debate_history.at(-1).verdict}</span>}
      </div>
      {open && (
        <div className="mt-4 grid md:grid-cols-2 gap-5 text-sm border-t pt-5">
          <div><div className="label-xs mb-1">Mechanism</div><p className="leading-relaxed">{i.mechanism}</p></div>
          <div><div className="label-xs mb-1">Proposed validation</div><p className="leading-relaxed">{i.proposed_validation}</p></div>
          <div><div className="label-xs mb-1">Skeptic objection</div><p className="leading-relaxed">{i.debate?.objection}</p></div>
          <div><div className="label-xs mb-1">Proponent rebuttal</div><p className="leading-relaxed">{i.debate?.rebuttal}</p></div>
          {i.debate?.resolution && <div className="md:col-span-2"><div className="label-xs mb-1">Orchestrator resolution</div><p className="leading-relaxed">{i.debate.resolution}</p></div>}
          {i.collaborators?.length > 0 && (
            <div className="md:col-span-2">
              <div className="label-xs mb-2">Suggested collaborators</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {i.collaborators.map((c, k) => (
                  <div key={k} className="border rounded-lg p-3 text-xs"><b>{c.name}</b> <span className="text-muted-foreground">· {c.affiliation?.slice(0, 80)}</span><p className="mt-1">{c.why}</p></div>
                ))}
              </div>
            </div>
          )}
          {i.bias_flags?.length > 0 && (
            <div className="md:col-span-2">
              <div className="label-xs mb-2">Bias flags</div>
              {i.bias_flags.map((f, k) => (
                <div key={k} className="flex gap-2 mb-2"><Warning size={16} className="text-accent shrink-0 mt-0.5" />
                  <span><b className="font-mono text-xs uppercase">{f.type} · {f.severity}</b> — {f.description} <i className="text-muted-foreground">Correction: {f.correction}</i></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
