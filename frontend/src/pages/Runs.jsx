import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtTime } from "@/lib/api";
import { PageHeader, StatusBadge, Empty } from "@/components/Common";
import { NewRunForm } from "@/components/NewRunForm";

export default function Runs() {
  const [runs, setRuns] = useState(null);
  useEffect(() => {
    const load = () => api.get("/runs").then((r) => setRuns(r.data));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div data-testid="runs-page">
      <PageHeader eyebrow="Orchestrator" title="Research runs" lede="Every run is a full plan → retrieve → hypothesise → debate → audit → learn cycle across ten agents." />
      <div className="mb-6 sm:mb-8"><NewRunForm /></div>
      {runs && runs.length === 0 && <Empty testid="runs-empty">No runs yet. Launch one above.</Empty>}
      <div className="card-soft overflow-hidden">
        {runs?.map((r, i) => (
          <Link key={r.id} to={`/app/runs/${r.id}`} data-testid={`run-row-${r.id}`} style={{ animationDelay: `${i * 30}ms` }}
            className="rise flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 md:items-center px-4 sm:px-6 py-4 border-b last:border-b-0 hover:bg-secondary/60 transition-colors">
            <div className="md:col-span-6 text-sm leading-snug">{r.goal}</div>
            <div className="md:col-span-6 flex flex-wrap items-center gap-x-4 gap-y-1 md:justify-end">
              <StatusBadge status={r.status} />
              <span className="font-mono text-xs">{r.insight_ids?.length || 0} insights</span>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{r.origin}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{fmtTime(r.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
