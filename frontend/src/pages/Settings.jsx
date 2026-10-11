import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, fmtTime } from "@/lib/api";
import { PageHeader, Btn } from "@/components/Common";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

const Row = ({ title, desc, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 py-5 border-b last:border-0">
    <div className="flex-1"><div className="text-sm font-medium">{title}</div><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p></div>
    <div className="shrink-0">{children}</div>
  </div>
);

export default function Settings() {
  const [s, setS] = useState(null);
  const [models, setModels] = useState([]);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); api.get("/models").then((r) => setModels(r.data)); }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("theme", dark ? "dark" : "light"); }, [dark]);

  const save = async (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    try {
      const { data } = await api.put("/settings", patch);
      setS(data);
      toast.success("Settings saved");
    } catch (e) { toast.error("Could not save"); }
  };
  if (!s) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const ModelSelect = ({ k, testid }) => (
    <select data-testid={testid} value={s[k]} onChange={(e) => save({ [k]: e.target.value })} className="bg-card border rounded-lg text-sm px-3 py-2 w-full sm:w-72">
      {models.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.provider})</option>)}
    </select>
  );

  return (
    <div data-testid="settings-page" className="max-w-3xl">
      <PageHeader eyebrow="Configuration" title="Settings" lede="Control autonomy, self-correction, model selection and insight delivery." />
      <section className="card-soft px-5 sm:px-6 mb-6">
        <div className="label-xs pt-5">Autonomy</div>
        <Row title="Autonomous mode" desc={`When on, the orchestrator wakes daily, scans new literature & trials, sets its own goal and runs the full pipeline. Last scan: ${fmtTime(s.last_daily_scan_at)}`}>
          <Switch data-testid="autonomous-switch" checked={s.autonomous_mode} onCheckedChange={(v) => save({ autonomous_mode: v })} />
        </Row>
        <Row title="Daily scan hour (UTC)" desc="Earliest hour of the day the autonomous scan may fire.">
          <Input data-testid="scan-hour-input" type="number" min={0} max={23} defaultValue={s.daily_scan_hour_utc} onBlur={(e) => save({ daily_scan_hour_utc: Number(e.target.value) })} className="w-24 rounded-lg font-mono" />
        </Row>
        <Row title="Automatic self-correction" desc={`Run a self-correction cycle after every N completed runs. Last: ${fmtTime(s.last_self_correction_at)}`}>
          <div className="flex items-center gap-3">
            <Input data-testid="correction-n-input" type="number" min={1} max={50} defaultValue={s.self_correction_every_n_runs} onBlur={(e) => save({ self_correction_every_n_runs: Number(e.target.value) })} className="w-20 rounded-lg font-mono" />
            <Switch data-testid="auto-correction-switch" checked={s.auto_self_correction} onCheckedChange={(v) => save({ auto_self_correction: v })} />
          </div>
        </Row>
      </section>
      <section className="card-soft px-5 sm:px-6 mb-6">
        <div className="label-xs pt-5">Reasoning engine (swappable)</div>
        <Row title="Research agents engine" desc="Used by all ten agents in research runs, debates, reflections and bias audits."><ModelSelect k="research_model" testid="research-model-select" /></Row>
        <Row title="Research Assistant default engine" desc="Default for new chat conversations (can be changed per conversation)."><ModelSelect k="chat_model" testid="chat-model-default-select" /></Row>
      </section>
      <section className="card-soft px-5 sm:px-6 mb-6">
        <div className="label-xs pt-5">Proactive insight delivery</div>
        <Row title="Notify on accepted insights" desc="Push a notification whenever the debate resolves an insight as accepted.">
          <Switch data-testid="notify-accept-switch" checked={s.notify_on_accept} onCheckedChange={(v) => save({ notify_on_accept: v })} />
        </Row>
        <Row title="Novelty alert threshold" desc="Also notify for non-rejected insights at or above this novelty score.">
          <Input data-testid="novelty-threshold-input" type="number" min={0} max={100} defaultValue={s.insight_alert_novelty} onBlur={(e) => save({ insight_alert_novelty: Number(e.target.value) })} className="w-24 rounded-lg font-mono" />
        </Row>
      </section>
      <section className="card-soft px-5 sm:px-6 mb-6">
        <div className="label-xs pt-5">Appearance & data</div>
        <Row title="Dark mode" desc="The default is the light clinical theme."><Switch data-testid="dark-mode-switch" checked={dark} onCheckedChange={setDark} /></Row>
        <Row title="Export settings" desc="Download the current configuration as JSON.">
          <Btn variant="ghost" data-testid="export-settings-btn" onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }));
            a.download = "openalz-settings.json"; a.click();
          }}>Export JSON</Btn>
        </Row>
      </section>
    </div>
  );
}
