import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export const EXAMPLES = [
  "Identify novel links between microglial TREM2 signaling and tau propagation",
  "Find repurposable metabolic drugs targeting insulin resistance in early Alzheimer's",
  "Explore the role of APOE4 in blood-brain barrier breakdown and amyloid clearance",
];

export const NewRunForm = ({ goalId }) => {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async () => {
    if (goal.trim().length < 5) return toast.error("Describe a research goal (5+ characters)");
    setBusy(true);
    try {
      const { data } = await api.post("/runs", { goal: goal.trim(), goal_id: goalId });
      toast.success("Orchestrator dispatched");
      nav(`/app/runs/${data.id}`);
    } catch (e) {
      toast.error("Failed to start run");
      setBusy(false);
    }
  };

  return (
    <div className="card-soft p-5 sm:p-7" data-testid="new-run-form">
      <div className="label-xs mb-3 flex items-center gap-2"><Sparkle size={12} weight="fill" className="text-primary" /> Dispatch Master Orchestrator</div>
      <Textarea data-testid="goal-input" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3}
        placeholder="State a research goal. The orchestrator plans, dispatches 9 agents to live data, debates and delivers insights."
        className="rounded-lg text-base bg-background resize-none focus-visible:ring-1" />
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mt-4">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap -mx-1 px-1">
          {EXAMPLES.map((e, i) => (
            <button key={i} data-testid={`example-goal-${i}`} onClick={() => setGoal(e)}
              className="shrink-0 text-xs border rounded-full px-3 py-1.5 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
              {e.length > 44 ? e.slice(0, 44) + "…" : e}
            </button>
          ))}
        </div>
        <button data-testid="start-run-btn" onClick={submit} disabled={busy}
          className="sm:ml-auto inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium shadow-sm shadow-primary/30 hover:gap-3 active:scale-[0.98] transition-all disabled:opacity-60">
          {busy ? <CircleNotch className="animate-spin" size={16} /> : null} Launch run <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
