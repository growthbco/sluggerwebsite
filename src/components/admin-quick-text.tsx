"use client";

import { useState } from "react";

type Props = {
  teamOrderId: string;
  teamName: string;
  reference: string;
  contactName: string;
  phoneLast4: string | null;
  disabledReason?: string;
};

function starterMessage(contactName: string, teamName: string, reference: string) {
  const firstName = contactName.trim().split(/\s+/)[0] || "there";
  return `Hi ${firstName}, this is Slugger Athletics regarding ${teamName} (${reference}). `;
}

export function AdminQuickText({
  teamOrderId,
  teamName,
  reference,
  contactName,
  phoneLast4,
  disabledReason,
}: Props) {
  const initialMessage = starterMessage(contactName, teamName, reference);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function showComposer() {
    if (disabledReason) return;
    setMessage(initialMessage);
    setError("");
    setOpen(true);
  }

  async function send() {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/team-order/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, message: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send the text.");
      setSent(true);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the text.");
    } finally {
      setBusy(false);
    }
  }

  if (disabledReason) {
    return (
      <button type="button" disabled title={disabledReason} className="cursor-not-allowed opacity-45">
        Quick text unavailable
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={showComposer} title={`Text ${contactName}`}>
        {sent ? "Quick text sent ✓" : "Quick text customer"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/65 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`quick-text-title-${teamOrderId}`}
            className="w-full max-w-lg border border-line bg-ink shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-line px-5 py-4">
              <h2 id={`quick-text-title-${teamOrderId}`} className="display text-xl text-foreground">
                Quick text customer
              </h2>
              <p className="mt-1 text-sm text-muted">
                {contactName} · {teamName} · {reference}{phoneLast4 ? ` · ending ${phoneLast4}` : ""}
              </p>
            </div>

            <form
              className="space-y-4 p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="block">
                <span className="display text-xs text-muted">MESSAGE</span>
                <textarea
                  autoFocus
                  value={message}
                  onChange={(event) => setMessage(event.target.value.slice(0, 1500))}
                  rows={6}
                  maxLength={1500}
                  className="mt-2 w-full resize-y border border-line bg-steel px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                  placeholder="Type your message"
                />
              </label>
              <div className="flex items-start justify-between gap-4 text-xs text-muted">
                <p>Sends from the Slugger business number and saves in Texts.</p>
                <span className="shrink-0">{message.length}/1500</span>
              </div>
              {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="min-h-11 border border-line px-4 text-sm text-muted hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !message.trim()}
                  className="min-h-11 bg-brand px-5 display text-sm text-on-brand hover:bg-brand-dark disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send text"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
