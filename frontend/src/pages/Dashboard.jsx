import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, fmtTime } from "@/lib/api";
import { PageHeader, Stat, StatusBadge, Empty } from "@/components/Common";
import { NewRunForm } from "@/components/NewRunForm";

const HERO = "https://images.unsplash.com/photo-1719650592946-55163c4994cb?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [runs, setRuns] = useState([]);
  useEffect(() => {
    const load = () => {
      api.get("/stats").then((r) => setS(r.data));
      api.get("/runs?limit=6").then((r) => setRuns(r.data));
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div data-testid="dashboard-page">
      <PageHeader eyebrow="Command Center" title="Autonomous Alzheimer's research." />
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2"><NewRunForm /></div>
        <div className="relative border overflow-hidden min-h-[200px] bg-card">
          <img src={HERO} alt="Neural network" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <div className="absolute inset-x-0 bottom-0 bg-background p-5 border-t">
            <div className="label-xs">Self-evolving loop</div>
            <p className="text-sm mt-1">Plan → Retrieve → Hypothesise → Debate → Audit → Learn</p>
          </div>
        </div>
      </div>
      <div data-testid="stats" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Runs completed" value={s ? `${s.runs_completed}/${s.runs_total}` : "—"} testid="stat-runs" />
        <Stat label="Active runs" value={s?.runs_active ?? "—"} testid="stat-active" accent="text-primary" />
        <Stat label="Insights (accepted)" value={s ? `${s.insights_total} (${s.insights_accepted})` : "—"} testid="stat-insights" />
        <Stat label="Lessons learned" value={s?.learnings_total ?? "—"} testid="stat-learnings" accent="text-accent" />
        <Stat label="Avg novelty" value={s?.avg_novelty ?? "—"} testid="stat-novelty" />
        <Stat label="Avg confidence" value={s?.avg_confidence ?? "—"} testid="stat-confidence" />
        <Stat label="Active schedules" value={s?.schedules_active ?? "—"} testid="stat-schedules" />
        <Stat label="Data sources" value="3 live" testid="stat-sources" />
      </div>
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-card border p-6" data-testid="insight-quality-chart">
          <div className="label-xs mb-4">Insight quality over time</div>
          {s?.series?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={s.series}>
                <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Area dataKey="novelty" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.15} />
                <Area dataKey="confidence" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty>Insights will chart here after the first completed run.</Empty>}
        </div>
        <div className="lg:col-span-2 bg-card border" data-testid="recent-runs">
          <div className="label-xs p-6 pb-3">Recent runs</div>
          {runs.length === 0 && <div className="px-6 pb-6 text-sm text-muted-foreground">No runs yet.</div>}
          {runs.map((r) => (
            <Link key={r.id} to={`/runs/${r.id}`} data-testid={`recent-run-${r.id}`}
              className="block px-6 py-4 border-t hover:bg-secondary transition-colors">
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
