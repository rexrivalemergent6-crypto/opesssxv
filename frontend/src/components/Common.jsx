export const PageHeader = ({ eyebrow, title, children, lede }) => (
  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-8 md:mb-10 rise">
    <div className="min-w-0">
      <div className="label-xs">{eyebrow}</div>
      <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight mt-2 text-balance">{title}</h1>
      {lede && <p className="text-sm text-muted-foreground max-w-2xl mt-3 leading-relaxed">{lede}</p>}
    </div>
    {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
  </div>
);

export const Stat = ({ label, value, testid, accent, hint }) => (
  <div data-testid={testid} className="card-soft p-4 sm:p-6 hover:-translate-y-0.5 transition-transform">
    <div className="label-xs">{label}</div>
    <div className={`font-mono text-2xl sm:text-3xl font-semibold mt-2 sm:mt-3 ${accent || ""}`}>{value}</div>
    {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
  </div>
);

const STATUS = {
  completed: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.08)] border-[hsl(var(--success)/0.3)]",
  done: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.08)] border-[hsl(var(--success)/0.3)]",
  running: "text-primary bg-primary/5 border-primary/30",
  streaming: "text-primary bg-primary/5 border-primary/30",
  queued: "text-muted-foreground bg-secondary border-border",
  failed: "text-destructive bg-destructive/5 border-destructive/30",
  cancelled: "text-muted-foreground bg-secondary border-border line-through",
};

export const StatusBadge = ({ status, testid }) => (
  <span data-testid={testid} className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border rounded-full px-2.5 py-0.5 whitespace-nowrap ${STATUS[status] || STATUS.queued}`}>
    {(status === "running" || status === "streaming") && <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />}
    {status}
  </span>
);

export const Empty = ({ children, testid }) => (
  <div data-testid={testid} className="border border-dashed rounded-xl p-8 sm:p-12 text-sm text-muted-foreground bg-card/50">{children}</div>
);

export const Btn = ({ children, variant = "primary", className = "", ...p }) => {
  const v = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20",
    ghost: "border bg-card text-foreground hover:border-primary/50 hover:text-primary",
    danger: "border border-destructive/30 text-destructive bg-card hover:bg-destructive/5",
  }[variant];
  return (
    <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-full px-4 sm:px-5 py-2.5 text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none ${v} ${className}`}>
      {children}
    </button>
  );
};

export const Bar = ({ v, className = "bg-primary" }) => (
  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden"><div className={`h-full rounded-full ${className} grow-x`} style={{ width: `${Math.max(0, Math.min(100, v || 0))}%` }} /></div>
);
