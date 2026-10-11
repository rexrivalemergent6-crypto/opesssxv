import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { AGENT_META, fmtTime, agentName } from "@/lib/api";
import { StatusBadge } from "@/components/Common";

const Sources = ({ o }) => (
  <div className="space-y-1.5 mb-4">
    {o.papers?.map((p) => (
      <a key={p.pmid} href={p.url} target="_blank" rel="noreferrer" className="block text-xs hover:text-primary transition-colors">
        <span className="font-mono text-muted-foreground">PMID {p.pmid} · {p.year}</span> — {p.title}
      </a>
    ))}
    {o.trials?.map((t) => (
      <a key={t.nct_id} href={t.url} target="_blank" rel="noreferrer" className="block text-xs hover:text-primary transition-colors">
        <span className="font-mono text-muted-foreground">{t.nct_id} · {t.status} · {(t.phases || []).join("/")}</span> — {t.title}
      </a>
    ))}
    {o.targets && (
      <div className="flex flex-wrap gap-1.5">
        {o.targets.map((t) => (
          <a key={t.symbol} href={t.url} target="_blank" rel="noreferrer" className="font-mono text-[11px] border rounded-full px-2 py-0.5 hover:border-primary transition-colors">
            {t.symbol} {t.score}
          </a>
        ))}
      </div>
    )}
  </div>
);

export const StepCard = ({ step, index }) => {
  const [open, setOpen] = useState(false);
  const o = step.output || {};
  const { papers, trials, targets, ...rest } = o;
  return (
    <div data-testid={`step-${step.agent}-${index}`} style={{ animationDelay: `${index * 50}ms` }} className="rise relative pl-9">
      <span className={`absolute left-[11px] top-5 w-2.5 h-2.5 rounded-full ring-4 ring-background ${AGENT_META[step.agent]?.color || "bg-primary"}`} />
      <div className="card-soft overflow-hidden">
        <button data-testid={`step-toggle-${index}`} onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-secondary/60 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="label-xs">{agentName(step.agent)}</div>
            <div className="text-sm mt-0.5 leading-snug">{step.action}</div>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground hidden md:block">{fmtTime(step.started_at)}</span>
          <StatusBadge status={step.status} />
          <CaretDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && step.output && (
          <div className="border-t px-4 sm:px-5 py-4">
            <Sources o={{ papers, trials, targets }} />
            <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-[420px] overflow-auto bg-secondary/50 rounded-lg p-3 sm:p-4">
              {JSON.stringify(rest, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
