"use client";

import { useEffect, useState } from "react";

export type DesignMessage = { at: string; from: "designer" | "client"; text: string; name?: string };

const NAME_KEY = "slugger-sender-name";
// Staff who reply to clients. Picking one is required so every reply is attributed.
const STAFF_NAMES = ["Gary", "Justin", "Bonans"];

/** Designer <-> client Q&A thread. Rendered on both the designer manage page
 *  (role="designer") and the client status page (role="client"); the shared
 *  token-authed endpoint infers the sender from which link posted. */
export function DesignMessages({
  token,
  role,
  initialMessages,
}: {
  token: string;
  role: "designer" | "client";
  initialMessages: DesignMessage[];
}) {
  const [messages, setMessages] = useState<DesignMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [senderName, setSenderName] = useState("");
  const [busy, setBusy] = useState<"" | "sending" | "refreshing">("");
  const [error, setError] = useState("");

  // Remember who's replying across visits so they pick once.
  useEffect(() => {
    if (role !== "designer") return;
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved && STAFF_NAMES.includes(saved)) setSenderName(saved);
    } catch {}
  }, [role]);

  const mine = role;
  const heading = role === "designer" ? "Message the client" : "Messages with your designer";
  const sub =
    role === "designer"
      ? "Ask the client a question - they get an email with a link back here to answer."
      : "Have a question, or need to clarify something about your design? Ask here.";

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setBusy("sending");
    setError("");
    try {
      const name = senderName.trim();
      if (role === "designer") {
        try {
          if (name) localStorage.setItem(NAME_KEY, name);
        } catch {}
      }
      const res = await fetch(`/api/design-request/${token}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...(role === "designer" && name ? { name } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send");
      setMessages(data.messages);
      setDraft("");
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
      const res = await fetch(`/api/design-request/${token}/message`);
      const data = await res.json();
      if (res.ok) setMessages(data.messages ?? []);
    } finally {
      setBusy("");
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="display text-xl text-foreground">{heading}</h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={refresh}
            disabled={busy !== ""}
            className="text-xs display text-foreground border border-line px-3 py-1 hover:border-brand/50 disabled:opacity-50"
          >
            {busy === "refreshing" ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>
      <p className="text-sm text-muted mt-1">{sub}</p>

      {messages.length > 0 && (
        <div className="mt-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-4 py-2.5 border text-sm ${
                  m.from === mine
                    ? "bg-brand/10 border-brand/40"
                    : "bg-steel border-line"
                }`}
              >
                <p className="text-xs text-muted mb-1">
                  {m.from === mine
                    ? "You"
                    : m.from === "designer"
                    ? m.name
                      ? `${m.name} · Slugger Athletics`
                      : "Slugger design team"
                    : "Client"}{" "}
                  · {new Date(m.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="text-foreground whitespace-pre-line">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {role === "designer" && (
        <select
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          className="mt-4 w-full sm:w-72 bg-steel border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
          disabled={busy === "sending"}
        >
          <option value="">Who&apos;s replying? (shown to the client)</option>
          {STAFF_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
      <div className="mt-3 flex gap-2 items-end">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={role === "designer" ? 'e.g. "Do you want the number outlined in red or gold?"' : "Type your question or answer..."}
          className="flex-1 bg-steel border border-line px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none min-h-16"
          disabled={busy === "sending"}
        />
        <button
          type="button"
          onClick={send}
          disabled={busy !== "" || !draft.trim() || (role === "designer" && !senderName)}
          title={role === "designer" && !senderName ? "Pick who's replying first" : undefined}
          className="clip-slant bg-brand text-on-brand display text-sm px-5 py-3 hover:bg-brand-dark disabled:opacity-50"
        >
          {busy === "sending" ? "Sending..." : "Send"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </section>
  );
}
