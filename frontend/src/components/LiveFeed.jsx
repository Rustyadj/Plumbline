import React from "react";
import { apiClient } from "@/App";
import { Send, Bot, AlertTriangle, MessageSquare, Sparkles, Loader2 } from "lucide-react";

export default function LiveFeed({ crewName, role }) {
  const [messages, setMessages] = React.useState([]);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [ai, setAi] = React.useState({ bot_name: "@titanicf_bot", has_key: false });
  const scrollRef = React.useRef(null);

  const load = React.useCallback(async () => {
    const r = await apiClient.get("/feed");
    setMessages(r.data);
  }, []);

  React.useEffect(() => {
    load();
    apiClient.get("/ai-settings").then((r) => setAi(r.data)).catch(() => {});
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setText("");
    setSending(true);
    try {
      const r = await apiClient.post("/feed", { author: crewName, role, text: body });
      setMessages((prev) => [...prev, ...r.data.messages]);
    } catch (e) {
      setMessages((prev) => [...prev, { id: "err" + Date.now(), type: "alert", author: "System", text: "Failed to send. Check connection.", created_at: new Date().toISOString() }]);
    }
    setSending(false);
  };

  const mentionBot = () => setText((t) => (t.includes(ai.bot_name) ? t : `${ai.bot_name} ${t}`.trim() + " "));

  return (
    <div className="k-fade-in flex flex-col h-[calc(100vh-8rem)]" data-testid="live-feed">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-slate-900 tracking-tight">Live Feed</h1>
          <p className="text-sm text-slate-500 mt-1">Company-wide crew chat, out-of-tolerance alerts & your AI teammate.</p>
        </div>
        <div className={`k-pill ${ai.has_key ? "k-pill-validated" : "k-pill-rework"} shrink-0`} data-testid="ai-status">
          <Bot className="inline w-3.5 h-3.5 mr-1" />{ai.has_key ? `${ai.bot_name} online` : `${ai.bot_name} offline`}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto k-surface p-4 space-y-3" data-testid="feed-messages">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
            <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
            <div className="text-sm">No messages yet.</div>
            <div className="text-xs mt-1">Say hello or mention <span className="font-mono text-blue-600">{ai.bot_name}</span> to ask the AI.</div>
          </div>
        )}
        {messages.map((m) => <FeedRow key={m.id} m={m} botName={ai.bot_name} me={crewName} />)}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-blue-600 pl-1" data-testid="ai-thinking">
            <Loader2 className="w-4 h-4 animate-spin" /> {ai.bot_name} is working…
          </div>
        )}
      </div>

      <div className="mt-3">
        <button onClick={mentionBot} data-testid="mention-bot-btn" className="k-btn text-xs !py-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5" /> Ask {ai.bot_name}
        </button>
        <div className="flex gap-2">
          <input
            data-testid="feed-input"
            className="k-input flex-1"
            placeholder={`Message the crew… (mention ${ai.bot_name} for AI)`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button data-testid="feed-send-btn" onClick={send} disabled={sending || !text.trim()} className="k-btn k-btn-primary shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedRow({ m, botName, me }) {
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (m.type === "alert") {
    return (
      <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-3" data-testid={`feed-alert-${m.id}`}>
        <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wide">
          <AlertTriangle className="w-4 h-4" /> {m.author} · {time}
        </div>
        <div className="text-sm text-red-800 mt-1 whitespace-pre-wrap">{renderText(m.text)}</div>
      </div>
    );
  }

  if (m.type === "ai") {
    return (
      <div className="flex gap-3" data-testid={`feed-ai-${m.id}`}>
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0"><Bot className="w-5 h-5 text-white" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500"><span className="font-bold text-blue-700">{botName}</span> · {time}</div>
          <div className="mt-1 rounded-xl rounded-tl-none bg-blue-50 border border-blue-100 p-3 text-sm text-slate-800 whitespace-pre-wrap">{renderText(m.text)}</div>
          {m.meta?.actions?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {m.meta.actions.map((a, i) => <span key={i} className="k-pill k-pill-validated">✓ {a.replace(/_/g, " ")}</span>)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (m.type === "system") {
    return <div className="text-center text-xs text-slate-400 py-1" data-testid={`feed-system-${m.id}`}>{renderText(m.text)} · {time}</div>;
  }

  const mine = m.author === me;
  const initials = (m.author || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`} data-testid={`feed-msg-${m.id}`}>
      <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 text-xs font-bold">{initials}</div>
      <div className={`min-w-0 max-w-[80%] ${mine ? "text-right" : ""}`}>
        <div className="text-xs text-slate-500"><span className="font-bold text-slate-700">{m.author}</span>{m.role ? ` · ${m.role}` : ""} · {time}</div>
        <div className={`mt-1 inline-block rounded-xl p-3 text-sm text-slate-800 whitespace-pre-wrap ${mine ? "bg-blue-600 text-white rounded-tr-none" : "bg-slate-100 rounded-tl-none"}`}>{renderText(m.text)}</div>
      </div>
    </div>
  );
}

function renderText(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|@[\w\-.]+)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^@[\w\-.]+$/.test(p)) return <span key={i} className="font-semibold text-blue-600">{p}</span>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
