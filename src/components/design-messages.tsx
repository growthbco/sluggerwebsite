"use client";

import { useState } from "react";

export type DesignMessage = { at: string; from: "designer" | "client"; text: string };

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
  const [busy, setBusy] = useState<"" | "sending" | "refreshing">("");
  const [error, setError] = useState("");

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
      const res = await fetch(`/api/design-request/${token}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
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
                  {m.from === "designer" ? "Slugger design team" : "Client"} ·{" "}
                  {new Date(m.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="text-foreground whitespace-pre-line">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2 items-end">
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
          disabled={busy !== "" || !draft.trim()}
          className="clip-slant bg-brand text-on-brand display text-sm px-5 py-3 hover:bg-brand-dark disabled:opacity-50"
        >
          {busy === "sending" ? "Sending..." : "Send"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </section>
  );
}
