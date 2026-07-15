"use client";

import { useEffect, useState } from "react";

type StoreItem = {
  key: string;
  label: string;
  priceCents: number;
  sizes: string[];
  nameNumber?: boolean;
  numberAddOnCents?: number;
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

// Visual identity per item so cards read as products, not form rows.
const ITEM_ICONS: Record<string, string> = {
  round_neck_jersey: "👕",
  long_sleeve_shirt: "👕",
  two_button_jersey: "👕",
  full_button_jersey: "👕",
  reversible_basketball: "🏀",
  hoodie: "🧥",
  baseball_pants: "👖",
  microfiber_pants: "👖",
  knickers: "👖",
  shorts: "🩳",
  socks: "🧦",
  fitted_hat: "🧢",
  snapback_hat: "🧢",
};

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
  const [shipQuote, setShipQuote] = useState<{ amountCents: number; live: boolean; place?: string } | null>(null);
  const [quoting, setQuoting] = useState(false);

  const totalOz = selections.reduce((s, sel) => {
    const w = items.find((i) => i.key === sel.key)?.weightOz ?? 12;
    return s + w * sel.quantity;
  }, 0);

  // Re-quote automatically whenever the cart or the ZIP changes, so the
  // number shown always matches what checkout will actually charge.
  useEffect(() => {
    if (!/^\d{5}$/.test(zip) || selections.length === 0) {
      setShipQuote(null);
      return;
    }
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zip, weightOz: Math.max(1, totalOz) }),
        });
        const data = await res.json();
        if (res.ok) setShipQuote({ amountCents: data.amountCents, live: data.live, place: data.place });
      } catch {
      } finally {
        setQuoting(false);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip, totalOz]);
  // Per-item draft state, keyed by item key.
  const [drafts, setDrafts] = useState<Record<string, { size: string; playerName: string; playerNumber: string }>>({});

  const draft = (k: string, sizes: string[]) => drafts[k] ?? { size: sizes[0], playerName: "", playerNumber: "" };
  const setDraft = (k: string, patch: Partial<{ size: string; playerName: string; playerNumber: string }>) =>
    setDrafts((d) => ({ ...d, [k]: { ...draft(k, items.find((i) => i.key === k)?.sizes ?? []), ...patch } }));

  function add(item: StoreItem) {
    const d = draft(item.key, item.sizes);
    const number = (item.nameNumber || item.numberAddOnCents) && d.playerNumber.trim() ? d.playerNumber.trim() : undefined;
    setSelections((s) => [
      ...s,
      {
        key: item.key,
        label: item.label,
        // Number-on-hat upcharge shown at add time; the server re-prices from
        // the store snapshot at checkout regardless.
        priceCents: item.priceCents + (number && item.numberAddOnCents ? item.numberAddOnCents : 0),
        size: d.size,
        playerName: item.nameNumber ? d.playerName.trim() || undefined : undefined,
        playerNumber: number,
        quantity: 1,
      },
    ]);
    setError("");
    setJustAdded(item.key);
    setTimeout(() => setJustAdded((k) => (k === item.key ? "" : k)), 1500);
  }

  const [rush, setRush] = useState(false);
  const pieces = selections.reduce((sum, s) => sum + s.quantity, 0);
  const rushFeeCents = rush ? pieces * 500 : 0;
  const subtotal = selections.reduce((sum, s) => sum + s.priceCents * s.quantity, 0) + rushFeeCents;

  async function checkout() {
    if (selections.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/store/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selections, rush, shipZip: /^\d{5}$/.test(zip) ? zip : undefined }),
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
      <div className="grid sm:grid-cols-2 gap-4 content-start">
        {items.map((item) => {
          const d = draft(item.key, item.sizes);
          return (
            <div key={item.key} className="bg-steel border border-line p-4 flex flex-col hover:border-brand/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid place-items-center h-10 w-10 bg-ink border border-line text-xl shrink-0" aria-hidden>
                    {ITEM_ICONS[item.key] ?? "👕"}
                  </span>
                  <h3 className="display text-foreground leading-tight">{item.label}</h3>
                </div>
                <p className="display text-xl text-brand shrink-0">{money(item.priceCents)}</p>
              </div>

              <div className="mt-3 space-y-2 flex-1">
                <select
                  value={d.size}
                  onChange={(e) => setDraft(item.key, { size: e.target.value })}
                  className="w-full bg-ink border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
                  aria-label={`${item.label} size`}
                >
                  {item.sizes.map((s) => (
                    <option key={s} value={s}>
                      Size: {s}
                    </option>
                  ))}
                </select>
                {item.nameNumber && (
                  <div className="flex gap-2">
                    <input
                      value={d.playerName}
                      onChange={(e) => setDraft(item.key, { playerName: e.target.value })}
                      placeholder="Name (optional)"
                      maxLength={30}
                      className="flex-1 min-w-0 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                    />
                    <input
                      value={d.playerNumber}
                      onChange={(e) => setDraft(item.key, { playerNumber: e.target.value })}
                      placeholder="#"
                      maxLength={4}
                      className="w-14 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                    />
                  </div>
                )}
                {!item.nameNumber && item.numberAddOnCents ? (
                  <input
                    value={d.playerNumber}
                    onChange={(e) => setDraft(item.key, { playerNumber: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                    placeholder={`# on back (+${money(item.numberAddOnCents)})`}
                    maxLength={4}
                    className="w-full bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                  />
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => add(item)}
                className="mt-3 w-full clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark"
              >
                {justAdded === item.key ? "✓ Added to order" : "Add to order"}
              </button>
            </div>
          );
        })}
      </div>

      <aside className="lg:sticky lg:top-24 h-fit bg-steel border border-line p-5">
        <div className="flex items-center justify-between">
          <h2 className="display text-lg text-foreground">Your order</h2>
          {selections.length > 0 && (
            <span className="grid place-items-center h-6 min-w-6 px-1.5 rounded-full bg-brand text-on-brand display text-xs">
              {selections.length}
            </span>
          )}
        </div>
        {selections.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing added yet - hit "Add to order" on any item.</p>
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
        {selections.length > 0 && (
          <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={rush}
              onChange={(e) => setRush(e.target.checked)}
              className="mt-0.5 accent-[color:var(--brand-gold)]"
            />
            <span className="text-foreground">
              🚨 Rush my order <span className="text-muted">(+$5/item · ~1 week instead of 2-3)</span>
            </span>
          </label>
        )}
        {rush && pieces > 0 && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted">Rush fee ({pieces} × $5)</span>
            <span className="text-foreground">{money(rushFeeCents)}</span>
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-line flex justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="display text-foreground">{money(subtotal)}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
            placeholder="ZIP for shipping quote"
            inputMode="numeric"
            className="flex-1 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
          {selections.length > 0 && /^\d{5}$/.test(zip) && (
            <span className="text-sm text-foreground shrink-0">
              {quoting ? "..." : shipQuote ? `+ ${money(shipQuote.amountCents)} ship` : ""}
            </span>
          )}
        </div>
        {shipQuote?.place && !quoting && (
          <p className="mt-1 text-xs text-muted">Shipping to {shipQuote.place}</p>
        )}
        {shipQuote && !quoting && selections.length > 0 && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted">Total before tax</span>
            <span className="display text-foreground">{money(subtotal + shipQuote.amountCents)}</span>
          </div>
        )}
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
