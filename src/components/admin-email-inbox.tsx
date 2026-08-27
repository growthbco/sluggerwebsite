"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { DropZone } from "@/components/drop-zone";

type Thread = {
  id: string;
  reference: string;
  teamName: string;
  contactEmail: string;
  status: string;
  archived: boolean;
  count: number;
  lastAt: string | null;
  lastFrom: "designer" | "client" | null;
  preview: string;
  needsReply: boolean;
};
type DesignMessage = { at: string; from: "designer" | "client"; text: string; name?: string; attachments?: string[] };
type Active = {
  id: string;
  reference: string;
  teamName: string;
  contactEmail: string;
  contactPhone: string | null;
  status: string;
  manageToken: string;
  statusToken: string;
  messages: DesignMessage[];
};
type Filter = "all" | "needs" | "archived";

const STAFF_NAMES = ["Gary", "Justin", "Bonans"];
const NAME_KEY = "slugger-sender-name";
const isImageUrl = (u: string) => /\.(png|jpe?g|webp|gif)$/i.test(u);
const fmt = (d: string) =>
  new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

const STATUS_LABEL: Record<string, string> = {
  collecting: "Collecting roster", submitted: "Needs invoice", quoted: "Awaiting payment",
  in_production: "In production", paid: "Ready to ship", shipped: "Shipped",
  proof_sent: "Proof sent", changes_requested: "Changes requested", approved: "Approved",
  ordered: "Ordered", in_design: "In design", pending_payment: "Awaiting design fee",
};

/** Email view of the Conversations inbox: every design-request thread in one
 *  place, so a customer email can be read and answered without opening the
 *  order. Threads (searchable, filterable by "needs reply") on the left, the
 *  email thread + composer on the right. Replies send from the design thread
 *  (emails the customer + logs to Discord); the AI stands down once staff has
 *  replied. */
export function AdminEmailInbox({ initialOpen }: { initialOpen?: string } = {}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Mobile is master-detail: the thread list OR the open thread, never both at
  // once. Desktop (lg+) shows both side by side.
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sender, setSender] = useState(STAFF_NAMES[0]);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(NAME_KEY) : null;
    if (saved) setSender(saved);
  }, []);
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.5))}px`;
  }, [draft]);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/emails");
      const data = await res.json();
      if (res.ok) setThreads(data.threads ?? []);
    } catch {}
  }, []);

  const loadActive = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/emails?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok) setActive(data);
    } catch {}
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Deep link from an email notification (?open=<designId>): open it straight away.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !initialOpen) return;
    deepLinked.current = true;
    setActiveId(initialOpen);
  }, [initialOpen]);

  useEffect(() => {
    if (!activeId) { setActive(null); return; }
    setMobileView("thread");
    loadActive(activeId);
  }, [activeId, loadActive]);

  // Poll: refresh the list and the open thread so a new reply shows without a
  // manual reload.
  useEffect(() => {
    const t = setInterval(() => {
      loadThreads();
      if (activeId) loadActive(activeId);
    }, 15000);
    return () => clearInterval(t);
  }, [activeId, loadThreads, loadActive]);

  // Scroll only the thread container to the newest message.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages.length, activeId]);

  async function uploadImages(files: FileList | File[]) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const f of imgs.slice(0, 10)) {
        if (f.size > 8 * 1024 * 1024) throw new Error(`${f.name || "Image"} is over 8MB.`);
        const blob = await upload(`design-media/${Date.now()}-${f.name || "image.jpg"}`, f, {
          access: "public",
          handleUploadUrl: "/api/design-request/upload",
        });
        urls.push(blob.url);
      }
      setPendingImages((p) => [...p, ...urls].slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function draftReply() {
    if (!active || drafting) return;
    setDrafting(true);
    setError("");
    try {
      const res = await fetch(`/api/design-request/${active.manageToken}/suggest-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sender, direction: draft.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft failed");
      setDraft(data.draft ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    if (!active || busy) return;
    if (!draft.trim() && pendingImages.length === 0) return;
    setBusy(true);
    setError("");
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(NAME_KEY, sender);
      const res = await fetch(`/api/design-request/${active.manageToken}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.trim(), name: sender, attachments: pendingImages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setDraft("");
      setPendingImages([]);
      setActive((a) => (a ? { ...a, messages: data.messages ?? a.messages } : a));
      loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  const q = search.trim().toLowerCase();
  const visible = threads.filter((t) => {
    if (filter === "archived") { if (!t.archived) return false; }
    else if (t.archived) return false;
    if (filter === "needs" && !t.needsReply) return false;
    if (q && !(`${t.teamName} ${t.reference} ${t.contactEmail} ${t.preview}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const needsCount = threads.filter((t) => t.needsReply && !t.archived).length;

  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      type="button"
      onClick={() => setFilter(f)}
      className={`text-xs display px-3 min-h-[44px] lg:min-h-0 py-1 inline-flex items-center border ${filter === f ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:text-foreground hover:border-brand/40"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[20rem_1fr] lg:min-h-[34rem]">
      {/* ── Threads ───────────────────────────────────────────────── */}
      <aside className={`bg-steel border border-line flex-col w-full min-w-0 overflow-hidden h-[68dvh] lg:h-auto lg:max-h-[42rem] ${mobileView === "thread" ? "hidden lg:flex" : "flex"}`}>
        <div className="p-3 border-b border-line space-y-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team, email, message…"
            className="w-full min-w-0 bg-background border border-line px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {chip("all", "All")}
            {chip("needs", needsCount ? `Needs reply · ${needsCount}` : "Needs reply")}
            {chip("archived", "Archived")}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {visible.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted">
              {threads.length === 0 ? "No email threads yet. Customer replies on a design land here." : "Nothing matches this view."}
            </p>
          )}
          {visible.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={`block w-full min-w-0 text-left px-3 py-3 border-b border-line ${activeId === t.id ? "bg-brand/10" : "hover:bg-background/40"}`}
            >
              <div className="flex items-baseline justify-between gap-2 min-w-0">
                <span className={`min-w-0 truncate text-sm ${t.needsReply ? "text-foreground font-bold" : "text-foreground"}`}>
                  {t.needsReply && <span className="inline-block h-2 w-2 rounded-full bg-brand mr-1.5 align-middle" />}
                  {t.teamName || t.reference}
                </span>
                <span className="shrink-0 text-[10px] text-muted whitespace-nowrap">{t.lastAt ? fmt(t.lastAt) : ""}</span>
              </div>
              <div className="text-[11px] text-muted truncate">{t.reference} · {STATUS_LABEL[t.status] ?? t.status}</div>
              {t.preview && (
                <div className={`mt-0.5 text-xs truncate ${t.needsReply ? "text-foreground/90" : "text-muted"}`}>
                  {t.lastFrom === "designer" ? "You: " : ""}{t.preview}
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Thread + composer ─────────────────────────────────────── */}
      <section className={`bg-steel border border-line flex-col w-full min-w-0 h-[68dvh] lg:h-auto lg:max-h-[42rem] ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
        <button
          type="button"
          onClick={() => setMobileView("list")}
          className="lg:hidden display text-sm text-foreground border-b border-line px-4 min-h-[44px] inline-flex items-center text-left hover:text-brand"
          aria-label="Back to inbox"
        >
          ‹ Inbox
        </button>
        {!active ? (
          <div className="flex-1 grid place-items-center p-6 text-center">
            <p className="text-sm text-muted">Pick a thread to read and reply. Replies email the customer and post to the design&apos;s Discord thread.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="display text-foreground flex items-center gap-2 flex-1 min-w-0">
                <span className="mx-0.5 h-8 w-8 grid place-items-center rounded-full bg-brand/15 border border-brand/40 text-xs text-brand">
                  {initials(active.teamName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{active.teamName}</span>
                  <span className="block text-[11px] text-muted font-normal truncate">
                    {active.reference} · <a href={`mailto:${active.contactEmail}`} className="hover:text-foreground">{active.contactEmail}</a>
                  </span>
                </span>
              </span>
              {active.contactPhone && (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("slugger-dial", { detail: { phone: active.contactPhone } }))}
                  className="lg:hidden display text-sm text-brand border border-brand/50 px-3 min-h-[44px] inline-flex items-center gap-1.5 hover:bg-brand/10"
                  aria-label="Call this contact"
                >
                  📞 Call
                </button>
              )}
              <Link
                href={`/admin/design-requests/${active.id}`}
                className="text-[11px] display text-muted border border-line px-2 py-1 hover:border-brand/50 hover:text-foreground"
              >
                Open order
              </Link>
            </div>

            <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {active.messages.length === 0 && <p className="text-sm text-muted">No messages in this thread yet.</p>}
              {active.messages.map((m, i) => (
                <div key={i} className={`max-w-[80%] ${m.from === "designer" ? "ml-auto" : ""}`}>
                  <div className={`px-3 py-2 text-sm whitespace-pre-wrap break-words rounded ${m.from === "designer" ? "bg-brand text-on-brand" : "bg-background text-foreground border border-line"}`}>
                    {m.text}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.attachments.map((u, j) =>
                          isImageUrl(u) ? (
                            <a key={j} href={u} target="_blank" rel="noopener noreferrer" title="Tap to open full size" className="block">
                              <Image src={u} alt="attachment" width={240} height={240} unoptimized className="w-40 sm:w-32 h-40 sm:h-32 rounded border border-black/10 object-cover" />
                            </a>
                          ) : (
                            <a key={j} href={u} target="_blank" rel="noopener noreferrer" className="text-xs underline break-all opacity-90">File {j + 1}</a>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`mt-0.5 text-[10px] text-muted ${m.from === "designer" ? "text-right" : ""}`}>
                    {m.from === "designer" ? (m.name ? `${m.name} · ` : "") : "Customer · "}{fmt(m.at)}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-line">
              {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted display mr-1">From:</span>
                {STAFF_NAMES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSender(n)}
                    className={`display px-3 py-2 lg:py-1 inline-flex items-center border ${sender === n ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:text-foreground"}`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={draftReply}
                  disabled={drafting}
                  title="AI reads this thread and the customer's order, then drafts a reply for you to edit"
                  className="ml-auto display px-3 py-2 lg:py-1 inline-flex items-center border border-brand/50 text-brand hover:bg-brand/10 disabled:opacity-50"
                >
                  {drafting ? "Drafting…" : "Draft reply"}
                </button>
              </div>
              {pendingImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingImages.map((u, i) => (
                    <span key={i} className="relative">
                      <Image src={u} alt="attachment" width={56} height={56} unoptimized className="h-14 w-14 rounded border border-line object-cover" />
                      <button
                        type="button"
                        onClick={() => setPendingImages((p) => p.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs leading-none"
                        aria-label="Remove"
                      >×</button>
                    </span>
                  ))}
                  {uploading && <span className="h-14 w-14 grid place-items-center text-xs text-muted border border-line rounded">…</span>}
                </div>
              )}
              <DropZone onFiles={uploadImages} disabled={uploading} className="flex flex-col lg:flex-row gap-2 rounded">
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  onPaste={(e) => {
                    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
                    if (imgs.length) { e.preventDefault(); uploadImages(imgs); }
                  }}
                  rows={2}
                  placeholder="Type a reply… (emails the customer)"
                  className="flex-1 w-full min-w-0 min-h-[44px] bg-background border border-line px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none resize-y overflow-y-auto"
                />
                <div className="flex flex-row lg:flex-col gap-2">
                  <label
                    title="Attach an image"
                    className={`grid place-items-center border border-line min-h-[44px] px-4 text-base cursor-pointer hover:border-brand/50 ${uploading ? "opacity-50" : ""}`}
                  >
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadImages(e.target.files); e.target.value = ""; }} />
                    📎
                  </label>
                  <button
                    type="button"
                    onClick={send}
                    disabled={busy || uploading || (!draft.trim() && pendingImages.length === 0)}
                    className="flex-1 min-h-[44px] clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-5 disabled:opacity-50"
                  >
                    {busy ? "…" : "Send"}
                  </button>
                </div>
              </DropZone>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
