"use client";

import { useState } from "react";

type StoreItem = {
  key: string;
  label: string;
  priceCents: number;
  sizes: string[];
  nameNumber?: boolean;
  weightOz: number;
};

type Selection = {
  key: string;
  label: string;
  priceCents: number;
  size: string;
  playerName?: string;
  playerNumber?: string;
  quantity: number;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Buyer-facing team store: pick items, personalize, pay via Stripe.
 *  Prices shown here are display-only - the checkout endpoint re-prices
 *  everything from the store's server-side snapshot. */
export function TeamStoreShop({ token, items }: { token: string; items: StoreItem[] }) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Flash "✓ Added" on the tapped button - on phones the order summary is
  // below the fold, so the button itself must confirm the add.
  const [justAdded, setJustAdded] = useState("");
  // Optional ZIP -> live carrier rate shown before checkout.
  const [zip, setZip] = useState("");
  const [shipQuote, setShipQuote] = useState<{ amountCents: number; live: boolean } | null>(null);

  const totalOz = selectionsWeightOz();
  function selectionsWeightOz() {
    const w: Record<string, number> = {};
    for (const i of items) w[i.key] = i.weightOz;
    return selections.reduce((s, sel) => s + (w[sel.key] ?? 12) * sel.quantity, 0);
  }

  async function quoteShipping(z: string) {
    if (!/^\d{5}$/.test(z) || selections.length === 0) {
      setShipQuote(null);
      return;
    }
    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip: z, weightOz: Math.max(1, totalOz) }),
      });
      const data = await res.json();
      if (res.ok) setShipQuote({ amountCents: data.amountCents, live: data.live });
    } catch {}
  }
  // Per-item draft state, keyed by item key.
  const [drafts, setDrafts] = useState<Record<string, { size: string; playerName: string; playerNumber: string }>>({});

  const draft = (k: string, sizes: string[]) => drafts[k] ?? { size: sizes[0], playerName: "", playerNumber: "" };
  const setDraft = (k: string, patch: Partial<{ size: string; playerName: string; playerNumber: string }>) =>
    setDrafts((d) => ({ ...d, [k]: { ...draft(k, items.find((i) => i.key === k)?.sizes ?? []), ...patch } }));

  function add(item: StoreItem) {
    const d = draft(item.key, item.sizes);
    setSelections((s) => [
      ...s,
      {
        key: item.key,
        label: item.label,
        priceCents: item.priceCents,
        size: d.size,
        playerName: item.nameNumber ? d.playerName.trim() || undefined : undefined,
        playerNumber: item.nameNumber ? d.playerNumber.trim() || undefined : undefined,
        quantity: 1,
      },
    ]);
    setError("");
    setJustAdded(item.key);
    setTimeout(() => setJustAdded((k) => (k === item.key ? "" : k)), 1500);
  }

  const subtotal = selections.reduce((sum, s) => sum + s.priceCents * s.quantity, 0);

  async function checkout() {
    if (selections.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/store/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selections, shipZip: /^\d{5}$/.test(zip) ? zip : undefined }),
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
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {items.map((item) => {
          const d = draft(item.key, item.sizes);
          return (
            <div key={item.key} className="bg-steel border border-line p-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="display text-lg text-foreground">{item.label}</h2>
                <p className="display text-xl text-foreground">{money(item.priceCents)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={d.size}
                  onChange={(e) => setDraft(item.key, { size: e.target.value })}
                  className="bg-ink border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
                  aria-label={`${item.label} size`}
                >
                  {item.sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {item.nameNumber && (
                  <>
                    <input
                      value={d.playerName}
                      onChange={(e) => setDraft(item.key, { playerName: e.target.value })}
                      placeholder="Name on jersey (optional)"
                      maxLength={30}
                      className="flex-1 min-w-40 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                    />
                    <input
                      value={d.playerNumber}
                      onChange={(e) => setDraft(item.key, { playerNumber: e.target.value })}
                      placeholder="#"
                      maxLength={4}
                      className="w-16 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => add(item)}
                  className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2 hover:bg-brand-dark"
                >
                  {justAdded === item.key ? "✓ Added" : "Add"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <aside className="lg:sticky lg:top-24 h-fit bg-steel border border-line p-5">
        <h2 className="display text-lg text-foreground">Your order</h2>
        {selections.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing added yet. Pick your gear on the left.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {selections.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="text-foreground">{s.label}</p>
                  <p className="text-xs text-muted">
                    {[s.size, s.playerName?.toUpperCase(), s.playerNumber ? `#${s.playerNumber}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-foreground">{money(s.priceCents)}</span>
                  <button
                    type="button"
                    onClick={() => setSelections((sel) => sel.filter((_, j) => j !== i))}
                    className="text-muted hover:text-brand"
                    aria-label={`Remove ${s.label}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 pt-3 border-t border-line flex justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="display text-foreground">{money(subtotal)}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={zip}
            onChange={(e) => {
              const z = e.target.value.replace(/[^0-9]/g, "").slice(0, 5);
              setZip(z);
              quoteShipping(z);
            }}
            placeholder="ZIP for shipping quote"
            inputMode="numeric"
            className="flex-1 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
          {shipQuote && selections.length > 0 && (
            <span className="text-sm text-foreground shrink-0">+ {money(shipQuote.amountCents)} ship</span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">
          {shipQuote?.live
            ? "Live carrier rate to your ZIP - or choose free local pickup in Ocala at checkout. Plus tax."
            : "Shipping is calculated by weight at checkout, or choose free local pickup in Ocala. Plus tax."}
        </p>
        <button
          type="button"
          onClick={checkout}
          disabled={busy || selections.length === 0}
          className="mt-4 w-full clip-slant bg-brand text-on-brand display text-lg px-6 py-3 hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Starting checkout..." : "Checkout"}
        </button>
        {error && <p className="mt-2 text-sm text-brand">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          Made to order in your team&apos;s design · 2-3 week turnaround after the batch closes
        </p>
      </aside>
    </div>
  );
}
