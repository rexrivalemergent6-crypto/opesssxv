import axios from "axios";

export const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const api = axios.create({ baseURL: `${BACKEND}/api` });

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtRel = (iso) => {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.max(1, Math.round(s))}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export const AGENT_META = {
  orchestrator: { name: "Master Orchestrator", short: "orchestrator", color: "bg-primary", hex: "#1d64d8" },
  literature_bridger: { name: "Literature Bridger", short: "literature", color: "bg-sky-500", hex: "#0ea5e9" },
  biomarker_hunter: { name: "Biomarker Hunter", short: "biomarkers", color: "bg-rose-500", hex: "#f43f5e" },
  drug_screener: { name: "Drug Screener", short: "chemistry", color: "bg-violet-500", hex: "#8b5cf6" },
  trial_optimizer: { name: "Trial Optimizer", short: "trials", color: "bg-emerald-500", hex: "#10b981" },
  pathway_modeler: { name: "Pathway Modeler", short: "pathways", color: "bg-amber-500", hex: "#f59e0b" },
  data_harmonizer: { name: "Data Harmonizer", short: "harmonizer", color: "bg-cyan-600", hex: "#0891b2" },
  hypothesis_validator: { name: "Hypothesis Validator", short: "validator", color: "bg-orange-500", hex: "#f97316" },
  collaboration_matchmaker: { name: "Collaboration Matchmaker", short: "matchmaker", color: "bg-lime-600", hex: "#65a30d" },
  bias_detection: { name: "Bias Detection Service", short: "bias", color: "bg-fuchsia-500", hex: "#d946ef" },
};
export const AGENT_COLORS = Object.fromEntries(Object.entries(AGENT_META).map(([k, v]) => [k, v.color]));
export const agentName = (k) => AGENT_META[k]?.name || k;
