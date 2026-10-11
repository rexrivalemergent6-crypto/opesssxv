import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  SquaresFour, Flask, Lightbulb, Robot, ListMagnifyingGlass, CalendarCheck, Brain, Target, ChatsCircle,
  ShieldCheck, GearSix, Graph, List, X, Bell, BookOpenText, House,
} from "@phosphor-icons/react";
import { api, fmtRel } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const NAV_GROUPS = [
  { title: "Research", items: [
    { to: "/app", label: "Command", icon: SquaresFour, id: "dashboard" },
    { to: "/app/goals", label: "Research Goals", icon: Target, id: "goals" },
    { to: "/app/runs", label: "Research Runs", icon: Flask, id: "runs" },
    { to: "/app/insights", label: "Insights", icon: Lightbulb, id: "insights" },
    { to: "/app/chat", label: "Research Assistant", icon: ChatsCircle, id: "chat" },
  ] },
  { title: "Autonomy", items: [
    { to: "/app/orchestrator", label: "Orchestrator", icon: Graph, id: "orchestrator" },
    { to: "/app/schedules", label: "Schedules", icon: CalendarCheck, id: "schedules" },
    { to: "/app/memory", label: "Strategy Memory", icon: Brain, id: "memory" },
    { to: "/app/agents", label: "Agent Registry", icon: Robot, id: "agents" },
  ] },
  { title: "Governance", items: [
    { to: "/app/bias", label: "Bias Detection", icon: ShieldCheck, id: "bias" },
    { to: "/app/audit", label: "Audit Trail", icon: ListMagnifyingGlass, id: "audit" },
    { to: "/app/settings", label: "Settings", icon: GearSix, id: "settings" },
  ] },
];

export const Logo = ({ className = "" }) => (
  <Link to="/" className={`flex items-center gap-2.5 ${className}`} data-testid="logo-link">
    <span className="relative w-8 h-8 rounded-lg bg-primary/10 grid place-items-center">
      <svg viewBox="0 0 32 32" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="16" cy="16" r="3.2" fill="currentColor" />
        <circle cx="6" cy="8" r="2" /><circle cx="26" cy="8" r="2" /><circle cx="6" cy="24" r="2" /><circle cx="26" cy="24" r="2" />
        <path d="M8 9.5 13.5 14M24 9.5 18.5 14M8 22.5l5.5-4.5M24 22.5 18.5 18" />
      </svg>
    </span>
    <span className="font-display text-xl font-medium tracking-tight">Open<span className="text-primary">Alz</span></span>
  </Link>
);

export const ThemeToggle = () => {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <button data-testid="theme-toggle-btn" onClick={() => setDark(!dark)}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors">
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
};

const Bells = () => {
  const [n, setN] = useState({ items: [], unread: 0 });
  useEffect(() => {
    const load = () => api.get("/notifications").then((r) => setN(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <Popover onOpenChange={(o) => { if (o && n.unread) api.post("/notifications/read").then(() => setN({ ...n, unread: 0 })); }}>
      <PopoverTrigger asChild>
        <button data-testid="notifications-btn" className="relative w-9 h-9 grid place-items-center rounded-full hover:bg-secondary transition-colors" aria-label="Notifications">
          <Bell size={18} />
          {n.unread > 0 && <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[10px] text-white grid place-items-center">{n.unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-0 rounded-xl" data-testid="notifications-panel">
        <div className="px-4 py-3 border-b label-xs">Proactive insight delivery</div>
        <div className="max-h-80 overflow-auto">
          {n.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">High-value insights will be pushed here.</p>}
          {n.items.map((i) => (
            <Link key={i.id} to={`/app/runs/${i.run_id}`} className="block px-4 py-3 border-b last:border-0 hover:bg-secondary transition-colors">
              <div className="text-sm leading-snug">{i.title}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1">{i.body} · {fmtRel(i.created_at)}</div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const NavList = ({ onNavigate }) => (
  <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
    {NAV_GROUPS.map((g) => (
      <div key={g.title}>
        <div className="label-xs px-3 mb-1.5">{g.title}</div>
        {g.items.map(({ to, label, icon: Icon, id }) => (
          <NavLink key={to} to={to} end={to === "/app"} data-testid={`nav-${id}`} onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}>
            <Icon size={18} weight="duotone" /> {label}
          </NavLink>
        ))}
      </div>
    ))}
  </nav>
);

const SideFooter = () => (
  <div className="px-6 py-4 border-t space-y-3">
    <div className="flex items-center gap-4 text-xs">
      <Link to="/doc" data-testid="side-docs-link" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"><BookOpenText size={14} /> Docs</Link>
      <Link to="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"><House size={14} /> Home</Link>
      <ThemeToggle />
    </div>
    <p className="text-[11px] leading-relaxed text-muted-foreground">Live: PubMed · ClinicalTrials.gov · Open Targets · ChEMBL · Reactome</p>
  </div>
);

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; }, [open]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r bg-card fixed inset-y-0 left-0 flex-col z-40" data-testid="sidebar">
        <div className="px-6 h-16 flex items-center justify-between border-b">
          <Logo />
          <Bells />
        </div>
        <NavList />
        <SideFooter />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 h-14 bg-card/95 backdrop-blur border-b flex items-center justify-between px-4" data-testid="mobile-topbar">
        <Logo />
        <div className="flex items-center gap-1">
          <Bells />
          <button data-testid="mobile-menu-btn" onClick={() => setOpen(true)} className="w-9 h-9 grid place-items-center rounded-full hover:bg-secondary" aria-label="Open menu">
            <List size={20} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-foreground/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
        <aside data-testid="mobile-drawer" className={`absolute inset-y-0 left-0 w-[82vw] max-w-[300px] bg-card shadow-2xl flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="px-5 h-14 flex items-center justify-between border-b">
            <Logo />
            <button data-testid="mobile-menu-close" onClick={() => setOpen(false)} className="w-9 h-9 grid place-items-center rounded-full hover:bg-secondary" aria-label="Close menu"><X size={18} /></button>
          </div>
          <NavList onNavigate={() => setOpen(false)} />
          <SideFooter />
        </aside>
      </div>

      <main className="lg:ml-64 min-w-0">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
