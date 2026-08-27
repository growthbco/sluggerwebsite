"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = { key: string; label: string; size: string; name?: string; number?: string; design?: string; quantity: number; unitPriceCents: number };
type Pending = { id: string; rows: Row[]; totalCents: number; payUrl: string | null };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Unpaid add-on invoices sitting on an order - previously invisible in the
 *  admin. Lists each with its items + pay link, lets staff remove a stale one,
 *  and combines several into a single payment link so the customer pays once. */
export function AdminPendingAddons({ teamOrderId, pending }: { teamOrderId: string; pending: Pending[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [combined, setCombined] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function call(action: "combine" | "remove", addonId?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, action, addonId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (action === "combine" && data.url) setCombined(data.url);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (pending.length === 0) return null;

  return (
    <div className="border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="display text-amber-300">Unpaid add-on invoices ({pending.length})</p>
        {pending.length > 1 && (
          <button
            type="button"
            onClick={() => call("combine")}
            disabled={busy}
            className="text-xs display bg-brand text-on-brand px-3 py-1.5 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "…" : "Combine into one link"}
          </button>
        )}
      </div>

      {combined && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-green-400 display">Combined:</span>
          <input readOnly value={combined} className="flex-1 bg-ink border border-line px-2 py-1 text-xs text-foreground" />
          <button type="button" onClick={() => navigator.clipboard.writeText(combined)} className="text-xs display border border-brand/50 text-brand px-2 py-1 hover:bg-brand/10">Copy</button>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {pending.map((p) => (
          <li key={p.id} className="border border-line bg-background/40 p-2.5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="display text-foreground">{money(p.totalCents)}</span>
                <span className="ml-2 text-xs text-muted">{p.rows.reduce((s, r) => s + r.quantity, 0)} piece{p.rows.reduce((s, r) => s + r.quantity, 0) === 1 ? "" : "s"}</span>
                <ul className="mt-1 text-xs text-muted">
                  {p.rows.map((r, i) => (
                    <li key={i}>
                      {r.quantity}× {r.label} — {[r.size, r.name?.toUpperCase(), r.number ? `#${r.number}` : null, r.design].filter(Boolean).join(" · ")}
                    </li>
                  ))}
                </ul>
              </div>
              <span className="flex flex-col items-end gap-1 shrink-0">
                {p.payUrl && (
                  <a href={p.payUrl} target="_blank" rel="noopener noreferrer" className="text-xs display text-brand border border-brand/50 px-2 py-0.5 hover:bg-brand/10">Pay link</a>
                )}
                <button type="button" onClick={() => { if (confirm("Remove this pending invoice?")) call("remove", p.id); }} disabled={busy} className="text-xs display text-red-400/80 border border-red-500/40 px-2 py-0.5 hover:bg-red-500/10 disabled:opacity-50">Remove</button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
