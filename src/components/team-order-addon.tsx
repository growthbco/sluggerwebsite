"use client";

import { useState } from "react";
import { itemLabel, sizesFor, itemTakesName } from "@/lib/order-items";

type Line = { key: string; size: string; name: string; number: string; design: string; quantity: number };

/** Post-submission add-ons: the coach picks a few extra pieces and pays for
 *  them on the spot. They join the roster automatically once paid. */
export function TeamOrderAddon({
  token,
  items,
  prices,
  designs = [],
  shipped,
  embedded = false,
}: {
  token: string;
  items: string[];
  prices: Record<string, number>;
  designs?: { label: string; image: string; sku?: string | null }[];
  shipped?: boolean;
  /** Rendered inside the "Add to this order" block on the roster tab: drop the
   *  own card chrome + header, the block above already sets the context. */
  embedded?: boolean;
}) {
  const first = items[0] ?? "jersey";
  const firstDesign = designs.length === 1 ? designs[0].label : "";
  const [lines, setLines] = useState<Line[]>([]);
  // Size starts empty ("Pick a size") so nobody ships a silent Youth Small.
  const [draft, setDraft] = useState<Line>({ key: first, size: "", name: "", number: "", design: firstDesign, quantity: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const needsDesign = designs.length > 1;
  // Hats/caps are sized, not personalized - hide the name/# fields for them.
  const needsName = itemTakesName(draft.key);
  // Preview the currently-selected design (or the only one) so they see it.
  const previewDesign = designs.find((d) => d.label === draft.design) ?? (designs.length === 1 ? designs[0] : undefined);

  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const total = lines.reduce((s, l) => s + (prices[l.key] ?? 0) * l.quantity, 0);

  function add() {
    if (!draft.size) { setError("Pick a size for this piece."); return; }
    if (needsDesign && !draft.design) { setError("Pick a design for this piece."); return; }
    setError("");
    setLines((ls) => [...ls, draft]);
    // Keep the chosen size + design for the next piece (convenient for a run of
    // the same size); clear name + number.
    setDraft({ key: draft.key, size: draft.size, name: "", number: "", design: draft.design, quantity: 1 });
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
    <div className={embedded ? "" : "bg-steel border border-line p-5"}>
      {!embedded && (
        <>
          <h2 className="display text-lg text-foreground">Need more gear?</h2>
          <p className="text-sm text-muted mt-1">
            Add extra pieces to this order anytime - pay for just what you add, and they join
            your roster automatically. No new order needed.
          </p>
        </>
      )}

      <div className={`${embedded ? "" : "mt-3 "}flex flex-wrap gap-2 items-center`}>
        <select
          value={draft.key}
          onChange={(e) => {
            const key = e.target.value;
            // New item type -> its sizes differ, so re-pick. Hats carry no
            // name/#, so drop any personalization when switching to one.
            const keep = itemTakesName(key);
            setDraft((d) => ({ ...d, key, size: "", name: keep ? d.name : "", number: keep ? d.number : "" }));
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
        {needsDesign && (
          <select
            value={draft.design}
            onChange={(e) => setDraft((d) => ({ ...d, design: e.target.value }))}
            className="bg-ink border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
            aria-label="Design"
          >
            <option value="">Design…</option>
            {designs.map((dz) => <option key={dz.label} value={dz.label}>{dz.label}{dz.sku ? ` (${dz.sku})` : ""}</option>)}
          </select>
        )}
        <select
          value={draft.size}
          onChange={(e) => setDraft((d) => ({ ...d, size: e.target.value }))}
          className="bg-ink border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
          aria-label="Size"
        >
          <option value="">Pick a size</option>
          {sizesFor(draft.key).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {/* Keep name + # together so the number never drops to its own line.
            Hidden for hats/caps - they're sized, not personalized. */}
        {needsName && (
          <div className="flex gap-2 items-center flex-1 min-w-48">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Player name"
              maxLength={30}
              className="flex-1 min-w-0 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
            />
            <input
              value={draft.number}
              onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
              placeholder="#"
              maxLength={4}
              className="w-14 shrink-0 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-3 w-full sm:w-auto clip-slant bg-brand text-on-brand display px-8 py-3 hover:bg-brand-dark"
      >
        Add to list
      </button>

      {previewDesign?.image && (
        <button
          type="button"
          onClick={() => setZoom(previewDesign.image)}
          className="mt-3 flex items-center gap-3 group text-left"
          title="Click to enlarge"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewDesign.image} alt={previewDesign.label} className="h-16 w-16 object-contain bg-white border border-line rounded group-hover:ring-2 group-hover:ring-brand transition" />
          <span className="text-sm text-muted">
            {previewDesign.label}{previewDesign.sku ? <span className="font-mono text-xs opacity-70"> · {previewDesign.sku}</span> : null}
            <span className="block text-xs text-brand">🔍 tap to preview</span>
          </span>
        </button>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[90] bg-black/85 grid place-items-center p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Design" className="max-h-[92vh] max-w-[95vw] object-contain" />
        </div>
      )}

      {lines.length > 0 && (
        <div className="mt-3">
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">
                  {itemLabel(l.key)}{l.design ? ` · ${l.design}` : ""} · {l.size}
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
