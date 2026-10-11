import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Play, Trash, Archive, CheckCircle, Lightning } from "@phosphor-icons/react";
import { api, fmtRel } from "@/lib/api";
import { PageHeader, Empty, Btn } from "@/components/Common";
import { Input } from "@/components/ui/input";

const TABS = ["ACTIVE", "PROPOSED", "COMPLETED", "ARCHIVED"];
const TONE = { ACTIVE: "text-primary border-primary/30 bg-primary/5", PROPOSED: "text-accent border-accent/30 bg-accent/5", COMPLETED: "text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.06)]", ARCHIVED: "text-muted-foreground bg-secondary" };
const ORIGIN = { researcher: "set by researcher", daily_scan: "set autonomously by daily scan", self_correction: "proposed by self-correction" };

export default function Goals() {
  const [goals, setGoals] = useState(null);
  const [tab, setTab] = useState("ACTIVE");
  const [text, setText] = useState("");
  const nav = useNavigate();
  const load = () => api.get("/goals").then((r) => setGoals(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (text.trim().length < 5) return toast.error("Describe the goal (5+ characters)");
    await api.post("/goals", { text: text.trim() });
    setText("");
    setTab("ACTIVE");
    toast.success("Research goal set");
    load();
  };
  const setStatus = async (g, status) => { await api.patch(`/goals/${g.id}`, { status }); load(); };
  const remove = async (g) => { await api.delete(`/goals/${g.id}`); load(); };
  const pursue = async (g) => { const { data } = await api.post(`/goals/${g.id}/pursue`); toast.success("Orchestrator pursuing goal"); nav(`/app/runs/${data.id}`); };
  const shown = (goals || []).filter((g) => g.status === tab);

  return (
    <div data-testid="goals-page">
      <PageHeader eyebrow="Long-horizon planning" title="Research goals"
        lede="High-level goals steer the foundry over weeks. You set them, the daily scan sets them autonomously, and self-correction proposes new ones for you to approve." />
      <div className="card-soft p-5 sm:p-6 mb-6">
        <div className="label-xs mb-3">Set a research goal</div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input data-testid="goal-text-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="e.g. Discover plasma biomarkers that predict conversion from MCI to AD" className="flex-1 rounded-lg" />
          <Btn data-testid="create-goal-btn" onClick={create}>Set goal</Btn>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 mb-5">
        {TABS.map((t) => (
          <button key={t} data-testid={`goals-tab-${t}`} onClick={() => setTab(t)}
            className={`shrink-0 text-xs tracking-widest px-4 py-2 rounded-full border transition-colors ${tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground"}`}>
            {t} <span className="opacity-70">{(goals || []).filter((g) => g.status === t).length}</span>
          </button>
        ))}
      </div>
      {goals && shown.length === 0 && <Empty testid="goals-empty">No {tab.toLowerCase()} goals.</Empty>}
      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        {shown.map((g, i) => (
          <div key={g.id} data-testid={`goal-${g.id}`} className="card-soft p-5 rise flex flex-col" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <span className={`font-mono text-[10px] tracking-widest border rounded-full px-2.5 py-0.5 ${TONE[g.status]}`}>{g.status}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{fmtRel(g.created_at)}</span>
            </div>
            <p className="text-base font-medium leading-snug mt-3">{g.text}</p>
            {g.rationale && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{g.rationale}</p>}
            <div className="font-mono text-[11px] text-muted-foreground mt-3">{ORIGIN[g.origin] || g.origin} · {g.runs} runs · {g.insights} insights</div>
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t mt-auto">
              {g.status !== "ARCHIVED" && <Btn data-testid={`goal-pursue-${g.id}`} onClick={() => pursue(g)} className="!py-1.5 !px-3 text-xs">{g.status === "PROPOSED" ? <><Lightning size={14} /> Approve & pursue</> : <><Play size={14} /> Pursue</>}</Btn>}
              {g.status === "ACTIVE" && <Btn variant="ghost" onClick={() => setStatus(g, "COMPLETED")} className="!py-1.5 !px-3 text-xs"><CheckCircle size={14} /> Complete</Btn>}
              {g.status !== "ARCHIVED" && <Btn variant="ghost" data-testid={`goal-archive-${g.id}`} onClick={() => setStatus(g, "ARCHIVED")} className="!py-1.5 !px-3 text-xs"><Archive size={14} /> Archive</Btn>}
              {g.status === "ARCHIVED" && <Btn variant="ghost" onClick={() => setStatus(g, "ACTIVE")} className="!py-1.5 !px-3 text-xs">Restore</Btn>}
              <button data-testid={`goal-delete-${g.id}`} onClick={() => remove(g)} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Delete"><Trash size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
