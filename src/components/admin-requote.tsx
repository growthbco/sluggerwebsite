"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Warning shown when the roster prices differently than the LOCKED quote
 *  (pieces were added/removed after invoicing). One click re-locks the total
 *  so the next invoice charges the right amount. */
export function AdminRequote({ teamOrderId, lockedCents, rosterCents }: { teamOrderId: string; lockedCents: number; rosterCents: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function requote() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/team-order/requote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-amber-400/50 bg-amber-400/5 px-4 py-3">
      <p className="text-sm text-amber-300">
        The roster now prices at <strong>{money(rosterCents)}</strong> but the locked quote is{" "}
        <strong>{money(lockedCents)}</strong> - pieces changed after invoicing. Update before sending
        the next invoice so it charges the right amount.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={requote}
          disabled={busy}
          className="text-sm display text-on-brand bg-brand hover:bg-brand-dark px-4 py-1.5 rounded disabled:opacity-50"
        >
          {busy ? "Updating…" : `Update quote to ${money(rosterCents)}`}
        </button>
        {err && <span className="text-sm text-red-400">{err}</span>}
      </div>
    </div>
  );
}
