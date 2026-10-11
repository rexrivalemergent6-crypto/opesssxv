import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, StopCircle, FileText } from "@phosphor-icons/react";
import { api, fmtTime } from "@/lib/api";
import { StatusBadge, Empty, Btn } from "@/components/Common";
import { StepCard } from "@/components/StepCard";
import { InsightCard } from "@/components/InsightCard";

export default function RunDetail() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let t;
    const load = async () => {
      const { data } = await api.get(`/runs/${id}`);
      setRun(data);
      if (["queued", "running"].includes(data.status)) t = setTimeout(load, 2500);
    };
    load();
    return () => clearTimeout(t);
  }, [id, tick]);

  const cancel = async () => {
    try {
      await api.post(`/runs/${id}/cancel`);
      toast.success("Run cancelled");
      setTick((x) => x + 1);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not cancel");
    }
  };

  if (!run) return <div className="text-sm text-muted-foreground">Loading run…</div>;
  const active = ["queued", "running"].includes(run.status);
  const done = run.steps.filter((s) => s.status === "done").length;
  return (
    <div data-testid="run-detail-page">
      <Link to="/app/runs" data-testid="back-to-runs" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5">
        <ArrowLeft size={14} /> All runs
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-2 rise">
        <h1 className="font-display text-2xl sm:text-4xl font-medium tracking-tight flex-1 leading-tight" data-testid="run-goal">{run.goal}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={run.status} testid="run-status" />
          {active && <Btn variant="danger" onClick={cancel} data-testid="cancel-run-btn" className="!py-1.5"><StopCircle size={16} /> Cancel</Btn>}
          {run.status === "completed" && <Link to={`/doc/research/${run.id}`} data-testid="run-report-link" className="inline-flex items-center gap-1.5 text-xs border rounded-full px-3 py-1.5 hover:border-primary hover:text-primary"><FileText size={14} /> Full report</Link>}
        </div>
      </div>
      <div className="font-mono text-[11px] text-muted-foreground mb-4 break-words">
        RUN {run.id.slice(0, 8)} · {run.origin} · started {fmtTime(run.started_at)} {run.finished_at && `· finished ${fmtTime(run.finished_at)}`}
        {run.bias_risk && ` · bias risk ${run.bias_risk}`}
      </div>
      {active && (
        <div className="mb-8" data-testid="run-progress">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (done / 13) * 100)}%` }} /></div>
          <div className="font-mono text-[10px] text-muted-foreground mt-1">{done}/13 agent steps · LLM calls are queued one at a time (~6–8 min per run)</div>
        </div>
      )}
      {run.error && <div data-testid="run-error" className="border border-destructive/40 bg-destructive/5 rounded-lg text-destructive p-4 text-sm mb-8">{run.error}</div>}
      <div className="grid xl:grid-cols-5 gap-8 xl:gap-10">
        <section className="xl:col-span-2 min-w-0">
          <div className="label-xs mb-4">Agent execution trace</div>
          <div className="relative space-y-3 before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-border" data-testid="step-list">
            {run.steps.length === 0 && <div className="pl-9 text-sm text-muted-foreground">Orchestrator is waking up…</div>}
            {run.steps.map((s, i) => <StepCard key={s.id} step={s} index={i} />)}
          </div>
        </section>
        <section className="xl:col-span-3 min-w-0">
          <div className="label-xs mb-4">Delivered insights</div>
          <div className="space-y-4" data-testid="run-insights">
            {run.insights.length === 0
              ? <Empty>{["failed", "cancelled"].includes(run.status) ? "Run ended before insights were produced." : "Insights appear after hypothesis generation, debate and bias audit complete."}</Empty>
              : run.insights.map((i) => <InsightCard key={i.id} insight={i} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
