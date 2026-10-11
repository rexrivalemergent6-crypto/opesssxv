import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, Empty } from "@/components/Common";
import { InsightCard } from "@/components/InsightCard";
import { Input } from "@/components/ui/input";

const FILTERS = ["all", "accept", "revise", "reject", "starred"];

export default function Insights() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("created_at");

  useEffect(() => {
    const p = filter === "starred" ? "?starred=true" : filter !== "all" ? `?verdict=${filter}` : "";
    api.get(`/insights${p}`).then((r) => setItems(r.data));
  }, [filter]);

  const shown = useMemo(() => {
    const s = (items || []).filter((i) => (i.title + i.statement + (i.targets || []).join(" ")).toLowerCase().includes(q.toLowerCase()));
    return sort === "created_at" ? s : [...s].sort((a, b) => b[sort] - a[sort]);
  }, [items, q, sort]);

  return (
    <div data-testid="insights-page">
      <PageHeader eyebrow="Insight Delivery" title="Insights library" lede="Every hypothesis the foundry produced, with verified citations, debate transcript and bias audit." />
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-6 sm:mb-8">
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 sm:pb-0">
          {FILTERS.map((f) => (
            <button key={f} data-testid={`filter-${f}`} onClick={() => setFilter(f)}
              className={`shrink-0 text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${filter === f ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground bg-card hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <select data-testid="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} className="bg-card border rounded-lg text-xs px-3 py-2">
            <option value="created_at">Newest</option>
            <option value="novelty">Novelty</option>
            <option value="confidence">Confidence</option>
            <option value="rigor">Rigor</option>
          </select>
          <Input data-testid="insight-search" placeholder="Search insights, targets…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 sm:w-64 rounded-lg bg-card" />
        </div>
      </div>
      {items && shown.length === 0 && <Empty testid="insights-empty">No insights match. Launch a research run to generate some.</Empty>}
      <div className="space-y-4">{shown.map((i) => <InsightCard key={i.id} insight={i} />)}</div>
    </div>
  );
}
