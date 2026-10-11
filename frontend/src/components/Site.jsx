import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { motion, useInView, animate } from "framer-motion";
import { List, X, ArrowRight } from "@phosphor-icons/react";
import { Logo } from "@/components/Layout";


/* Drifting "cells" with synaptic links — the animated background. */
export const CellsCanvas = ({ density = 1 }) => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w, h, dpr, raf, cells = [];
    const mouse = { x: -999, y: -999 };
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 16000) * density);
      cells = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: 1.2 + Math.random() * 2.8,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, p: Math.random() * Math.PI * 2,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const a of cells) {
        a.x += a.vx; a.y += a.vy; a.p += 0.02;
        if (a.x < -10) a.x = w + 10; if (a.x > w + 10) a.x = -10;
        if (a.y < -10) a.y = h + 10; if (a.y > h + 10) a.y = -10;
        const dx = a.x - mouse.x, dy = a.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 120) { a.x += dx / d * 0.6; a.y += dy / d * 0.6; }
      }
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i], b = cells[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            ctx.strokeStyle = `hsla(216, 82%, 50%, ${0.14 * (1 - d / 130)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const a of cells) {
        const glow = 0.35 + Math.sin(a.p) * 0.2;
        ctx.fillStyle = `hsla(216, 82%, 52%, ${glow})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    const mm = (e) => { const r = c.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
    resize(); draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", mm);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", mm); };
  }, [density]);
  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" />;
};

/* Boot gate shown once per session. */
export const Gate = () => {
  const [show, setShow] = useState(() => !sessionStorage.getItem("alz-gate"));
  const [msg, setMsg] = useState("waking orchestrator");
  useEffect(() => {
    if (!show) return;
    const steps = ["registering 10 agents", "loading strategy memory", "connecting PubMed · ClinicalTrials.gov · Open Targets", "ready"];
    const ts = steps.map((s, i) => setTimeout(() => setMsg(s), 300 + i * 320));
    const end = setTimeout(() => { sessionStorage.setItem("alz-gate", "1"); setShow(false); }, 1700);
    return () => { ts.forEach(clearTimeout); clearTimeout(end); };
  }, [show]);
  if (!show) return null;
  return (
    <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-background grid place-items-center" data-testid="boot-gate">
      <div className="text-center">
        <div className="relative w-28 h-28 mx-auto">
          <span className="absolute inset-0 rounded-full border border-primary/30 animate-ping" />
          <span className="absolute inset-3 rounded-full border border-primary/40 spin-slow" style={{ borderStyle: "dashed" }} />
          <span className="absolute inset-[42%] rounded-full bg-primary" />
        </div>
        <p className="font-display text-3xl mt-6">OpenAlz</p>
        <p className="font-mono text-xs text-muted-foreground mt-2">{msg}<span className="caret" /></p>
      </div>
    </motion.div>
  );
};

export const Reveal = ({ children, delay = 0, className = "", y = 18 }) => (
  <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}>
    {children}
  </motion.div>
);

export const CountUp = ({ to = 0, className = "", decimals = 0 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, Number(to) || 0, { duration: 1.4, ease: "easeOut", onUpdate: (x) => setV(x) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref} className={className}>{v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</span>;
};

const LINKS = [
  { href: "/#live", label: "Live" },
  { href: "/#loop", label: "How it works" },
  { href: "/#swarm", label: "Agents" },
  { href: "/#notebook", label: "Insights" },
];

export const SiteNav = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 10);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled || open ? "bg-background/90 backdrop-blur border-b" : "bg-transparent"}`} data-testid="site-nav">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-sm">
          {LINKS.map((l) => <a key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>)}
          <NavLink to="/doc" data-testid="nav-docs" className={({ isActive }) => isActive ? "text-primary" : "text-muted-foreground hover:text-foreground transition-colors"}>Docs</NavLink>
          <Link to="/app" data-testid="nav-open-app" className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-sm shadow-primary/30 hover:gap-2.5 transition-all">Open the foundry <ArrowRight size={14} /></Link>
        </nav>
        <button className="md:hidden w-10 h-10 grid place-items-center rounded-full hover:bg-secondary" onClick={() => setOpen(!open)} data-testid="site-menu-btn" aria-label="Menu">
          {open ? <X size={20} /> : <List size={20} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t bg-background px-4 pb-5 pt-2" data-testid="site-mobile-menu">
          {LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-3 border-b text-base">{l.label}</a>)}
          <Link to="/doc" onClick={() => setOpen(false)} className="block py-3 border-b text-base">Docs & research library</Link>
          <Link to="/app" onClick={() => setOpen(false)} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium">Open the foundry <ArrowRight size={14} /></Link>
        </div>
      )}
    </header>
  );
};

export const SiteFooter = () => (
  <footer className="border-t bg-card">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
      <div className="sm:col-span-2">
        <Logo />
        <p className="text-muted-foreground mt-3 max-w-sm leading-relaxed">A self-evolving agentic research foundry for Alzheimer's disease, built in the open. Not medical advice.</p>
      </div>
      <div className="space-y-2">
        <div className="label-xs mb-3">Explore</div>
        <Link to="/app" className="block text-muted-foreground hover:text-primary">Foundry app</Link>
        <Link to="/doc" className="block text-muted-foreground hover:text-primary">Documentation</Link>
        <Link to="/doc#library" className="block text-muted-foreground hover:text-primary">Research library</Link>
        <Link to="/app/chat" className="block text-muted-foreground hover:text-primary">Research assistant</Link>
      </div>
      <div className="space-y-2">
        <div className="label-xs mb-3">Open data</div>
        <a href="https://pubmed.ncbi.nlm.nih.gov/" target="_blank" rel="noreferrer" className="block text-muted-foreground hover:text-primary">PubMed</a>
        <a href="https://clinicaltrials.gov/" target="_blank" rel="noreferrer" className="block text-muted-foreground hover:text-primary">ClinicalTrials.gov</a>
        <a href="https://platform.opentargets.org/" target="_blank" rel="noreferrer" className="block text-muted-foreground hover:text-primary">Open Targets</a>
      </div>
    </div>
    <div className="border-t"><p className="max-w-6xl mx-auto px-4 sm:px-6 py-5 font-mono text-[11px] text-muted-foreground">OpenAlz · every claim cites a verifiable PMID or NCT ID · every action is audited</p></div>
  </footer>
);

export const SecHead = ({ num, title, children, id }) => (
  <Reveal>
    <div id={id} className="scroll-mt-24">
      <p className="font-mono text-xs text-primary">{num}</p>
      <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight mt-2 text-balance">{title}</h2>
      {children && <div className="text-muted-foreground mt-4 max-w-2xl leading-relaxed text-[15px] sm:text-base">{children}</div>}
    </div>
  </Reveal>
);

/* deterministic short fingerprint for receipts */
export const fingerprint = (s = "") => {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0"));
};

export const asciiBar = (v, n = 12) => {
  const f = Math.round(((v || 0) / 100) * n);
  return "█".repeat(f) + "·".repeat(n - f);
};
