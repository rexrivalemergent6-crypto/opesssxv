import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtTime, AGENT_META } from "@/lib/api";
import { PageHeader } from "@/components/Common";

const AGENTS = ["", ...Object.keys(AGENT_META)];

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [agent, setAgent] = useState("");
  useEffect(() => { api.get(`/audit${agent ? `?agent=${agent}` : ""}`).then((r) => setLogs(r.data)); }, [agent]);
  return (
    <div data-testid="audit-page">
      <PageHeader eyebrow="Centralized Audit Logging" title="Audit trail" lede="An append-only log of every decision, action and reasoning step across the platform.">
        <select data-testid="audit-agent-filter" value={agent} onChange={(e) => setAgent(e.target.value)} className="bg-card border rounded-lg text-xs px-3 py-2">
          {AGENTS.map((a) => <option key={a} value={a}>{a ? AGENT_META[a].name : "All agents"}</option>)}
        </select>
      </PageHeader>
      {/* Desktop table */}
      <div className="hidden md:block overflow-auto card-soft">
        <table className="w-full border-collapse text-sm" data-testid="audit-table">
          <thead>
            <tr className="text-left">
              {["Timestamp", "Agent", "Action", "Run", "Details"].map((h) => <th key={h} className="label-xs p-3 border-b">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-secondary/60 transition-colors">
                <td className="font-mono text-[11px] p-3 border-b whitespace-nowrap">{fmtTime(l.timestamp)}</td>
                <td className="font-mono text-[11px] p-3 border-b whitespace-nowrap">{AGENT_META[l.agent]?.name || l.agent}</td>
                <td className="p-3 border-b">{l.action}</td>
                <td className="font-mono text-[11px] p-3 border-b">{l.run_id && <Link to={`/app/runs/${l.run_id}`} className="hover:text-primary transition-colors">{l.run_id.slice(0, 8)}</Link>}</td>
                <td className="font-mono text-[11px] p-3 border-b text-muted-foreground break-all max-w-md">{JSON.stringify(l.details)}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="p-8 text-muted-foreground text-sm">No audit events yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="md:hidden space-y-2" data-testid="audit-list-mobile">
        {logs.map((l) => (
          <div key={l.id} className="card-soft p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="label-xs">{AGENT_META[l.agent]?.name || l.agent}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{fmtTime(l.timestamp)}</span>
            </div>
            <p className="text-sm mt-1">{l.action}</p>
            {l.run_id && <Link to={`/app/runs/${l.run_id}`} className="font-mono text-[11px] text-primary">run {l.run_id.slice(0, 8)}</Link>}
          </div>
        ))}
        {logs.length === 0 && <p className="text-sm text-muted-foreground">No audit events yet.</p>}
      </div>
    </div>
  );
}
