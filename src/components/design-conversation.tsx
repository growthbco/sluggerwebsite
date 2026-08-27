"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import type { DesignMessage } from "@/components/design-messages";

// One conversation for a design request, merging the in-app/email design thread
// and the customer's SMS into a single time-ordered timeline with an
// All / Email / Texts filter - instead of two separate stacked inboxes. The
// composer picks a channel (Email posts to the design thread; Text sends an
// SMS) and routes to the matching endpoint. Admin-only (texts need staff auth).

type SmsMessage = {
  id: string;
  phone: string;
  direction: "in" | "out" | "note";
  channel: string;
  body: string;
  mediaUrls: string[] | null;
  staff: string | null;
  createdAt: string;
};

type Item = {
  key: string;
  channel: "email" | "text";
  side: "in" | "out";
  note?: boolean;
  at: string;
  text: string;
  who?: string | null;
  attachments: string[];
};

const STAFF_NAMES = ["Gary", "Justin", "Bonans"];
const NAME_KEY = "slugger-sender-name";
const isImageUrl = (u: string) => /\.(png|jpe?g|webp|gif)$/i.test(u);
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2 break-all hover:opacity-80">
        {part.length > 60 ? `${new URL(part).hostname} link` : part}
      </a>
    ) : (
      part
    ),
  );
}

export function DesignConversation({
  token,
  phone,
  name,
  initialDesignMessages,
}: {
  token: string;
  phone: string | null;
  name?: string | null;
  initialDesignMessages: DesignMessage[];
}) {
  const [designMsgs, setDesignMsgs] = useState<DesignMessage[]>(initialDesignMessages);
  const [smsMsgs, setSmsMsgs] = useState<SmsMessage[]>([]);
  const [filter, setFilter] = useState<"all" | "email" | "text">("all");
  const [channel, setChannel] = useState<"email" | "text">("email");
  const [draft, setDraft] = useState("");
  const [senderName, setSenderName] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<"" | "sending" | "refreshing">("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved && STAFF_NAMES.includes(saved)) setSenderName(saved);
    } catch {}
  }, []);

  const loadSms = useCallback(async () => {
    if (!phone) return;
    try {
      const res = await fetch(`/api/admin/sms?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSmsMsgs(data.messages ?? []);
    } catch {}
  }, [phone]);

  useEffect(() => {
    loadSms();
  }, [loadSms]);

  // If there are no texts, don't offer the Text channel/filter at all.
  const hasSms = Boolean(phone);

  // Merge both sources into one timeline.
  const items: Item[] = [
    ...designMsgs.map((m, i) => ({
      key: `d-${i}-${m.at}`,
      channel: "email" as const,
      side: m.from === "designer" ? ("out" as const) : ("in" as const),
      at: m.at,
      text: m.text,
      who: m.name,
      attachments: m.attachments ?? [],
    })),
    ...smsMsgs.map((m) => ({
      key: `s-${m.id}`,
      channel: "text" as const,
      side: m.direction === "out" ? ("out" as const) : ("in" as const),
      note: m.direction === "note",
      at: m.createdAt,
      text: m.body,
      who: m.staff,
      attachments: m.mediaUrls ?? [],
    })),
  ]
    .filter((it) => filter === "all" || it.channel === filter)
    .sort((a, b) => +new Date(a.at) - +new Date(b.at));

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const cap = channel === "text" ? 5 : 25;
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (channel === "text" && !file.type.startsWith("image/")) continue;
        if (file.size > cap * 1024 * 1024) throw new Error(`${file.name} is over ${cap}MB${channel === "text" ? " - carriers reject large MMS" : ""}.`);
        const blob = await upload(`design-messages/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/design-request/upload",
        });
        urls.push(blob.url);
      }
      setPending((p) => [...p, ...urls]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text && pending.length === 0) return;
    if (channel === "email" && !senderName) {
      setError("Pick who's replying first.");
      return;
    }
    setBusy("sending");
    setError("");
    try {
      if (channel === "email") {
        try { if (senderName) localStorage.setItem(NAME_KEY, senderName); } catch {}
        const res = await fetch(`/api/design-request/${token}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, name: senderName, attachments: pending }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not send");
        setDesignMsgs(data.messages);
      } else {
        const res = await fetch("/api/admin/sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, body: text, name: senderName || name || undefined, mediaUrls: pending }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Send failed");
        if (data.message) setSmsMsgs((m) => [...m, data.message]);
      }
      setDraft("");
      setPending([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function refresh() {
    setBusy("refreshing");
    setError("");
    try {
      const [dRes] = await Promise.all([
        fetch(`/api/design-request/${token}/message`).then((r) => r.json()).catch(() => null),
        loadSms(),
      ]);
      if (dRes?.messages) setDesignMsgs(dRes.messages);
    } finally {
      setBusy("");
    }
  }

  const FILTERS: { key: "all" | "email" | "text"; label: string }[] = hasSms
    ? [{ key: "all", label: "All" }, { key: "email", label: "Email" }, { key: "text", label: "Texts" }]
    : [{ key: "all", label: "All" }, { key: "email", label: "Email" }];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="display text-xl text-foreground">Messages</h2>
        <div className="flex items-center gap-2">
          <div className="flex border border-line divide-x divide-[color:var(--line)]">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`display text-xs px-3 py-1.5 transition-colors ${filter === f.key ? "bg-brand text-on-brand" : "text-muted hover:text-foreground"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={busy !== ""}
            className="text-xs display text-foreground border border-line px-3 py-1.5 hover:border-brand/50 disabled:opacity-50"
          >
            {busy === "refreshing" ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      {hasSms && <p className="text-xs text-muted mt-1">Email = the design thread the customer sees. Texts = SMS to {name ? `${name} at ` : ""}{phone}. Only logged-in staff see texts.</p>}

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted">No messages yet.</p>
        ) : (
          items.map((it) => (
            <div key={it.key} className={`flex ${it.side === "out" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-4 py-2.5 border text-sm ${it.note ? "bg-ink border-dashed border-line" : it.side === "out" ? "bg-brand/10 border-brand/40" : "bg-steel border-line"}`}>
                <p className="text-xs text-muted mb-1 flex items-center gap-1.5">
                  <span className={`inline-block px-1.5 py-0.5 text-[10px] display border ${it.channel === "text" ? "border-brand/40 text-brand" : "border-line text-muted"}`}>
                    {it.note ? "NOTE" : it.channel === "text" ? "TEXT" : "EMAIL"}
                  </span>
                  <span>
                    {it.side === "out" ? it.who || "Slugger team" : "Client"} · {fmtTime(it.at)}
                  </span>
                </p>
                {it.text && <p className="text-foreground whitespace-pre-line break-words">{linkify(it.text)}</p>}
                {it.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {it.attachments.map((url, j) =>
                      isImageUrl(url) ? (
                        <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="block" title="Open full size">
                          <Image src={url} alt="attachment" width={112} height={112} unoptimized className="h-28 w-28 object-cover border border-line" />
                        </a>
                      ) : (
                        <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs display text-brand border border-brand/40 px-2 py-1 hover:bg-brand/10 max-w-[12rem]">
                          <span className="truncate">{decodeURIComponent(url.split("/").pop() ?? "file")}</span>
                        </a>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer: pick the channel, then write. */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs display text-muted">Reply by:</span>
          <div className="flex border border-line divide-x divide-[color:var(--line)]">
            <button type="button" onClick={() => setChannel("email")} className={`display text-xs px-3 py-1.5 ${channel === "email" ? "bg-brand text-on-brand" : "text-muted hover:text-foreground"}`}>Email</button>
            {hasSms && <button type="button" onClick={() => setChannel("text")} className={`display text-xs px-3 py-1.5 ${channel === "text" ? "bg-brand text-on-brand" : "text-muted hover:text-foreground"}`}>Text</button>}
          </div>
          <select
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="bg-steel border border-line px-3 py-1.5 text-sm text-foreground focus:border-brand focus:outline-none"
          >
            <option value="">Who&apos;s replying?</option>
            {STAFF_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {pending.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pending.map((u, i) => (
              <div key={u} className="relative">
                <Image src={u} alt="attachment" width={64} height={64} unoptimized className="h-16 w-16 object-cover border border-line" />
                <button type="button" onClick={() => setPending((p) => p.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink border border-line text-muted hover:text-foreground text-xs" aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2 items-end">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={channel === "text" ? "Type a text to the customer..." : "Message the client (emailed with a link back)..."}
            className="flex-1 bg-steel border border-line px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none min-h-16"
            disabled={busy === "sending"}
          />
          <label
            title="Attach a photo or file"
            className={`inline-flex items-center gap-1.5 border border-line px-3 py-3 text-sm text-foreground shrink-0 ${uploading || busy === "sending" ? "opacity-50" : "cursor-pointer hover:border-brand/50 hover:text-brand"}`}
          >
            <input type="file" accept={channel === "text" ? "image/*" : "image/*,application/pdf"} multiple className="hidden" disabled={uploading || busy === "sending"} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.44 11.05l-9.19 9.19a5.5 5.5 0 01-7.78-7.78l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a1.5 1.5 0 01-2.12-2.12l8.49-8.49" />
            </svg>
            <span className="display">{uploading ? "Uploading…" : "Photo"}</span>
          </label>
          <button
            type="button"
            onClick={send}
            disabled={busy !== "" || uploading || (!draft.trim() && pending.length === 0)}
            className="clip-slant bg-brand text-on-brand display text-sm px-5 py-3 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy === "sending" ? "Sending..." : channel === "text" ? "Send Text" : "Send Email"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-brand">{error}</p>}
      </div>
    </section>
  );
}
