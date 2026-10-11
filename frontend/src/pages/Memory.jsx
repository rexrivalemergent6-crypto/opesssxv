import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtTime } from "@/lib/api";
import { PageHeader, Empty } from "@/components/Common";

export default function Memory() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get("/learnings").then((r) => setItems(r.data)); }, []);
  return (
    <div data-testid="memory-page">
      <PageHeader eyebrow="Self-Evolution" title="Strategy memory"
        lede="After every run the orchestrator distils lessons from the debate and bias audit; self-correction cycles add adaptations and retire stale lessons. The 12 most recent lessons are injected into every agent on the next run — the foundry rewrites its own strategy as it works." />
      {items && items.length === 0 && <Empty testid="memory-empty">No lessons learned yet.</Empty>}
      <ol className="space-y-3">
        {items?.map((l, i) => (
          <li key={l.id} data-testid={`lesson-${l.id}`} style={{ animationDelay: `${i * 30}ms` }} className="rise card-soft p-4 sm:p-6 flex gap-4 sm:gap-6">
            <span className="font-mono text-xl sm:text-2xl font-semibold text-primary/70 w-10 sm:w-12 shrink-0">{String(items.length - i).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="text-sm leading-relaxed">{l.lesson}</p>
              <div className="font-mono text-[11px] text-muted-foreground mt-2 flex flex-wrap gap-x-2">
                {i < 12 && <span className="text-primary">ACTIVE ·</span>}
                <span>{fmtTime(l.created_at)}</span>
                {l.source === "self_correction" ? <span className="text-accent">· self-correction</span> :
                  l.run_id && <Link to={`/app/runs/${l.run_id}`} className="hover:text-primary transition-colors">· from run {l.run_id.slice(0, 8)}</Link>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
