"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Admin-only SMS thread embedded in a design request's manage page. Loads and
// sends through the same /api/admin/sms endpoint the Texts inbox uses, scoped
// to this customer's phone. Rendered only for a logged-in admin session.

type Message = {
  id: string;
  phone: string;
  direction: "in" | "out" | "note";
  channel: string;
  body: string;
  mediaUrls: string[] | null;
  staff: string | null;
  createdAt: string;
};

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function DesignRequestSms({ phone, name, token }: { phone: string; name?: string | null; token: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sms?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) throw new Error("Could not load messages");
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load messages");
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const [pinning, setPinning] = useState<string | null>(null);
  async function useAsInspiration(url: string) {
    setPinning(url);
    setError(null);
    try {
      const res = await fetch("/api/admin/design-request/add-inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, url }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Could not add");
      // Reload so the AI studio on this page picks up the new inspiration image.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to studio");
      setPinning(null);
    }
  }

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, body: text, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Send failed");
      if (data.message) setMessages((m) => [...m, data.message]);
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-steel border border-line clip-slant p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-xl text-foreground">Text Messages</h2>
        <a href={`/admin/texts?to=${encodeURIComponent(phone)}${name ? `&name=${encodeURIComponent(name)}` : ""}`} className="text-xs text-brand hover:underline">
          Open in Texts inbox
        </a>
      </div>
      <p className="text-xs text-muted mt-1">Texting {name ? `${name} at ` : ""}{phone}. Only you (logged-in staff) can see this.</p>

      <div className="mt-4 max-h-80 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">No texts yet. Send the first one below.</p>
        ) : (
          messages.map((m) => {
            const out = m.direction === "out";
            const note = m.direction === "note";
            return (
              <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] clip-slant px-3 py-2 text-sm ${
                    note
                      ? "bg-ink border border-dashed border-line text-muted"
                      : out
                      ? "bg-brand text-on-brand"
                      : "bg-ink border border-line text-foreground"
                  }`}
                >
                  {note && <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">Internal note</div>}
                  {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                  {m.mediaUrls && m.mediaUrls.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {m.mediaUrls.map((u, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <a href={u} target="_blank" rel="noreferrer">
                            <img src={u} alt="texted image" className="max-h-44 rounded border border-line" />
                          </a>
                          {m.direction === "in" && (
                            <button
                              onClick={() => useAsInspiration(u)}
                              disabled={pinning === u}
                              className="text-[11px] display text-brand hover:underline disabled:opacity-50 text-left"
                            >
                              {pinning === u ? "Adding…" : "+ Use as inspiration"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={`mt-1 text-[10px] ${out && !note ? "text-on-brand/70" : "text-muted"}`}>
                    {out && m.staff ? `${m.staff} · ` : ""}{time(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="text-[#e5533c] text-sm mt-2">{error}</p>}

      <div className="mt-3 flex gap-2 items-end">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          rows={2}
          placeholder="Type a text to the customer"
          className="flex-1 bg-ink border border-line clip-slant px-3 py-2 text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none resize-y text-sm"
        />
        <button
          onClick={send}
          disabled={sending || !body.trim()}
          className="bg-brand text-on-brand display px-5 py-2.5 clip-slant hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
