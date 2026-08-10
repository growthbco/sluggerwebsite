"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Conversation = { phone: string; name: string | null; lastAt: string; count: number; last: { body: string; direction: string; channel: string } | null };
type Message = { id: string; phone: string; direction: string; channel: string; body: string; mediaCount: number; createdAt: string };

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

/** The shop's texting inbox: conversations on the left, thread + composer on
 *  the right. Sends from (352) 414-7270 via SMS or WhatsApp. Polls so new
 *  inbound texts appear without a refresh. */
export function AdminTextsInbox({ initialPhone, initialName }: { initialPhone?: string; initialName?: string } = {}) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConvos = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sms");
      const data = await res.json();
      if (res.ok) setConvos(data.conversations ?? []);
    } catch {}
  }, []);

  const loadThread = useCallback(async (phone: string) => {
    try {
      const res = await fetch(`/api/admin/sms?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (res.ok) setMessages(data.messages ?? []);
    } catch {}
  }, []);

  useEffect(() => { loadConvos(); }, [loadConvos]);
  // Deep link from an order page (?to=&name=): open that customer's thread
  // immediately, saving the name so the conversation is labeled from the start.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !initialPhone) return;
    deepLinked.current = true;
    const digits = initialPhone.replace(/\D/g, "");
    const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
    if (!e164) return;
    (async () => {
      if (initialName) {
        try {
          await fetch("/api/admin/sms", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: e164, name: initialName }),
          });
        } catch {}
      }
      setActive(e164);
      loadConvos();
    })();
  }, [initialPhone, initialName, loadConvos]);
  useEffect(() => {
    const t = setInterval(() => {
      loadConvos();
      if (active) loadThread(active);
    }, 12000);
    return () => clearInterval(t);
  }, [active, loadConvos, loadThread]);
  useEffect(() => { if (active) loadThread(active); setEditingName(false); }, [active, loadThread]);
  // Scroll ONLY the thread container (scrollIntoView would drag the whole
  // page down every refresh).
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, active]);

  async function saveName() {
    if (!active || !nameDraft.trim()) { setEditingName(false); return; }
    try {
      await fetch("/api/admin/sms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: active, name: nameDraft.trim() }),
      });
      setEditingName(false);
      loadConvos();
    } catch {}
  }

  async function send() {
    const phone = active ?? newPhone;
    if (!phone || !draft.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, body: draft.trim(), channel, name: !active && newName.trim() ? newName.trim() : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setDraft("");
      if (!active) { setActive(data.message.phone); setNewPhone(""); setNewName(""); }
      else loadThread(active);
      loadConvos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[18rem_1fr] gap-4 min-h-[32rem]">
      {/* Conversations */}
      <aside className="bg-steel border border-line overflow-y-auto max-h-[40rem]">
        <button
          type="button"
          onClick={() => { setActive(null); setMessages([]); }}
          className={`w-full text-left px-4 py-3 border-b border-line display text-sm ${active === null ? "bg-brand/10 text-brand" : "text-muted hover:text-foreground"}`}
        >
          ✏️ New text
        </button>
        {convos.length === 0 && <p className="px-4 py-6 text-sm text-muted">No conversations yet. Texts to (352) 414-7270 land here.</p>}
        {convos.map((c) => (
          <button
            key={c.phone}
            type="button"
            onClick={() => setActive(c.phone)}
            className={`w-full text-left px-4 py-3 border-b border-line ${active === c.phone ? "bg-brand/10" : "hover:bg-background/40"}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-foreground truncate">{c.name ?? prettyPhone(c.phone)}</span>
              <span className="text-[10px] text-muted whitespace-nowrap">{fmt(c.lastAt)}</span>
            </div>
            {c.name && <div className="text-xs text-muted">{prettyPhone(c.phone)}</div>}
            {c.last && (
              <div className="mt-0.5 text-xs text-muted truncate">
                {c.last.direction === "out" ? "You: " : ""}{c.last.channel === "whatsapp" ? "🟢 " : ""}{c.last.body}
              </div>
            )}
          </button>
        ))}
      </aside>

      {/* Thread */}
      <section className="bg-steel border border-line flex flex-col max-h-[40rem]">
        <div className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-3">
          {active ? (
            editingName ? (
              <span className="flex items-center gap-2 flex-1 min-w-[14rem]">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                  placeholder="Contact name"
                  autoFocus
                  className="flex-1 bg-background border border-line px-3 py-1.5 text-sm text-foreground focus:border-brand focus:outline-none"
                />
                <button type="button" onClick={saveName} className="text-xs display text-brand border border-brand/50 px-2 py-1 hover:bg-brand/10">Save</button>
                <button type="button" onClick={() => setEditingName(false)} className="text-xs text-muted hover:text-foreground">Cancel</button>
              </span>
            ) : (
              <span className="display text-foreground flex items-center gap-2">
                {convos.find((c) => c.phone === active)?.name ?? prettyPhone(active)}
                <span className="text-muted text-xs font-normal">{prettyPhone(active)}</span>
                <button
                  type="button"
                  onClick={() => { setNameDraft(convos.find((c) => c.phone === active)?.name ?? ""); setEditingName(true); }}
                  className="text-[11px] display text-muted border border-line px-1.5 py-0.5 hover:border-brand/50 hover:text-foreground"
                  title="Attach a name to this number"
                >
                  {convos.find((c) => c.phone === active)?.name ? "Rename" : "+ Name"}
                </button>
              </span>
            )
          ) : (
            <span className="flex flex-1 gap-2 min-w-[16rem]">
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone number, e.g. (352) 555-0123"
                className="flex-1 bg-background border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                inputMode="tel"
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (optional)"
                className="flex-1 bg-background border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
              />
            </span>
          )}
          <select value={channel} onChange={(e) => setChannel(e.target.value as "sms" | "whatsapp")} className="bg-background border border-line text-xs text-foreground px-2 py-1.5">
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>

        <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {active && messages.length === 0 && <p className="text-sm text-muted">Loading…</p>}
          {!active && <p className="text-sm text-muted">Start a new conversation - enter a number above and type below. It sends from (352) 414-7270.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[80%] ${m.direction === "out" ? "ml-auto" : ""}`}>
              <div className={`px-3 py-2 text-sm whitespace-pre-wrap break-words rounded ${m.direction === "out" ? "bg-brand text-on-brand" : "bg-background text-foreground border border-line"}`}>
                {m.body}
                {m.mediaCount > 0 && <div className="text-xs opacity-70 mt-1">📎 {m.mediaCount} attachment{m.mediaCount === 1 ? "" : "s"} (view in Twilio)</div>}
              </div>
              <div className={`mt-0.5 text-[10px] text-muted ${m.direction === "out" ? "text-right" : ""}`}>
                {m.channel === "whatsapp" ? "WhatsApp · " : ""}{fmt(m.createdAt)}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-line">
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={2}
              placeholder="Type a message… (Enter to send)"
              className="flex-1 bg-background border border-line px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none resize-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !draft.trim() || (!active && !newPhone.trim())}
              className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-5 disabled:opacity-50"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
