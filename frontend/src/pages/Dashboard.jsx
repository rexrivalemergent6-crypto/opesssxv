import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Graph, Brain, Target } from "@phosphor-icons/react";
import { api, fmtTime } from "@/lib/api";
import { PageHeader, Stat, StatusBadge, Empty } from "@/components/Common";
import { NewRunForm } from "@/components/NewRunForm";

const LOOP = ["Scan", "Plan", "Retrieve", "Hypothesise", "Debate", "Audit", "Learn"];

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [runs, setRuns] = useState([]);
  const [h, setH] = useState(null);
  useEffect(() => {
    const load = () => {
      api.get("/stats").then((r) => setS(r.data));
      api.get("/runs?limit=6").then((r) => setRuns(r.data));
      api.get("/health").then((r) => setH(r.data));
    };
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div data-testid="dashboard-page">
      <PageHeader eyebrow="Command Center" title="Autonomous Alzheimer's research.">
        <span data-testid="system-health" className="inline-flex items-center gap-2 text-xs border rounded-full px-3 py-1.5 bg-card">
          <span className={`w-2 h-2 rounded-full ${h?.status === "ok" ? "bg-[hsl(var(--success))]" : "bg-accent"} pulse-dot`} />
          System {h?.status || "…"} · LLM queue {h ? `${h.llm_queue.active}/${h.llm_queue.limit} (+${h.llm_queue.queued})` : "—"}
        </span>
      </PageHeader>
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="lg:col-span-2"><NewRunForm /></div>
        <div className="card-soft p-5 sm:p-7 relative overflow-hidden bg-grid">
          <div className="label-xs">Self-evolving loop</div>
          <ol className="mt-4 space-y-2">
            {LOOP.map((l, i) => (
              <li key={l} className="flex items-center gap-3 text-sm rise" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="font-mono text-[10px] w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center">{i + 1}</span>{l}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/app/orchestrator" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Graph size={14} /> Orchestrator</Link>
            <Link to="/app/goals" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Target size={14} /> Goals</Link>
            <Link to="/app/memory" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Brain size={14} /> Memory</Link>
          </div>
        </div>
      </div>
      <div data-testid="stats" className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Stat label="Runs completed" value={s ? `${s.runs_completed}/${s.runs_total}` : "—"} testid="stat-runs" />
        <Stat label="Active runs" value={s?.runs_active ?? "—"} testid="stat-active" accent="text-primary" />
        <Stat label="Insights (accepted)" value={s ? `${s.insights_total} (${s.insights_accepted})` : "—"} testid="stat-insights" />
        <Stat label="Lessons learned" value={s?.learnings_total ?? "—"} testid="stat-learnings" accent="text-accent" />
        <Stat label="Avg novelty" value={s?.avg_novelty ?? "—"} testid="stat-novelty" />
        <Stat label="Avg confidence" value={s?.avg_confidence ?? "—"} testid="stat-confidence" />
        <Stat label="Active schedules" value={s?.schedules_active ?? "—"} testid="stat-schedules" />
        <Stat label="Data sources" value="5 live" testid="stat-sources" />
      </div>
      <div className="grid lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="lg:col-span-3 card-soft p-4 sm:p-6 min-w-0" data-testid="insight-quality-chart">
          <div className="label-xs mb-4">Insight quality over time</div>
          {s?.series?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={s.series} margin={{ left: -20, right: 8 }}>
                <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area dataKey="novelty" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.12} />
                <Area dataKey="confidence" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty>Insights will chart here after the first completed run.</Empty>}
        </div>
        <div className="lg:col-span-2 card-soft overflow-hidden" data-testid="recent-runs">
          <div className="flex items-center justify-between p-4 sm:p-6 pb-3"><span className="label-xs">Recent runs</span><Link to="/app/runs" className="text-xs text-primary inline-flex items-center gap-1">All <ArrowRight size={12} /></Link></div>
          {runs.length === 0 && <div className="px-6 pb-6 text-sm text-muted-foreground">No runs yet.</div>}
          {runs.map((r) => (
            <Link key={r.id} to={`/app/runs/${r.id}`} data-testid={`recent-run-${r.id}`}
              className="block px-4 sm:px-6 py-3.5 border-t hover:bg-secondary/60 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm truncate">{r.goal}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="font-mono text-[11px] text-muted-foreground mt-1">{fmtTime(r.created_at)} · {r.origin}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
