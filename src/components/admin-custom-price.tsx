"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Owner-negotiated per-jersey price for one order (e.g. $23 for a repeat
 *  customer). Wins over standard $28 and Ocala $25 pricing. */
export function AdminCustomPrice({ teamOrderId, currentCents }: { teamOrderId: string; currentCents: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentCents ? (currentCents / 100).toFixed(2) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(jerseyCents: number | null) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/custom-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, jerseyCents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Set a negotiated per-jersey price for this order only"
        className={`text-xs display px-2 py-0.5 border disabled:opacity-50 whitespace-nowrap ${
          currentCents ? "border-brand/60 text-brand bg-brand/10" : "border-line text-muted hover:border-brand/40"
        }`}
      >
        {currentCents ? `CUSTOM $${(currentCents / 100).toFixed(0)}/jersey ✓` : "+ custom jersey $"}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="23.00"
        inputMode="decimal"
        className="w-20 bg-background border border-line text-xs text-foreground px-1.5 py-1"
      />
      <button
        type="button"
        onClick={() => {
          const d = parseFloat(value);
          if (isNaN(d)) { setError("Enter a price"); return; }
          save(Math.round(d * 100));
        }}
        disabled={busy}
        className="text-xs display bg-brand text-on-brand px-2 py-1 disabled:opacity-50"
      >
        {busy ? "..." : "Save"}
      </button>
      {currentCents && (
        <button type="button" onClick={() => save(null)} disabled={busy} className="text-xs display text-muted hover:text-red-400">
          Clear
        </button>
      )}
      <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-xs text-muted hover:text-foreground">✕</button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
