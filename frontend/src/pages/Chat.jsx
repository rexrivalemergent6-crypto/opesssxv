import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PaperPlaneRight, Plus, Trash, ShieldWarning, ChatsCircle, CircleNotch, List } from "@phosphor-icons/react";
import { api, BACKEND, fmtRel } from "@/lib/api";

const STARTERS = [
  "Summarise the strongest insights the foundry has produced so far",
  "What are the main failure modes of anti-amyloid trials?",
  "Explain the TREM2–tau connection for a non-specialist",
  "Which blood biomarkers best predict MCI to AD conversion?",
];

export default function Chat() {
  const { sid } = useParams();
  const nav = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [queued, setQueued] = useState(false);
  const [showList, setShowList] = useState(false);
  const end = useRef(null);

  const loadSessions = () => api.get("/chat/sessions").then((r) => setSessions(r.data));
  useEffect(() => {
    loadSessions();
    api.get("/models").then((r) => setModels(r.data));
    api.get("/settings").then((r) => setModel((m) => m || r.data.chat_model));
  }, []);
  useEffect(() => {
    if (!sid) { setMsgs([]); return; }
    api.get(`/chat/sessions/${sid}`).then((r) => { setMsgs(r.data.messages); setModel(r.data.model); }).catch(() => nav("/app/chat"));
    setShowList(false);
  }, [sid, nav]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const send = async (override) => {
    const t = (override ?? text).trim();
    if (!t || streaming) return;
    let id = sid;
    if (!id) {
      const { data } = await api.post("/chat/sessions", { model });
      id = data.id;
      nav(`/app/chat/${id}`, { replace: true });
    }
    setText("");
    setStreaming(true);
    const tmpA = { id: "tmp-a", role: "assistant", content: "", status: "streaming" };
    setMsgs((m) => [...m, { id: "tmp-u", role: "user", content: t, status: "done" }, tmpA]);
    try {
      const res = await fetch(`${BACKEND}/api/chat/sessions/${id}/message`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t, model }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "meta") {
            setMsgs((m) => m.map((x) => (x.id === "tmp-u" ? ev.user_message : x)));
            if (ev.flags?.length) toast.message("Ethical gateway", { description: ev.flags.join(", ") });
          } else if (ev.type === "queued") setQueued(true);
          else if (ev.type === "delta") {
            setQueued(false);
            setMsgs((m) => m.map((x) => (x.id === "tmp-a" ? { ...x, content: x.content + ev.content } : x)));
          } else if (ev.type === "error") toast.error(ev.message);
          else if (ev.type === "done") setMsgs((m) => m.map((x) => (x.id === "tmp-a" ? { ...x, status: ev.status } : x)));
        }
      }
    } catch (e) {
      toast.error("Assistant unavailable — please try again");
      setMsgs((m) => m.map((x) => (x.id === "tmp-a" ? { ...x, status: "failed" } : x)));
    }
    setStreaming(false);
    setQueued(false);
    loadSessions();
  };

  const remove = async (id) => { await api.delete(`/chat/sessions/${id}`); loadSessions(); if (id === sid) nav("/app/chat"); };

  const SessionList = (
    <div className="flex flex-col h-full">
      <button data-testid="new-chat-btn" onClick={() => nav("/app/chat")} className="m-3 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-2 text-sm"><Plus size={14} /> New conversation</button>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {sessions.length === 0 && <p className="text-xs text-muted-foreground px-3">No conversations yet.</p>}
        {sessions.map((s) => (
          <div key={s.id} className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer ${s.id === sid ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
            onClick={() => nav(`/app/chat/${s.id}`)} data-testid={`chat-session-${s.id}`}>
            <div className="flex-1 min-w-0"><div className="text-sm truncate">{s.title}</div><div className="font-mono text-[10px] text-muted-foreground">{fmtRel(s.updated_at)}</div></div>
            <button onClick={(e) => { e.stopPropagation(); remove(s.id); }} className="opacity-60 sm:opacity-0 group-hover:opacity-100 hover:text-destructive" aria-label="Delete"><Trash size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div data-testid="chat-page" className="-mx-4 sm:mx-0 -my-6 sm:my-0">
      <div className="flex sm:card-soft overflow-hidden h-[calc(100dvh-56px)] sm:h-[calc(100dvh-120px)] lg:h-[calc(100dvh-80px)]">
        <aside className="hidden md:block w-64 border-r shrink-0 bg-card">{SessionList}</aside>
        {showList && (
          <div className="md:hidden fixed inset-0 z-50" onClick={() => setShowList(false)}>
            <div className="absolute inset-0 bg-foreground/30" />
            <aside className="absolute inset-y-0 left-0 w-[80vw] max-w-[300px] bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>{SessionList}</aside>
          </div>
        )}
        <section className="flex-1 flex flex-col min-w-0 bg-background sm:bg-card">
          <header className="flex items-center gap-2 px-3 sm:px-5 h-14 border-b shrink-0">
            <button onClick={() => setShowList(true)} className="md:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-secondary" data-testid="chat-sessions-toggle" aria-label="Conversations"><List size={18} /></button>
            <ChatsCircle size={20} className="text-primary hidden sm:block" weight="duotone" />
            <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">Research Assistant</div><div className="text-[10px] text-muted-foreground truncate">Grounded in foundry insights & strategy memory</div></div>
            <select data-testid="chat-model-select" value={model} onChange={(e) => setModel(e.target.value)} className="bg-card border rounded-lg text-xs px-2 py-1.5 max-w-[140px] sm:max-w-none">
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </header>
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 space-y-4" data-testid="chat-messages">
            {msgs.length === 0 && (
              <div className="max-w-xl mx-auto text-center pt-6 sm:pt-12">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 grid place-items-center"><ChatsCircle size={26} className="text-primary" weight="duotone" /></div>
                <h2 className="font-display text-2xl sm:text-3xl mt-4">Ask the foundry</h2>
                <p className="text-sm text-muted-foreground mt-2">Prompts pass an ethical gateway: injection detection and PII redaction before reaching the model.</p>
                <div className="grid sm:grid-cols-2 gap-2 mt-6 text-left">
                  {STARTERS.map((s, i) => <button key={i} data-testid={`chat-starter-${i}`} onClick={() => send(s)} className="border rounded-xl p-3 text-sm bg-card hover:border-primary/50 hover:text-primary transition-colors">{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${m.role}`}>
                <div className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border rounded-bl-md"}`}>
                  {m.role === "user" ? <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p> : (
                    <div className="md-body break-words">
                      {m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : null}
                      {m.status === "streaming" && !m.content && <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><CircleNotch className="animate-spin" size={14} />{queued ? "Queued behind a research run…" : "Thinking…"}</span>}
                      {m.status === "streaming" && m.content && <span className="caret" />}
                      {m.status === "failed" && <p className="text-xs text-destructive mt-1">Response failed.</p>}
                    </div>
                  )}
                  {m.flags?.length > 0 && <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] opacity-80"><ShieldWarning size={12} />{m.flags.join(" · ")}</div>}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <div className="border-t p-3 sm:p-4 shrink-0 bg-card" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-end gap-2">
              <textarea data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)} rows={1}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask about mechanisms, biomarkers, trials, insights…" className="flex-1 resize-none rounded-2xl border bg-background px-4 py-3 text-base sm:text-sm max-h-40 focus:outline-none focus:ring-1 focus:ring-ring" />
              <button data-testid="chat-send-btn" onClick={() => send()} disabled={streaming || !text.trim()} className="w-11 h-11 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-40" aria-label="Send">
                {streaming ? <CircleNotch className="animate-spin" size={18} /> : <PaperPlaneRight size={18} weight="fill" />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
