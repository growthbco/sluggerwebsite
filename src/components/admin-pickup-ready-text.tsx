"use client";

import { useState } from "react";
import { pickupReadyMessage } from "@/lib/pickup-ready-message";

type Props = {
  teamOrderId: string;
  teamName: string;
  reference: string;
  contactName: string;
  phoneLast4: string | null;
  disabledReason?: string;
};

export function AdminPickupReadyText({
  teamOrderId,
  teamName,
  reference,
  contactName,
  phoneLast4,
  disabledReason,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const message = pickupReadyMessage({ contactName, teamName, reference });

  async function send() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/pickup-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the pickup text.");
      setSent(true);
      setOpen(false);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (disabledReason) {
    return (
      <span className="text-[10px] display text-muted whitespace-nowrap" title={disabledReason}>
        TEXT UNAVAILABLE
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={sent}
        className="border border-sky-400/50 px-2.5 py-1.5 text-xs display text-sky-300 hover:bg-sky-400/10 disabled:border-green-400/40 disabled:text-green-400 whitespace-nowrap"
      >
        {sent ? "TEXT SENT ✓" : "TEXT: READY FOR PICKUP"}
      </button>
      {open && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-lg border border-line bg-ink" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-line px-5 py-4">
              <h2 className="display text-xl text-foreground">Text customer: ready for pickup</h2>
              <p className="mt-1 text-sm text-muted">{teamName} · {reference}{phoneLast4 ? ` · ending ${phoneLast4}` : ""}</p>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded border border-line bg-steel p-4 text-sm leading-relaxed text-foreground">
                {message}
              </div>
              <p className="text-xs text-muted">This sends from the Slugger Athletics business number and saves in Conversations.</p>
              {error && <p className="text-sm text-brand">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} disabled={busy} className="min-h-11 border border-line px-4 text-sm text-muted hover:text-foreground disabled:opacity-50">Cancel</button>
                <button type="button" onClick={send} disabled={busy} className="min-h-11 bg-brand px-5 display text-sm text-on-brand hover:bg-brand-dark disabled:opacity-50">
                  {busy ? "Sending…" : "Send pickup text"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
