"use client";

import { useState } from "react";
import { itemLabel, sizesFor } from "@/lib/order-items";

type Line = { key: string; size: string; name: string; number: string; quantity: number };

/** Post-submission add-ons: the coach picks a few extra pieces and pays for
 *  them on the spot. They join the roster automatically once paid. */
export function TeamOrderAddon({
  token,
  items,
  prices,
  shipped,
}: {
  token: string;
  items: string[];
  prices: Record<string, number>;
  shipped?: boolean;
}) {
  const first = items[0] ?? "jersey";
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<Line>({ key: first, size: sizesFor(first)[0], name: "", number: "", quantity: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const total = lines.reduce((s, l) => s + (prices[l.key] ?? 0) * l.quantity, 0);

  function add() {
    setLines((ls) => [...ls, draft]);
    setDraft({ key: draft.key, size: draft.size, name: "", number: "", quantity: 1 });
  }

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/team-order/${token}/addon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="bg-steel border border-line p-5">
      <h2 className="display text-lg text-foreground">Need more gear?</h2>
      <p className="text-sm text-muted mt-1">
        Add extra pieces to this order anytime - pay for just what you add, and they join
        your roster automatically. No new order needed.
      </p>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <select
          value={draft.key}
          onChange={(e) => {
            const key = e.target.value;
            setDraft((d) => ({ ...d, key, size: sizesFor(key)[0] }));
          }}
          className="bg-ink border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
          aria-label="Item"
        >
          {items.map((k) => (
            <option key={k} value={k}>
              {itemLabel(k)} ({money(prices[k] ?? 0)})
            </option>
          ))}
        </select>
        <select
          value={draft.size}
          onChange={(e) => setDraft((d) => ({ ...d, size: e.target.value }))}
          className="bg-ink border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
          aria-label="Size"
        >
          {sizesFor(draft.key).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Name (optional)"
          maxLength={30}
          className="flex-1 min-w-32 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        <input
          value={draft.number}
          onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
          placeholder="#"
          maxLength={4}
          className="w-14 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="clip-slant bg-brand text-on-brand display text-sm px-4 py-2 hover:bg-brand-dark"
        >
          Add
        </button>
      </div>

      {lines.length > 0 && (
        <div className="mt-3">
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">
                  {itemLabel(l.key)} · {l.size}
                  {l.name ? ` · ${l.name.toUpperCase()}` : ""}
                  {l.number ? ` · #${l.number}` : ""}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-foreground">{money(prices[l.key] ?? 0)}</span>
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className="text-muted hover:text-brand"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={pay}
            disabled={busy}
            className="mt-3 clip-slant bg-brand text-on-brand display px-6 py-2.5 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "Starting checkout..." : `Pay ${money(total)} for ${lines.length} item${lines.length === 1 ? "" : "s"}`}
          </button>
          <p className="mt-2 text-xs text-muted">
            {shipped
              ? "Plus tax. Your order already shipped, so at checkout you'll pick weight-based shipping or free local pickup in Ocala."
              : "Plus tax. Add-ons ship with your order - no extra shipping."}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </div>
  );
}
