import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brain, CircleNotch } from "@phosphor-icons/react";
import { api, AGENT_META, fmtTime, fmtRel } from "@/lib/api";
import { PageHeader, StatusBadge, Btn } from "@/components/Common";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const List = ({ title, items, tone }) => items?.length ? (
  <div><div className="label-xs mb-1.5">{title}</div>
    <ul className="space-y-1.5">{items.map((x, i) => <li key={i} className={`text-sm leading-relaxed pl-3 border-l-2 ${tone}`}>{x}</li>)}</ul></div>
) : null;

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const load = () => api.get("/agents").then((r) => setAgents(r.data));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!sel) return;
    let t;
    const get = async () => {
      const { data } = await api.get(`/agents/${sel}`);
      setDetail(data);
      if (data.reflections.some((r) => ["queued", "running"].includes(r.status))) t = setTimeout(get, 3000);
    };
    get();
    return () => clearTimeout(t);
  }, [sel]);

  const reflect = async (key) => {
    try {
      await api.post(`/agents/${key}/reflect`);
      toast.success("Agent is reflecting on its recent work");
      setDetail(null);
      setSel(null);
      setTimeout(() => setSel(key), 50);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not start reflection");
    }
  };

  return (
    <div data-testid="agents-page">
      <PageHeader eyebrow="Agent Registry Service" title="Registered agents" lede="Ten specialised agents register their capabilities and data sources. Open any agent to see its activity or trigger a self-reflection — its adjustments are injected into its own instructions on future runs." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {agents.map((a, i) => (
          <button key={a.key} onClick={() => setSel(a.key)} data-testid={`agent-card-${a.key}`} style={{ animationDelay: `${i * 40}ms` }}
            className={`rise text-left card-soft p-5 sm:p-6 hover:-translate-y-1 hover:border-primary/40 transition-all ${i === 0 ? "sm:col-span-2" : ""}`}>
            <div className="flex items-center justify-between">
              <span className={`w-3 h-3 rounded-full ${AGENT_META[a.key]?.color}`} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-[hsl(var(--success))] inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />{a.status}</span>
            </div>
            <h3 className={`font-semibold tracking-tight mt-5 ${i === 0 ? "text-2xl" : "text-lg"}`}>{a.name}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{a.role}</p>
            <div className="mt-5 pt-4 border-t space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">SOURCE</span><span className="text-right">{a.source}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">COMPLETED</span><span data-testid={`agent-completed-${a.key}`}>{a.tasks_completed}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">FAILED</span><span>{a.tasks_failed}</span></div>
              {a.self_rating != null && <div className="flex justify-between"><span className="text-muted-foreground">SELF-RATING</span><span>{a.self_rating}/100</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">LAST ACTIVE</span><span>{fmtRel(a.last_active)}</span></div>
            </div>
          </button>
        ))}
      </div>

      <Sheet open={!!sel} onOpenChange={(o) => { if (!o) { setSel(null); setDetail(null); load(); } }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="agent-detail-sheet">
          {!detail ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> : (
            <div className="space-y-6">
              <SheetHeader>
                <div className="label-xs">{detail.source}</div>
                <SheetTitle className="font-display text-3xl font-medium">{detail.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{detail.role}</p>
              </SheetHeader>
              <Btn data-testid="agent-reflect-btn" onClick={() => reflect(detail.key)} disabled={detail.reflections.some((r) => ["queued", "running"].includes(r.status))}>
                {detail.reflections.some((r) => ["queued", "running"].includes(r.status)) ? <><CircleNotch className="animate-spin" size={16} /> Reflecting…</> : <><Brain size={16} /> Trigger self-reflection</>}
              </Btn>
              <div>
                <div className="label-xs mb-2">Self-reflections</div>
                {detail.reflections.length === 0 && <p className="text-sm text-muted-foreground">No reflections yet.</p>}
                <div className="space-y-3">
                  {detail.reflections.map((r) => (
                    <div key={r.id} className="border rounded-xl p-4 space-y-3" data-testid={`reflection-${r.id}`}>
                      <div className="flex items-center justify-between"><StatusBadge status={r.status} /><span className="font-mono text-[10px] text-muted-foreground">{fmtTime(r.created_at)}</span></div>
                      {r.result && <>
                        <p className="text-sm">{r.result.summary}</p>
                        <div className="font-mono text-xs">Self-rating: <b>{r.result.self_rating}</b>/100 · {r.steps_reviewed} steps reviewed</div>
                        <List title="Strengths" items={r.result.strengths} tone="border-[hsl(var(--success))]" />
                        <List title="Weaknesses" items={r.result.weaknesses} tone="border-destructive" />
                        <List title="Adjustments (applied to future runs)" items={r.result.adjustments} tone="border-primary" />
                      </>}
                      {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="label-xs mb-2">Recent activity</div>
                {detail.recent_activity.map((l) => (
                  <div key={l.id} className="text-xs py-2 border-b flex justify-between gap-3"><span>{l.action}</span><span className="font-mono text-muted-foreground shrink-0">{fmtRel(l.timestamp)}</span></div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
