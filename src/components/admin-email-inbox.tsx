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
  contactEmail: string | null;
  status: string;
  archived: boolean;
  count: number;
  lastAt: string | null;
  lastFrom: "designer" | "client" | null;
  preview: string;
  needsReply: boolean;
};
type DesignMessage = {
  at: string;
  from: "designer" | "client";
  text: string;
  name?: string;
  attachments?: string[];
};
type Active = {
  id: string;
  reference: string;
  teamName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  manageToken: string;
  statusToken: string | null;
  messages: DesignMessage[];
};
type Filter = "all" | "needs" | "archived";

const STAFF_NAMES = ["Gary", "Justin", "Bonans"];
const NAME_KEY = "slugger-sender-name";
const isImageUrl = (u: string) => /\.(png|jpe?g|webp|gif)$/i.test(u);
const fmt = (d: string) =>
  new Date(d).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

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

/** Email view of the Conversations inbox: every design-request thread in one
 *  place, so a customer email can be read and answered without opening the
 *  order. Threads (searchable, filterable by "needs reply") on the left, the
 *  email thread + composer on the right. Replies send from the design thread
 *  (emails the customer + logs to Discord); the AI stands down once staff has
 *  replied. */
export function AdminEmailInbox({
  initialOpen,
  currentUserName,
  restricted = false,
}: { initialOpen?: string; currentUserName: string; restricted?: boolean }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Mobile is master-detail: the thread list OR the open thread, never both at
  // once. Desktop (lg+) shows both side by side.
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sender, setSender] = useState(restricted ? currentUserName : STAFF_NAMES[0]);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (restricted) return;
    const timeout = window.setTimeout(() => {
      const saved = window.localStorage.getItem(NAME_KEY);
      if (saved) setSender(saved);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [restricted]);
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

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadThreads(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadThreads]);

  // Deep link from an email notification (?open=<designId>): open it straight away.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !initialOpen) return;
    deepLinked.current = true;
    setActiveId(initialOpen);
  }, [initialOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!activeId) {
        setActive(null);
        return;
      }
      setMobileView("thread");
      void loadActive(activeId);
    }, 0);
    return () => window.clearTimeout(timeout);
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
        if (f.size > 8 * 1024 * 1024)
          throw new Error(`${f.name || "Image"} is over 8MB.`);
        const blob = await upload(
          `design-media/${Date.now()}-${f.name || "image.jpg"}`,
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

  async function draftReply() {
    if (!active || drafting) return;
    setDrafting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/design-request/${active.manageToken}/suggest-reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: sender,
            direction: draft.trim() || undefined,
          }),
        },
      );
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
      if (!restricted && typeof window !== "undefined")
        window.localStorage.setItem(NAME_KEY, sender);
      const res = await fetch(
        `/api/design-request/${active.manageToken}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: draft.trim(),
            name: sender,
            attachments: pendingImages,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setDraft("");
      setPendingImages([]);
      setActive((a) =>
        a ? { ...a, messages: data.messages ?? a.messages } : a,
      );
      loadThreads();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  const q = search.trim().toLowerCase();
  const visible = threads.filter((t) => {
    if (filter === "archived") {
      if (!t.archived) return false;
    } else if (t.archived) return false;
    if (filter === "needs" && !t.needsReply) return false;
    if (
      q &&
      !`${t.teamName} ${t.reference} ${t.contactEmail ?? ""} ${t.preview}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  });
  const needsCount = threads.filter((t) => t.needsReply && !t.archived).length;

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

  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden border border-line bg-steel shadow-[0_18px_60px_rgba(0,0,0,0.18)] lg:grid lg:h-[calc(100dvh-10.5rem)] lg:max-h-[52rem] lg:min-h-0 lg:grid-cols-[22rem_minmax(0,1fr)]">
      {/* ── Threads ───────────────────────────────────────────────── */}
      <aside
        className={`min-w-0 flex-col overflow-hidden bg-steel lg:h-full lg:min-h-0 lg:border-r lg:border-line ${mobileView === "thread" ? "hidden lg:flex" : "flex h-[calc(100dvh-9rem)]"}`}
      >
        <div className="space-y-3 border-b border-line bg-background/25 p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team, email, message…"
            className="w-full min-w-0 rounded-md border border-line bg-background px-3 py-2 text-base text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none sm:text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {chip("all", "All")}
            {chip(
              "needs",
              needsCount ? `Needs reply · ${needsCount}` : "Needs reply",
            )}
            {chip("archived", "Archived")}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {visible.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted">
              {threads.length === 0
                ? "No email threads yet. Customer replies on a design land here."
                : "Nothing matches this view."}
            </p>
          )}
          {visible.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={`grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-b border-l-2 border-line px-3 py-3 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand ${activeId === t.id ? "border-l-brand bg-brand/10" : "border-l-transparent hover:bg-background/45"}`}
            >
              <span
                className={`relative grid h-10 w-10 place-items-center rounded-full border text-xs font-semibold ${activeId === t.id ? "border-brand/60 bg-brand/15 text-brand" : "border-line bg-background text-muted"}`}
              >
                {initials(t.teamName || t.reference)}
                {t.needsReply && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-steel bg-brand"
                    aria-label="Needs reply"
                  />
                )}
              </span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span
                    className={`min-w-0 truncate text-sm text-foreground ${t.needsReply ? "font-bold" : ""}`}
                  >
                    {t.teamName || t.reference}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[10px] text-muted">
                    {t.lastAt ? fmt(t.lastAt) : ""}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">
                  {t.reference} · {STATUS_LABEL[t.status] ?? t.status}
                </span>
                {t.preview && (
                  <span
                    className={`mt-1 block truncate text-xs ${t.needsReply ? "text-foreground/90" : "text-muted"}`}
                  >
                    {t.lastFrom === "designer" ? "You: " : ""}
                    {t.preview}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Thread + composer ─────────────────────────────────────── */}
      <section
        className={`min-w-0 flex-col bg-steel lg:h-full lg:min-h-0 ${mobileView === "list" ? "hidden lg:flex" : "flex h-[calc(100dvh-9rem)]"}`}
      >
        <button
          type="button"
          onClick={() => setMobileView("list")}
          className="display inline-flex min-h-[44px] items-center border-b border-line px-4 text-left text-sm text-foreground hover:text-brand lg:hidden"
          aria-label="Back to inbox"
        >
          ‹ Inbox
        </button>
        {!active ? (
          <div className="flex-1 grid place-items-center p-6 text-center">
            <p className="max-w-md text-sm leading-6 text-muted">
              Pick a thread to read and reply. Replies email the customer and
              post to the design&apos;s Discord thread.
            </p>
          </div>
        ) : (
          <>
            <div className="flex min-h-[64px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-background/20 px-4 py-2">
              <span className="display text-foreground flex items-center gap-2 flex-1 min-w-0">
                <span className="mx-0.5 grid h-10 w-10 place-items-center rounded-full border border-brand/40 bg-brand/15 text-xs text-brand">
                  {initials(active.teamName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{active.teamName}</span>
                  <span className="block text-[11px] text-muted font-normal truncate">
                    {active.reference}
                    {active.contactEmail && (
                      <>
                        {" · "}
                        <a
                          href={`mailto:${active.contactEmail}`}
                          className="hover:text-foreground"
                        >
                          {active.contactEmail}
                        </a>
                      </>
                    )}
                  </span>
                </span>
              </span>
              {active.contactPhone && (
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("slugger-dial", {
                        detail: { phone: active.contactPhone },
                      }),
                    )
                  }
                  className="lg:hidden display text-sm text-brand border border-brand/50 px-3 min-h-[44px] inline-flex items-center gap-1.5 hover:bg-brand/10"
                  aria-label="Call this contact"
                >
                  📞 Call
                </button>
              )}
              <Link
                href={`/admin/design-requests/${active.id}`}
                className="display inline-flex min-h-[36px] items-center rounded-md border border-line px-3 text-[10px] text-muted hover:border-brand/50 hover:text-foreground"
              >
                Open order
              </Link>
            </div>

            <div
              ref={threadRef}
              className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_20%)] p-3 sm:p-5"
            >
              {active.messages.length === 0 && (
                <p className="text-sm text-muted">
                  No messages in this thread yet.
                </p>
              )}
              {active.messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[78%] sm:max-w-[70%] ${m.from === "designer" ? "ml-auto" : ""}`}
                >
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-5 whitespace-pre-wrap break-words ${m.from === "designer" ? "rounded-br-sm bg-brand text-on-brand shadow-sm" : "rounded-bl-sm border border-line bg-background text-foreground"}`}
                  >
                    {m.text}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.attachments.map((u, j) =>
                          isImageUrl(u) ? (
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
                          ) : (
                            <a
                              key={j}
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline break-all opacity-90"
                            >
                              File {j + 1}
                            </a>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className={`mt-1 px-1 text-[10px] text-muted ${m.from === "designer" ? "text-right" : ""}`}
                  >
                    {m.from === "designer"
                      ? m.name
                        ? `${m.name} · `
                        : ""
                      : "Customer · "}
                    {fmt(m.at)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-line bg-background/20 p-3 pr-20 lg:pr-28">
              {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="display mr-1 text-[10px] uppercase tracking-wider text-muted">
                  From
                </span>
                {restricted ? (
                  <span className="display inline-flex min-h-[34px] items-center rounded-full border border-brand/70 bg-brand/15 px-3 py-1 text-[10px] text-brand lg:min-h-0">
                    {currentUserName}
                  </span>
                ) : (
                  STAFF_NAMES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSender(n)}
                      className={`display inline-flex min-h-[34px] items-center rounded-full border px-3 py-1 text-[10px] lg:min-h-0 ${sender === n ? "border-brand/70 bg-brand/15 text-brand" : "border-line text-muted hover:text-foreground"}`}
                    >
                      {n}
                    </button>
                  ))
                )}
                <button
                  type="button"
                  onClick={draftReply}
                  disabled={drafting}
                  title={restricted ? "AI reads this design conversation, then drafts a reply for you to edit" : "AI reads this thread and the customer's order, then drafts a reply for you to edit"}
                  className="display ml-auto inline-flex min-h-[34px] items-center rounded-md border border-brand/40 px-3 py-1 text-[10px] text-brand hover:bg-brand/10 disabled:opacity-50 lg:min-h-0"
                >
                  {drafting ? "Drafting…" : "✦ Draft reply"}
                </button>
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
                disabled={uploading}
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
                  placeholder="Type a reply… (emails the customer)"
                  className="min-h-[48px] w-full min-w-0 flex-1 resize-y overflow-y-auto rounded-lg border border-line bg-background px-3.5 py-2.5 text-base text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none sm:text-sm"
                />
                <div className="flex flex-row lg:flex-col gap-2">
                  <label
                    title="Attach an image"
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
                  <button
                    type="button"
                    onClick={send}
                    disabled={
                      busy ||
                      uploading ||
                      (!draft.trim() && pendingImages.length === 0)
                    }
                    className="display min-h-[44px] flex-1 rounded-md bg-brand px-5 text-on-brand hover:bg-brand-dark disabled:opacity-50"
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
