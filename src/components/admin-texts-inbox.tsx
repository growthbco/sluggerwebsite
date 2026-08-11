"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Conversation = {
  phone: string;
  name: string | null;
  lastAt: string;
  count: number;
  last: { body: string; direction: string; channel: string } | null;
  starred: boolean;
  archived: boolean;
  unread: boolean;
};
type Message = { id: string; phone: string; direction: string; channel: string; body: string; mediaCount: number; staff: string | null; createdAt: string };
type Context = {
  emails: string[];
  spendCents: number;
  orders: { id: string; reference: string; teamName: string; status: string; totalCents: number | null; paid: boolean; depositPaid: boolean }[];
  designs: { id: string; reference: string; teamName: string; status: string; manageToken: string | null }[];
};
type Filter = "all" | "unread" | "starred" | "archived";

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const initials = (name: string | null, phone: string) =>
  name
    ? name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : phone.replace(/\D/g, "").slice(-2);

/** The shop's mini-CRM texting hub: conversations (searchable, with unread /
 *  starred / archived states) on the left, the thread + composer in the
 *  middle, and everything we know about the customer - orders, designs,
 *  lifetime spend - on the right. Sends from (352) 414-7270 via SMS or
 *  WhatsApp; internal notes stay in the thread without texting anyone. */
export function AdminTextsInbox({ initialPhone, initialName }: { initialPhone?: string; initialName?: string } = {}) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"sms" | "whatsapp" | "note">("sms");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [pickerQ, setPickerQ] = useState("");
  const [pickerHits, setPickerHits] = useState<{ name: string; team: string | null; phone: string | null; email: string }[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  // AI draft: reads the whole thread + the customer's real orders and puts a
  // suggested reply in the box. Anything already typed is treated as the
  // staff member's own direction and gets finished, not replaced.
  async function draftReply() {
    if (!active || drafting) return;
    setDrafting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/sms/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: active, direction: draft.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft failed");
      setDraft(data.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

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

  const loadContext = useCallback(async (phone: string) => {
    setContext(null);
    try {
      const res = await fetch(`/api/admin/sms?phone=${encodeURIComponent(phone)}&context=1`);
      const data = await res.json();
      if (res.ok) setContext(data);
    } catch {}
  }, []);

  const setState = useCallback(
    async (phone: string, patch: { star?: boolean; archive?: boolean; markRead?: boolean; name?: string }) => {
      try {
        await fetch("/api/admin/sms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, ...patch }),
        });
        loadConvos();
      } catch {}
    },
    [loadConvos],
  );

  useEffect(() => { loadConvos(); }, [loadConvos]);

  // New-conversation customer search: type a name, team, or email and pick
  // the person - no phone number hunting. Debounced type-ahead against the
  // same search the invoice form uses (now team-aware).
  useEffect(() => {
    const q = pickerQ.trim();
    if (q.length < 2 || /^[\d\s()+-]+$/.test(q)) { setPickerHits([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (res.ok) setPickerHits((data.results ?? []).filter((r: { phone: string | null }) => r.phone));
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [pickerQ]);

  function pickCustomer(hit: { name: string; phone: string | null }) {
    if (!hit.phone) return;
    const digits = hit.phone.replace(/\D/g, "");
    const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
    if (!e164) return;
    setPickerQ("");
    setPickerHits([]);
    // Opening the thread picks up any existing conversation with this number;
    // saving the name labels a brand-new one from the start.
    if (hit.name) setState(e164, { name: hit.name });
    setActive(e164);
  }
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
      if (initialName) await setState(e164, { name: initialName });
      setActive(e164);
    })();
  }, [initialPhone, initialName, setState]);

  useEffect(() => {
    const t = setInterval(() => {
      loadConvos();
      if (active) loadThread(active);
    }, 12000);
    return () => clearInterval(t);
  }, [active, loadConvos, loadThread]);

  useEffect(() => {
    if (!active) return;
    loadThread(active);
    loadContext(active);
    setEditingName(false);
    setState(active, { markRead: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Scroll ONLY the thread container (scrollIntoView would drag the page).
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, active]);

  async function saveName() {
    if (!active || !nameDraft.trim()) { setEditingName(false); return; }
    await setState(active, { name: nameDraft.trim() });
    setEditingName(false);
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
        body: JSON.stringify({
          phone,
          body: draft.trim(),
          channel: mode === "whatsapp" ? "whatsapp" : "sms",
          note: mode === "note" ? true : undefined,
          name: !active && newName.trim() ? newName.trim() : undefined,
        }),
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

  const q = search.trim().toLowerCase();
  const visible = convos.filter((c) => {
    if (filter === "archived") { if (!c.archived) return false; }
    else if (c.archived) return false;
    if (filter === "unread" && !c.unread) return false;
    if (filter === "starred" && !c.starred) return false;
    if (q && !(`${c.name ?? ""} ${c.phone} ${c.last?.body ?? ""}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const activeConvo = convos.find((c) => c.phone === active);
  const unreadCount = convos.filter((c) => c.unread && !c.archived).length;

  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      type="button"
      onClick={() => setFilter(f)}
      className={`text-xs display px-2.5 py-1 border ${filter === f ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:text-foreground hover:border-brand/40"}`}
    >
      {label}
    </button>
  );

  const STATUS_LABEL: Record<string, string> = {
    collecting: "Collecting roster", submitted: "Needs invoice", quoted: "Awaiting payment",
    in_production: "In production", paid: "Ready to ship", shipped: "Shipped",
    proof_sent: "Proof sent", changes_requested: "Changes requested", approved: "Approved",
    ordered: "Ordered", in_design: "In design", pending_payment: "Awaiting design fee",
  };

  return (
    <div className="grid lg:grid-cols-[19rem_1fr] xl:grid-cols-[19rem_1fr_17rem] gap-4 min-h-[34rem]">
      {/* ── Conversations ─────────────────────────────────────────── */}
      <aside className="bg-steel border border-line flex flex-col max-h-[42rem]">
        <div className="p-3 border-b border-line space-y-2">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search threads…"
              className="flex-1 min-w-0 bg-background border border-line px-3 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { setActive(null); setMessages([]); setContext(null); }}
              title="New text"
              className={`display text-lg leading-none px-3 border ${active === null ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:text-foreground"}`}
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chip("all", "All")}
            {chip("unread", unreadCount ? `Unread · ${unreadCount}` : "Unread")}
            {chip("starred", "Starred")}
            {chip("archived", "Archived")}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted">
              {convos.length === 0 ? "No conversations yet. Texts to (352) 414-7270 land here." : "Nothing matches this view."}
            </p>
          )}
          {visible.map((c) => (
            <div key={c.phone} className={`flex items-stretch border-b border-line ${active === c.phone ? "bg-brand/10" : "hover:bg-background/40"}`}>
              <button type="button" onClick={() => setActive(c.phone)} className="flex-1 min-w-0 text-left px-3 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-sm truncate ${c.unread ? "text-foreground font-bold" : "text-foreground"}`}>
                    {c.unread && <span className="inline-block h-2 w-2 rounded-full bg-brand mr-1.5 align-middle" />}
                    {c.name ?? prettyPhone(c.phone)}
                  </span>
                  <span className="text-[10px] text-muted whitespace-nowrap">{fmt(c.lastAt)}</span>
                </div>
                {c.name && <div className="text-xs text-muted">{prettyPhone(c.phone)}</div>}
                {c.last && (
                  <div className={`mt-0.5 text-xs truncate ${c.unread ? "text-foreground/90" : "text-muted"}`}>
                    {c.last.direction === "out" ? "You: " : c.last.direction === "note" ? "📝 " : ""}
                    {c.last.channel === "whatsapp" ? "🟢 " : ""}
                    {c.last.body}
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setState(c.phone, { star: !c.starred })}
                title={c.starred ? "Unstar" : "Star"}
                className={`px-2 text-sm ${c.starred ? "text-brand" : "text-line hover:text-muted"}`}
              >
                ★
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Thread ────────────────────────────────────────────────── */}
      <section className="bg-steel border border-line flex flex-col max-h-[42rem]">
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
              <span className="display text-foreground flex items-center gap-2 flex-1 min-w-0">
                <span className="truncate">{activeConvo?.name ?? prettyPhone(active)}</span>
                <span className="text-muted text-xs font-normal whitespace-nowrap">{prettyPhone(active)}</span>
                <button
                  type="button"
                  onClick={() => { setNameDraft(activeConvo?.name ?? ""); setEditingName(true); }}
                  className="text-[11px] display text-muted border border-line px-1.5 py-0.5 hover:border-brand/50 hover:text-foreground"
                >
                  {activeConvo?.name ? "Rename" : "+ Name"}
                </button>
              </span>
            )
          ) : (
            <span className="flex-1 min-w-[16rem]">
              <span className="relative block">
                <input
                  value={pickerQ}
                  onChange={(e) => setPickerQ(e.target.value)}
                  placeholder="Search a customer by name, team, or email…"
                  autoFocus
                  className="w-full bg-background border border-brand/40 px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                />
                {pickerHits.length > 0 && (
                  <span className="absolute left-0 right-0 top-full z-20 mt-1 block border border-line bg-steel shadow-xl max-h-64 overflow-y-auto">
                    {pickerHits.map((h) => (
                      <button
                        key={h.email}
                        type="button"
                        onClick={() => pickCustomer(h)}
                        className="block w-full text-left px-3 py-2 hover:bg-brand/10 border-b border-line/60 last:border-b-0"
                      >
                        <span className="text-sm text-foreground">{h.name || h.email}</span>
                        {h.team && <span className="ml-2 text-xs text-brand">{h.team}</span>}
                        <span className="block text-xs text-muted">{h.phone ? prettyPhone(h.phone) : ""} · {h.email}</span>
                      </button>
                    ))}
                  </span>
                )}
              </span>
              <span className="mt-2 flex gap-2">
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="…or a raw phone number"
                  className="flex-1 bg-background border border-line px-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                  inputMode="tel"
                />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name (optional)"
                  className="flex-1 bg-background border border-line px-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                />
              </span>
            </span>
          )}
          {active && activeConvo && (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setState(active, { star: !activeConvo.starred })}
                title={activeConvo.starred ? "Unstar" : "Star"}
                className={`text-base px-1.5 ${activeConvo.starred ? "text-brand" : "text-muted hover:text-foreground"}`}
              >
                ★
              </button>
              <button
                type="button"
                onClick={() => { setState(active, { archive: !activeConvo.archived }); if (!activeConvo.archived) setActive(null); }}
                title={activeConvo.archived ? "Unarchive" : "Archive"}
                className="text-xs display text-muted border border-line px-2 py-1 hover:border-brand/40 hover:text-foreground"
              >
                {activeConvo.archived ? "Unarchive" : "🗄 Archive"}
              </button>
            </span>
          )}
        </div>

        <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {active && messages.length === 0 && <p className="text-sm text-muted">Loading…</p>}
          {!active && <p className="text-sm text-muted">Start a new conversation - enter a number above and type below. It sends from (352) 414-7270.</p>}
          {messages.map((m) =>
            m.direction === "note" ? (
              <div key={m.id} className="mx-auto max-w-[90%] text-center">
                <div className="inline-block px-3 py-1.5 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded whitespace-pre-wrap break-words">
                  📝 {m.body}
                </div>
                <div className="mt-0.5 text-[10px] text-muted">Internal note · {fmt(m.createdAt)}</div>
              </div>
            ) : (
              <div key={m.id} className={`max-w-[80%] ${m.direction === "out" ? "ml-auto" : ""}`}>
                <div className={`px-3 py-2 text-sm whitespace-pre-wrap break-words rounded ${m.direction === "out" ? "bg-brand text-on-brand" : "bg-background text-foreground border border-line"}`}>
                  {m.body}
                  {m.mediaCount > 0 && <div className="text-xs opacity-70 mt-1">📎 {m.mediaCount} attachment{m.mediaCount === 1 ? "" : "s"} (view in Twilio)</div>}
                </div>
                <div className={`mt-0.5 text-[10px] text-muted ${m.direction === "out" ? "text-right" : ""}`}>
                  {m.channel === "whatsapp" ? "WhatsApp · " : ""}{fmt(m.createdAt)}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="p-3 border-t border-line">
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <div className="mb-2 flex items-center gap-1.5 text-xs">
            <span className="text-muted display mr-1">Send via:</span>
            {([["sms", "SMS"], ["whatsapp", "WhatsApp"], ["note", "📝 Note"]] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`display px-2.5 py-1 border ${mode === m ? (m === "note" ? "bg-amber-500/20 border-amber-500/50 text-amber-200" : "bg-brand text-on-brand border-brand") : "border-line text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
            {mode === "note" && <span className="text-muted">saved to the thread - the customer never sees it</span>}
            {active && mode !== "note" && (
              <button
                type="button"
                onClick={draftReply}
                disabled={drafting}
                title="AI reads this conversation and the customer's orders, then drafts a reply for you to edit"
                className="ml-auto display px-2.5 py-1 border border-brand/50 text-brand hover:bg-brand/10 disabled:opacity-50"
              >
                {drafting ? "Drafting…" : "✨ Draft reply"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={2}
              placeholder={mode === "note" ? "Internal note… (Enter to save)" : "Type a message… (Enter to send)"}
              className="flex-1 bg-background border border-line px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none resize-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !draft.trim() || (!active && !newPhone.trim())}
              className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-5 disabled:opacity-50"
            >
              {busy ? "…" : mode === "note" ? "Save" : "Send"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Customer panel ────────────────────────────────────────── */}
      <aside className="hidden xl:flex bg-steel border border-line flex-col max-h-[42rem] overflow-y-auto">
        {!active ? (
          <p className="p-4 text-sm text-muted">Pick a conversation to see the customer&apos;s orders and history here.</p>
        ) : (
          <div className="p-4 space-y-4">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 grid place-items-center rounded-full bg-brand/15 border border-brand/40 display text-lg text-brand">
                {initials(activeConvo?.name ?? null, active)}
              </div>
              <p className="mt-2 display text-foreground">{activeConvo?.name ?? prettyPhone(active)}</p>
              <p className="text-xs text-muted">{prettyPhone(active)}</p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("slugger-dial", { detail: { phone: active } }))}
                className="mt-2 text-xs display border border-brand/50 text-brand px-3 py-1 hover:bg-brand/10"
              >
                📞 Call
              </button>
              {context?.emails.map((e) => (
                <p key={e} className="text-xs text-muted truncate"><a href={`mailto:${e}`} className="hover:text-foreground">{e}</a></p>
              ))}
            </div>

            {context === null ? (
              <p className="text-xs text-muted text-center">Loading customer info…</p>
            ) : (
              <>
                <div className="border border-line bg-background px-3 py-2 flex items-baseline justify-between">
                  <span className="text-xs text-muted display uppercase tracking-wide">Lifetime spend</span>
                  <span className="display text-lg text-brand">{money(context.spendCents)}</span>
                </div>

                {context.orders.length > 0 && (
                  <div>
                    <p className="text-xs display uppercase tracking-wide text-muted">Orders ({context.orders.length})</p>
                    <div className="mt-1.5 space-y-1.5">
                      {context.orders.map((o) => (
                        <Link key={o.id} href={`/admin/team-order/${o.id}`} className="block border border-line bg-background px-3 py-2 hover:border-brand/50">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm text-foreground truncate">{o.teamName}</span>
                            {o.totalCents ? <span className="text-xs text-muted">{money(o.totalCents)}</span> : null}
                          </div>
                          <div className="text-[11px] text-muted">
                            {o.reference} · {STATUS_LABEL[o.status] ?? o.status}
                            {o.paid ? " · paid ✓" : o.depositPaid ? " · deposit ✓" : ""}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {context.designs.length > 0 && (
                  <div>
                    <p className="text-xs display uppercase tracking-wide text-muted">Design projects ({context.designs.length})</p>
                    <div className="mt-1.5 space-y-1.5">
                      {context.designs.map((d) => (
                        <a
                          key={d.id}
                          href={d.manageToken ? `/design/manage/${d.manageToken}` : "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block border border-line bg-background px-3 py-2 hover:border-brand/50"
                        >
                          <div className="text-sm text-foreground truncate">{d.teamName}</div>
                          <div className="text-[11px] text-muted">{d.reference} · {STATUS_LABEL[d.status] ?? d.status}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {context.orders.length === 0 && context.designs.length === 0 && (
                  <p className="text-xs text-muted text-center">No orders or designs matched to this number yet.</p>
                )}
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
