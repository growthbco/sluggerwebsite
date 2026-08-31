"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { DropZone } from "@/components/drop-zone";

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
type Message = {
  id: string;
  phone: string;
  direction: string;
  channel: string;
  body: string;
  mediaCount: number;
  mediaUrls: string[] | null;
  staff: string | null;
  createdAt: string;
};
type Context = {
  emails: string[];
  spendCents: number;
  orders: {
    id: string;
    reference: string;
    teamName: string;
    status: string;
    totalCents: number | null;
    paid: boolean;
    depositPaid: boolean;
    rushShipping: boolean;
  }[];
  designs: {
    id: string;
    reference: string;
    teamName: string;
    status: string;
    manageToken: string | null;
  }[];
};
type Filter = "all" | "unread" | "starred" | "archived";

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10
    ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    : p;
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
const isAutomatedMessage = (message: Message) =>
  message.direction === "out" &&
  /^(Slugger Athletics:|Hi .+[,—-].*Slugger Athletics)/i.test(
    message.body.trim(),
  );

/** The shop's mini-CRM texting hub: conversations (searchable, with unread /
 *  starred / archived states) on the left, the thread + composer in the
 *  middle, and everything we know about the customer - orders, designs,
 *  lifetime spend - on the right. Sends from (352) 414-7270 via SMS or
 *  WhatsApp; internal notes stay in the thread without texting anyone. */
export function AdminTextsInbox({
  initialPhone,
  initialName,
  restricted = false,
}: { initialPhone?: string; initialName?: string; restricted?: boolean } = {}) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  // Mobile is master-detail: the list OR the open thread, never both cramped
  // onto one screen. Desktop (lg+) shows them side by side regardless.
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  const [draft, setDraft] = useState("");
  // Composer auto-grows with the message (up to ~half the screen) so long
  // replies - like an AI draft - are fully visible to proofread before sending.
  // Staff can still drag the handle to size it manually.
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.5))}px`;
  }, [draft]);
  const [mode, setMode] = useState<"sms" | "whatsapp" | "note">("sms");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [pickerQ, setPickerQ] = useState("");
  const [pickerHits, setPickerHits] = useState<
    { name: string; team: string | null; phone: string | null; email: string }[]
  >([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
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
        body: JSON.stringify({
          phone: active,
          direction: draft.trim() || undefined,
        }),
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

  // Attach images to an outgoing MMS: upload each to our public Blob store,
  // then send with the message. Drag/drop, paste, or the button all feed
  // this. Notes stay text-only (nothing goes to the customer).
  async function uploadImages(files: FileList | File[]) {
    if (mode === "note") {
      setError("Switch to SMS or WhatsApp to attach an image.");
      return;
    }
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const f of imgs.slice(0, 10)) {
        if (f.size > 5 * 1024 * 1024)
          throw new Error(
            `${f.name || "Image"} is over 5MB - carriers reject large MMS.`,
          );
        const blob = await upload(
          `sms-media/${Date.now()}-${f.name || "image.jpg"}`,
          f,
          {
            access: "public",
            handleUploadUrl: "/api/design-request/upload",
          },
        );
        urls.push(blob.url);
      }
      setPendingImages((p) => [...p, ...urls].slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
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
      const res = await fetch(
        `/api/admin/sms?phone=${encodeURIComponent(phone)}`,
      );
      const data = await res.json();
      if (res.ok) setMessages(data.messages ?? []);
    } catch {}
  }, []);

  const loadContext = useCallback(async (phone: string) => {
    if (restricted) return;
    setContext(null);
    try {
      const res = await fetch(
        `/api/admin/sms?phone=${encodeURIComponent(phone)}&context=1`,
      );
      const data = await res.json();
      if (res.ok) setContext(data);
    } catch {}
  }, [restricted]);

  const setState = useCallback(
    async (
      phone: string,
      patch: {
        star?: boolean;
        archive?: boolean;
        markRead?: boolean;
        name?: string;
      },
    ) => {
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

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadConvos(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadConvos]);

  // New-conversation customer search: type a name, team, or email and pick
  // the person - no phone number hunting. Debounced type-ahead against the
  // same search the invoice form uses (now team-aware).
  useEffect(() => {
    if (restricted) return;
    const q = pickerQ.trim();
    const shouldSearch = q.length >= 2 && !/^[\d\s()+-]+$/.test(q);
    const t = window.setTimeout(async () => {
      if (!shouldSearch) {
        setPickerHits([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/admin/customers/search?q=${encodeURIComponent(q)}`,
        );
        const data = await res.json();
        if (res.ok)
          setPickerHits(
            (data.results ?? []).filter(
              (r: { phone: string | null }) => r.phone,
            ),
          );
      } catch {}
    }, shouldSearch ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [pickerQ, restricted]);

  function pickCustomer(hit: { name: string; phone: string | null }) {
    if (!hit.phone) return;
    const digits = hit.phone.replace(/\D/g, "");
    const e164 =
      digits.length === 10
        ? `+1${digits}`
        : digits.length === 11 && digits.startsWith("1")
          ? `+${digits}`
          : null;
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
    const e164 =
      digits.length === 10
        ? `+1${digits}`
        : digits.length === 11 && digits.startsWith("1")
          ? `+${digits}`
          : null;
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
    const timeout = window.setTimeout(() => {
      void loadThread(active);
      void loadContext(active);
      setEditingName(false);
      setMobileView("thread");
      void setState(active, { markRead: true });
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Scroll ONLY the thread container (scrollIntoView would drag the page).
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, active]);

  async function saveName() {
    if (!active || !nameDraft.trim()) {
      setEditingName(false);
      return;
    }
    await setState(active, { name: nameDraft.trim() });
    setEditingName(false);
  }

  async function send() {
    const phone = active ?? newPhone;
    if (!phone || busy) return;
    if (!draft.trim() && pendingImages.length === 0) return;
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
          mediaUrls: mode === "note" ? undefined : pendingImages,
          name: !active && newName.trim() ? newName.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setDraft("");
      setPendingImages([]);
      if (!active) {
        setActive(data.message.phone);
        setNewPhone("");
        setNewName("");
      } else loadThread(active);
      loadConvos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  const q = search.trim().toLowerCase();
  const visible = convos.filter((c) => {
    if (filter === "archived") {
      if (!c.archived) return false;
    } else if (c.archived) return false;
    if (filter === "unread" && !c.unread) return false;
    if (filter === "starred" && !c.starred) return false;
    if (
      q &&
      !`${c.name ?? ""} ${c.phone} ${c.last?.body ?? ""}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  });
  const activeConvo = convos.find((c) => c.phone === active);
  const unreadCount = convos.filter((c) => c.unread && !c.archived).length;

  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      type="button"
      onClick={() => setFilter(f)}
      className={`display inline-flex min-h-[36px] items-center rounded-full border px-3 py-1 text-[11px] transition-colors lg:min-h-0 ${filter === f ? "border-brand/70 bg-brand/15 text-brand" : "border-line text-muted hover:border-brand/40 hover:text-foreground"}`}
    >
      {label}
    </button>
  );

  const STATUS_LABEL: Record<string, string> = {
    collecting: "Collecting roster",
    submitted: "Needs invoice",
    quoted: "Awaiting payment",
    in_production: "In production",
    paid: "Ready to ship",
    shipped: "Shipped",
    proof_sent: "Proof sent",
    changes_requested: "Changes requested",
    approved: "Approved",
    ordered: "Ordered",
    in_design: "In design",
    pending_payment: "Awaiting design fee",
  };

  const orderValueCents =
    context?.orders.reduce((sum, order) => sum + (order.totalCents ?? 0), 0) ??
    0;

  return (
    <div className={`flex min-h-[32rem] flex-col overflow-hidden border border-line bg-steel shadow-[0_18px_60px_rgba(0,0,0,0.18)] lg:grid lg:h-[calc(100dvh-10.5rem)] lg:max-h-[52rem] lg:min-h-0 lg:grid-cols-[20rem_minmax(0,1fr)] ${restricted ? "" : "xl:grid-cols-[19rem_minmax(28rem,1fr)_18rem]"}`}>
      {/* ── Conversations ─────────────────────────────────────────── */}
      <aside
        className={`min-w-0 flex-col overflow-hidden bg-steel lg:h-full lg:min-h-0 lg:border-r lg:border-line ${mobileView === "thread" ? "hidden lg:flex" : "flex h-[calc(100dvh-9rem)]"}`}
      >
        <div className="space-y-3 border-b border-line bg-background/25 p-3">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="min-w-0 flex-1 rounded-md border border-line bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setActive(null);
                setMessages([]);
                setContext(null);
                setMobileView("thread");
              }}
              title="New text"
              className={`display inline-flex min-h-[40px] items-center gap-1 rounded-md border px-3 text-xs ${active === null ? "border-brand bg-brand text-on-brand" : "border-line text-muted hover:border-brand/50 hover:text-foreground"}`}
            >
              <span className="text-base leading-none">+</span> New
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chip("all", "All")}
            {chip("unread", unreadCount ? `Unread · ${unreadCount}` : "Unread")}
            {chip("starred", "Starred")}
            {chip("archived", "Archived")}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {visible.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted">
              {convos.length === 0
                ? "No conversations yet. Texts to (352) 414-7270 land here."
                : "Nothing matches this view."}
            </p>
          )}
          {visible.map((c) => (
            <div
              key={c.phone}
              className={`group relative min-w-0 border-b border-line transition-colors ${active === c.phone ? "bg-brand/10" : "hover:bg-background/45"}`}
            >
              <button
                type="button"
                onClick={() => setActive(c.phone)}
                className={`grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-l-2 px-3 py-3 text-left outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand ${active === c.phone ? "border-l-brand" : "border-l-transparent"}`}
              >
                <span
                  className={`relative grid h-10 w-10 place-items-center rounded-full border text-xs font-semibold ${active === c.phone ? "border-brand/60 bg-brand/15 text-brand" : "border-line bg-background text-muted"}`}
                >
                  {initials(c.name, c.phone)}
                  {c.unread && (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-steel bg-brand"
                      aria-label="Unread"
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-baseline justify-between gap-2 pr-5">
                    <span
                      className={`min-w-0 truncate text-sm text-foreground ${c.unread ? "font-bold" : ""}`}
                    >
                      {c.name ?? prettyPhone(c.phone)}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-muted">
                      {fmt(c.lastAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
                    {c.name && (
                      <span className="truncate">{prettyPhone(c.phone)}</span>
                    )}
                    {c.last?.channel === "whatsapp" && (
                      <span className="rounded-full border border-emerald-500/30 px-1.5 text-[9px] text-emerald-300">
                        WA
                      </span>
                    )}
                  </span>
                  {c.last && (
                    <span
                      className={`mt-1 block truncate pr-5 text-xs ${c.unread ? "text-foreground/90" : "text-muted"}`}
                    >
                      {c.last.direction === "out" ? "You: " : ""}
                      {c.last.body}
                    </span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setState(c.phone, { star: !c.starred })}
                title={c.starred ? "Unstar" : "Star"}
                className={`absolute bottom-2.5 right-2 grid h-7 w-7 place-items-center rounded-full text-sm leading-none transition-opacity ${c.starred ? "text-brand" : "text-muted opacity-0 hover:bg-background group-hover:opacity-100 focus:opacity-100"}`}
              >
                ★
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Thread ────────────────────────────────────────────────── */}
      <section
        className={`min-w-0 flex-col bg-steel lg:h-full lg:min-h-0 xl:border-r xl:border-line ${mobileView === "list" ? "hidden lg:flex" : "flex h-[calc(100dvh-9rem)]"}`}
      >
        <div className="flex min-h-[64px] flex-wrap items-center gap-2 border-b border-line bg-background/20 px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => setMobileView("list")}
            className="display inline-flex min-h-[40px] items-center rounded-md border border-line px-3 text-sm text-foreground hover:border-brand/50 lg:hidden"
            aria-label="Back to conversations"
          >
            ‹ Inbox
          </button>
          {active ? (
            editingName ? (
              <span className="flex items-center gap-2 flex-1 min-w-[14rem]">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                  }}
                  placeholder="Contact name"
                  autoFocus
                  className="flex-1 bg-background border border-line px-3 py-1.5 text-sm text-foreground focus:border-brand focus:outline-none"
                />
                <button
                  type="button"
                  onClick={saveName}
                  className="text-xs display text-brand border border-brand/50 px-2 py-1 hover:bg-brand/10"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-3 text-foreground">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/15 text-xs font-semibold text-brand">
                  {initials(activeConvo?.name ?? null, active)}
                </span>
                <span className="min-w-0">
                  <span className="display block truncate text-sm sm:text-base">
                    {activeConvo?.name ?? prettyPhone(active)}
                  </span>
                  <span className="block truncate text-[11px] font-normal text-muted">
                    {prettyPhone(active)} · Text conversation
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(activeConvo?.name ?? "");
                    setEditingName(true);
                  }}
                  className="hidden rounded border border-line px-2 py-1 text-[10px] text-muted hover:border-brand/50 hover:text-foreground sm:block"
                >
                  {activeConvo?.name ? "Edit" : "+ Name"}
                </button>
              </span>
            )
          ) : (
            <span className="flex-1 min-w-[16rem]">
              {!restricted && (
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
                          <span className="text-sm text-foreground">
                            {h.name || h.email}
                          </span>
                          {h.team && (
                            <span className="ml-2 text-xs text-brand">
                              {h.team}
                            </span>
                          )}
                          <span className="block text-xs text-muted">
                            {h.phone ? prettyPhone(h.phone) : ""} · {h.email}
                          </span>
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              )}
              <span className={`${restricted ? "" : "mt-2"} flex gap-2`}>
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder={restricted ? "Phone number" : "…or a raw phone number"}
                  autoFocus={restricted}
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
              {!restricted && (
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("slugger-dial", {
                        detail: { phone: active },
                      }),
                    )
                  }
                  className="display inline-flex min-h-[36px] items-center rounded-md border border-brand/40 px-3 text-[11px] text-brand hover:bg-brand/10"
                  aria-label="Call this contact"
                >
                  Call
                </button>
              )}
              <button
                type="button"
                onClick={() => setState(active, { star: !activeConvo.starred })}
                title={activeConvo.starred ? "Unstar" : "Star"}
                className={`grid h-9 w-9 place-items-center rounded-md border border-line text-base ${activeConvo.starred ? "text-brand" : "text-muted hover:text-foreground"}`}
              >
                ★
              </button>
              <button
                type="button"
                onClick={() => {
                  setState(active, { archive: !activeConvo.archived });
                  if (!activeConvo.archived) setActive(null);
                }}
                title={activeConvo.archived ? "Unarchive" : "Archive"}
                className="display hidden min-h-[36px] items-center rounded-md border border-line px-3 text-[10px] text-muted hover:border-brand/40 hover:text-foreground sm:inline-flex"
              >
                {activeConvo.archived ? "Unarchive" : "Archive"}
              </button>
            </span>
          )}
        </div>

        <div
          ref={threadRef}
          className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_20%)] p-3 sm:p-5"
        >
          {active && messages.length === 0 && (
            <p className="text-sm text-muted">Loading…</p>
          )}
          {!active && (
            <div className="grid h-full min-h-52 place-items-center px-6 text-center">
              <div>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-brand/30 bg-brand/10 text-xl text-brand">
                  +
                </div>
                <p className="display mt-3 text-foreground">
                  Start a conversation
                </p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted">
                  Find a customer above or enter a phone number. Messages send
                  from the Slugger shop line.
                </p>
              </div>
            </div>
          )}
          {messages.map((m) =>
            m.direction === "note" ? (
              <div key={m.id} className="mx-auto max-w-[90%] text-center">
                <div className="inline-block rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200/90 whitespace-pre-wrap break-words">
                  {m.body}
                </div>
                <div className="mt-0.5 text-[10px] text-muted">
                  Internal note · {fmt(m.createdAt)}
                </div>
              </div>
            ) : isAutomatedMessage(m) ? (
              <details
                key={m.id}
                className="group mx-auto max-w-[88%] rounded-md border border-brand/20 bg-brand/[0.06] text-xs text-muted"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 hover:text-foreground">
                  <span className="min-w-0 truncate">
                    <span className="mr-1.5 text-brand">●</span>Automated
                    Slugger update
                  </span>
                  <span className="shrink-0 text-[10px]">
                    {fmt(m.createdAt)}{" "}
                    <span className="ml-1 inline-block transition-transform group-open:rotate-180">
                      ⌄
                    </span>
                  </span>
                </summary>
                <div className="border-t border-brand/15 px-3 py-2 leading-5 text-foreground/80 whitespace-pre-wrap break-words">
                  {m.body}
                </div>
              </details>
            ) : (
              <div
                key={m.id}
                className={`max-w-[78%] sm:max-w-[70%] ${m.direction === "out" ? "ml-auto" : ""}`}
              >
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-5 whitespace-pre-wrap break-words ${m.direction === "out" ? "rounded-br-sm bg-brand text-on-brand shadow-sm" : "rounded-bl-sm border border-line bg-background text-foreground"}`}
                >
                  {m.body}
                  {m.mediaUrls && m.mediaUrls.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.mediaUrls.map((u, j) => (
                        <a
                          key={j}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Tap to open full size"
                          className="block"
                        >
                          <Image
                            src={u}
                            alt="attachment"
                            width={240}
                            height={240}
                            unoptimized
                            className="w-40 sm:w-32 h-40 sm:h-32 rounded border border-black/10 object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  {m.mediaCount > 0 &&
                    (!m.mediaUrls || m.mediaUrls.length === 0) && (
                      <div className="text-xs opacity-70 mt-1">
                        {m.mediaCount} attachment{m.mediaCount === 1 ? "" : "s"}
                      </div>
                    )}
                </div>
                <div
                  className={`mt-1 px-1 text-[10px] text-muted ${m.direction === "out" ? "text-right" : ""}`}
                >
                  {m.direction === "out"
                    ? m.staff
                      ? `${m.staff} · `
                      : "You · "
                    : "Customer · "}
                  {m.channel === "whatsapp" ? "WhatsApp · " : ""}
                  {fmt(m.createdAt)}
                </div>
              </div>
            ),
          )}
        </div>

        <div
          className={`border-t p-3 pr-20 lg:pr-28 xl:pr-3 ${mode === "note" ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-line bg-background/20"}`}
        >
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="display mr-1 text-[10px] uppercase tracking-wider text-muted">
              Channel
            </span>
            {(
              [
                ["sms", "SMS"],
                ["whatsapp", "WhatsApp"],
                ["note", "Note"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`display inline-flex min-h-[34px] items-center rounded-full border px-3 py-1 text-[10px] transition-colors lg:min-h-0 ${mode === m ? (m === "note" ? "border-amber-500/50 bg-amber-500/20 text-amber-200" : "border-brand/70 bg-brand/15 text-brand") : "border-line text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
            {mode === "note" && (
              <span className="text-amber-200/70">
                Internal only — the customer will not see this
              </span>
            )}
            {active && mode !== "note" && !restricted && (
              <button
                type="button"
                onClick={draftReply}
                disabled={drafting}
                title="AI reads this conversation and the customer's orders, then drafts a reply for you to edit"
                className="display ml-auto inline-flex min-h-[34px] items-center rounded-md border border-brand/40 px-3 py-1 text-[10px] text-brand hover:bg-brand/10 disabled:opacity-50 lg:min-h-0"
              >
                {drafting ? "Drafting…" : "✦ Draft reply"}
              </button>
            )}
          </div>
          {pendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingImages.map((u, i) => (
                <span key={i} className="relative">
                  <Image
                    src={u}
                    alt="attachment"
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 rounded border border-line object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPendingImages((p) => p.filter((_, j) => j !== i))
                    }
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs leading-none"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
              {uploading && (
                <span className="h-14 w-14 grid place-items-center text-xs text-muted border border-line rounded">
                  …
                </span>
              )}
            </div>
          )}
          <DropZone
            onFiles={uploadImages}
            disabled={uploading || mode === "note"}
            className="flex flex-col gap-2 rounded-lg lg:flex-row"
          >
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              onPaste={(e) => {
                const imgs = Array.from(e.clipboardData.files).filter((f) =>
                  f.type.startsWith("image/"),
                );
                if (imgs.length) {
                  e.preventDefault();
                  uploadImages(imgs);
                }
              }}
              rows={2}
              placeholder={
                mode === "note" ? "Internal note…" : "Type a message…"
              }
              className={`min-h-[48px] w-full min-w-0 flex-1 resize-y overflow-y-auto rounded-lg border px-3.5 py-2.5 text-base text-foreground placeholder:text-muted/60 focus:outline-none sm:text-sm ${mode === "note" ? "border-amber-500/30 bg-amber-950/10 focus:border-amber-500/60" : "border-line bg-background focus:border-brand"}`}
            />
            <div className="flex flex-row lg:flex-col gap-2">
              {mode !== "note" && (
                <label
                  title="Attach an image (MMS)"
                  className={`grid min-h-[44px] cursor-pointer place-items-center rounded-md border border-line px-4 text-base hover:border-brand/50 ${uploading ? "opacity-50" : ""}`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) uploadImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  📎
                </label>
              )}
              <button
                type="button"
                onClick={send}
                disabled={
                  busy ||
                  uploading ||
                  (!draft.trim() && pendingImages.length === 0) ||
                  (!active && !newPhone.trim())
                }
                className="display min-h-[44px] flex-1 rounded-md bg-brand px-5 text-on-brand hover:bg-brand-dark disabled:opacity-50"
              >
                {busy ? "…" : mode === "note" ? "Save" : "Send"}
              </button>
            </div>
          </DropZone>
        </div>
      </section>

      {/* ── Customer panel ────────────────────────────────────────── */}
      {!restricted && <aside className="hidden flex-col overflow-y-auto bg-background/20 xl:flex">
        {!active ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-line bg-background text-muted">
                ○
              </div>
              <p className="display mt-3 text-sm text-foreground">
                Customer snapshot
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Choose a conversation to see contact details, orders and
                designs.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-4">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/15 text-sm font-semibold text-brand">
                {initials(activeConvo?.name ?? null, active)}
              </div>
              <div className="min-w-0">
                <p className="display truncate text-sm text-foreground">
                  {activeConvo?.name ?? prettyPhone(active)}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {prettyPhone(active)}
                </p>
                {context?.emails.slice(0, 1).map((e) => (
                  <p key={e} className="truncate text-[11px] text-muted">
                    <a href={`mailto:${e}`} className="hover:text-foreground">
                      {e}
                    </a>
                  </p>
                ))}
              </div>
            </div>

            {context === null ? (
              <p className="text-xs text-muted text-center">
                Loading customer info…
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-line bg-background px-3 py-2.5">
                    <span className="display block text-[9px] uppercase tracking-wide text-muted">
                      Paid to date
                    </span>
                    <span className="display mt-1 block text-lg text-brand">
                      {money(context.spendCents)}
                    </span>
                  </div>
                  <div className="rounded-md border border-line bg-background px-3 py-2.5">
                    <span className="display block text-[9px] uppercase tracking-wide text-muted">
                      Order value
                    </span>
                    <span className="display mt-1 block text-lg text-foreground">
                      {money(orderValueCents)}
                    </span>
                  </div>
                </div>

                {context.orders.length > 0 && (
                  <div>
                    <p className="display text-[10px] uppercase tracking-[0.16em] text-muted">
                      Orders ({context.orders.length})
                    </p>
                    <div className="mt-2 space-y-2">
                      {context.orders.map((o) => (
                        <Link
                          key={o.id}
                          href={`/admin/team-order/${o.id}`}
                          className="block rounded-md border border-line bg-background px-3 py-2.5 hover:border-brand/50"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm text-foreground truncate">
                              {o.teamName}
                            </span>
                            {o.totalCents ? (
                              <span className="text-xs text-muted">
                                {money(o.totalCents)}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                            <span>{o.reference}</span>
                            <span className="rounded-full border border-brand/20 bg-brand/[0.06] px-1.5 py-0.5 text-brand">
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                            {o.paid
                              ? " · paid "
                              : o.depositPaid
                                ? " · deposit "
                                : ""}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {context.designs.length > 0 && (
                  <div>
                    <p className="display text-[10px] uppercase tracking-[0.16em] text-muted">
                      Designs ({context.designs.length})
                    </p>
                    <div className="mt-2 space-y-2">
                      {context.designs.map((d) => (
                        <a
                          key={d.id}
                          href={
                            d.manageToken
                              ? `/design/manage/${d.manageToken}`
                              : "#"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-md border border-line bg-background px-3 py-2.5 hover:border-brand/50"
                        >
                          <div className="text-sm text-foreground truncate">
                            {d.teamName}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
                            <span>{d.reference}</span>
                            <span className="rounded-full border border-line px-1.5 py-0.5">
                              {STATUS_LABEL[d.status] ?? d.status}
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {context.orders.length === 0 &&
                  context.designs.length === 0 && (
                    <p className="text-xs text-muted text-center">
                      No orders or designs matched to this number yet.
                    </p>
                  )}
              </>
            )}
          </div>
        )}
      </aside>}
    </div>
  );
}
