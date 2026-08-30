"use client";

import { useEffect, useState } from "react";
import { RosterImport, type ImportedRow } from "@/components/roster-import";
import { rushFeeCentsForPieces } from "@/lib/rush-pricing";

type StoreItem = {
  key: string;
  label: string;
  priceCents: number;
  sizes: string[];
  nameNumber?: boolean;
  numberAddOnCents?: number;
  weightOz: number;
  /** Optional product photo for the card. */
  image?: string;
  /** Approved colorways the buyer chooses between (teams with multiple designs). */
  designs?: { label: string; image: string; sku?: string | null }[];
};

type Selection = {
  key: string;
  label: string;
  priceCents: number;
  size: string;
  design?: string;
  playerName?: string;
  playerNumber?: string;
  quantity: number;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

// Visual identity per item so cards read as products, not form rows.
const ITEM_ICONS: Record<string, string> = {
  round_neck_jersey: "👕",
  v_neck_jersey: "👕",
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
export function TeamStoreShop({ token, items, addToRef }: { token: string; items: StoreItem[]; addToRef?: string }) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Flash "✓ Added" on the tapped button - on phones the order summary is
  // below the fold, so the button itself must confirm the add.
  const [justAdded, setJustAdded] = useState("");
  // Product-card grid: tapping a card opens the customize modal for that item.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Full-screen zoom of a design image (so buyers can inspect each colorway).
  const [zoom, setZoom] = useState<string | null>(null);
  // Delivery: a shipping ZIP (live/weight rate) OR explicit local pickup. One
  // is required so nobody checks out with no shipping.
  const [zip, setZip] = useState("");
  const [pickup, setPickup] = useState(false);
  const [shipQuote, setShipQuote] = useState<{ amountCents: number; live: boolean; place?: string } | null>(null);
  const [quoting, setQuoting] = useState(false);

  // Hats ship in their own box, so the quote is per-parcel (apparel + hats).
  const { apparelOz, hatOz } = selections.reduce(
    (acc, sel) => {
      const item = items.find((i) => i.key === sel.key);
      const w = (item?.weightOz ?? 12) * sel.quantity;
      if (sel.key === "fitted_hat" || sel.key === "snapback_hat") acc.hatOz += w;
      else acc.apparelOz += w;
      return acc;
    },
    { apparelOz: 0, hatOz: 0 },
  );
  const totalOz = apparelOz + hatOz;

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
          body: JSON.stringify({ zip, parcelsOz: [apparelOz, hatOz].filter((w) => w > 0) }),
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
  const [drafts, setDrafts] = useState<Record<string, { size: string; playerName: string; playerNumber: string; designs?: string[] }>>({});

  // Size starts EMPTY - the buyer must pick one (no silent Youth Small default
  // that ships the wrong size).
  const draft = (k: string, _sizes: string[]) => drafts[k] ?? { size: "", playerName: "", playerNumber: "" };
  const setDraft = (k: string, patch: Partial<{ size: string; playerName: string; playerNumber: string; designs: string[] }>) =>
    setDrafts((d) => ({ ...d, [k]: { ...draft(k, items.find((i) => i.key === k)?.sizes ?? []), ...patch } }));

  function add(item: StoreItem) {
    const d = draft(item.key, item.sizes);
    if (!d.size) {
      setError("Pick a size first.");
      return;
    }
    const number = (item.nameNumber || item.numberAddOnCents) && d.playerNumber.trim() ? d.playerNumber.trim() : undefined;
    // Single-select: ONE set per add, for the one chosen colorway (or the first
    // if none picked). A second colorway means pick another and add again.
    const chosen = item.designs?.length
      ? [(d.designs && d.designs[0]) || item.designs[0].label]
      : [undefined];
    const newSels = chosen.map((designLabel) => ({
      key: item.key,
      label: item.label,
      // Number-on-hat upcharge shown at add time; the server re-prices from
      // the store snapshot at checkout regardless.
      priceCents: item.priceCents + (number && item.numberAddOnCents ? item.numberAddOnCents : 0),
      size: d.size,
      design: designLabel,
      // On print items the name goes ON the gear; on everything else it's a
      // tracking-only "whose is this" label.
      playerName: d.playerName.trim() || undefined,
      playerNumber: number,
      quantity: 1,
    }));
    setSelections((s) => [...s, ...newSels]);
    setError("");
    setJustAdded(item.key);
    setTimeout(() => setJustAdded((k) => (k === item.key ? "" : k)), 1500);
    // Keep the modal open and clear just the name/number, so the buyer can keep
    // adding player after player (size + design stay as sensible defaults).
    setDraft(item.key, { playerName: "", playerNumber: "" });
  }

  const [rush, setRush] = useState(false);
  const [note, setNote] = useState("");
  const pieces = selections.reduce((sum, s) => sum + s.quantity, 0);
  const rushFeeCents = rush ? rushFeeCentsForPieces(pieces) : 0;
  const subtotal = selections.reduce((sum, s) => sum + s.priceCents * s.quantity, 0) + rushFeeCents;

  async function checkout() {
    if (selections.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = addToRef
        ? await fetch(`/api/store/${token}/add-checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: selections, addToRef, note: note.trim() || undefined }),
          })
        : await fetch(`/api/store/${token}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: selections, rush, pickup, shipZip: /^\d{5}$/.test(zip) ? zip : undefined, note: note.trim() || undefined }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  // Whole-team import: parsed rows become one selection per item/size, with
  // the person's name kept for tracking.
  function importRows(rows: ImportedRow[]) {
    const next: Selection[] = [];
    for (const r of rows) {
      for (const [key, size] of Object.entries(r.sizes)) {
        const def = items.find((i) => i.key === key);
        if (!def || !size) continue;
        const number = r.number && (def.nameNumber || def.numberAddOnCents) ? r.number : undefined;
        next.push({
          key,
          label: def.label,
          priceCents: def.priceCents + (number && def.numberAddOnCents ? def.numberAddOnCents : 0),
          size: def.sizes.includes(size) ? size : def.sizes[0],
          design: def.designs?.[0]?.label,
          playerName: r.name || undefined,
          playerNumber: number,
          quantity: 1,
        });
      }
    }
    setSelections((s) => [...s, ...next]);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {addToRef && (
          <div className="bg-brand/10 border border-brand/40 px-4 py-3 text-sm text-foreground">
            <strong>Adding to your order {addToRef}.</strong> Pick the extra pieces below - they&apos;ll ship in the same box as your existing order, so you only pay for the new items (plus any shipping increase, if the added weight bumps it).
          </div>
        )}
        <details className="group">
          <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-sm text-brand hover:underline">
            Ordering for the whole team? Paste a list
            <span className="transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="mt-3 border border-line bg-steel p-4">
            <RosterImport
              itemKeys={items.map((i) => i.key)}
              itemDefs={items.map((i) => ({ key: i.key, label: i.label, sizes: i.sizes }))}
              confirmLabel={undefined}
              onConfirm={importRows}
            />
          </div>
        </details>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 content-start">
        {items.map((item) => {
          const d = draft(item.key, item.sizes);
          const cardImg = item.designs?.find((dz) => dz.label === d.designs?.[0])?.image ?? item.designs?.[0]?.image ?? item.image;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveKey(item.key)}
              className="group bg-steel border border-line hover:border-brand/60 transition-colors text-left flex flex-col"
            >
              <div className="relative aspect-square bg-white overflow-hidden grid place-items-center">
                {cardImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cardImg} alt={item.label} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <span className="text-6xl" aria-hidden>{ITEM_ICONS[item.key] ?? "👕"}</span>
                )}
                {(item.designs?.length ?? 0) > 1 && (
                  <span className="absolute top-2 left-2 bg-brand text-on-brand display text-[10px] px-2 py-0.5">{item.designs!.length} DESIGNS</span>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <h3 className="display text-sm sm:text-base text-foreground leading-tight">{item.label}</h3>
                <p className="display text-lg text-brand mt-1">{money(item.priceCents)}</p>
                {/* Big team-colored Customize (the whole card is the button). */}
                <span className="mt-3 block w-full text-center bg-brand text-on-brand display text-sm py-2 group-hover:bg-brand-dark transition-colors">
                  {justAdded === item.key ? "✓ Added" : "Customize"}
                </span>
              </div>
            </button>
          );
        })}
        </div>
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
                    {[s.design, s.size, s.playerName?.toUpperCase(), s.playerNumber ? `#${s.playerNumber}` : null]
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
              🚨 Request 2-week rush production <span className="text-muted">(flat $100 fee · timeline confirmed by Slugger)</span>
            </span>
          </label>
        )}
        {rush && pieces > 0 && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted">Rush fee (flat)</span>
            <span className="text-foreground">{money(rushFeeCents)}</span>
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-line flex justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="display text-foreground">{money(subtotal)}</span>
        </div>
        {/* Delivery is required (except when adding to an existing order, which
            ships to that order's address): enter a ZIP to ship, or pick up. */}
        {!addToRef && (
          <div className="mt-3">
            <p className="text-xs display text-muted mb-1">Delivery <span className="text-brand">*</span></p>
            <div className="flex items-center gap-2">
              <input
                value={zip}
                onChange={(e) => { setZip(e.target.value.replace(/[^0-9]/g, "").slice(0, 5)); if (e.target.value) setPickup(false); }}
                placeholder="ZIP to ship to"
                inputMode="numeric"
                disabled={pickup}
                className="flex-1 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none disabled:opacity-50"
              />
              {selections.length > 0 && !pickup && /^\d{5}$/.test(zip) && (
                <span className="text-sm text-foreground shrink-0">
                  {quoting ? "..." : shipQuote ? `+ ${money(shipQuote.amountCents)} ship` : ""}
                </span>
              )}
            </div>
            {shipQuote?.place && !quoting && !pickup && (
              <p className="mt-1 text-xs text-muted">Shipping to {shipQuote.place}</p>
            )}
            <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={pickup}
                onChange={(e) => { setPickup(e.target.checked); if (e.target.checked) setZip(""); }}
                className="accent-[color:var(--brand-gold)]"
              />
              <span className="text-foreground">Free local pickup in Ocala, FL <span className="text-muted">(no shipping)</span></span>
            </label>
          </div>
        )}
        {shipQuote && !quoting && !pickup && selections.length > 0 && !addToRef && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted">Total before tax</span>
            <span className="display text-foreground">{money(subtotal + shipQuote.amountCents)}</span>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          {addToRef
            ? "Ships with your existing order to the same address. You'll pay for the new items plus any shipping increase from the added weight. Plus tax."
            : pickup
              ? "You'll pick up free at our Ocala shop - no shipping charged. Plus tax."
              : shipQuote?.live
                ? "Live carrier rate to your ZIP. Plus tax."
                : "Shipping is calculated by weight at checkout. Plus tax."}
        </p>
        {selections.length > 0 && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="Add a note (optional) - anything we should know about your order"
            rows={2}
            className="mt-3 w-full bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none resize-y"
          />
        )}
        <button
          type="button"
          onClick={checkout}
          disabled={busy || selections.length === 0 || (!addToRef && !pickup && !/^\d{5}$/.test(zip))}
          className="mt-4 w-full clip-slant bg-brand text-on-brand display text-lg px-6 py-3 hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Starting checkout..." : addToRef ? "Add to my order & pay" : "Checkout"}
        </button>
        {!addToRef && selections.length > 0 && !pickup && !/^\d{5}$/.test(zip) && (
          <p className="mt-2 text-xs text-brand">Enter your shipping ZIP or choose local pickup to continue.</p>
        )}
        {error && <p className="mt-2 text-sm text-brand">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          Made to order in your team&apos;s design · 3-week standard production after the batch closes · shipping additional
        </p>
      </aside>

      {/* Customize modal: options only appear for the product being added. */}
      {(() => {
        const item = items.find((i) => i.key === activeKey);
        if (!item) return null;
        const d = draft(item.key, item.sizes);
        const selectedDesigns = d.designs ?? (item.designs?.[0] ? [item.designs[0].label] : []);
        const previewImg = item.designs?.find((dz) => dz.label === selectedDesigns[0])?.image ?? item.designs?.[0]?.image ?? item.image;
        return (
          // Full-screen focused CUSTOMIZE panel - not a small modal over the
          // busy shop. Fills the viewport; the store is hidden behind it.
          <div className="fixed inset-0 z-[70] bg-ink overflow-y-auto">
            <div className="mx-auto max-w-3xl min-h-full px-4 sm:px-6 py-5">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-line">
                <button type="button" onClick={() => setActiveKey(null)} className="text-sm display text-foreground hover:text-brand inline-flex items-center gap-1.5">← Back to store</button>
                <div className="flex items-baseline gap-3">
                  <h3 className="display text-lg text-foreground">{item.label}</h3>
                  <p className="display text-xl text-brand">{money(item.priceCents)}</p>
                </div>
              </div>
              {previewImg && (
                <button type="button" onClick={() => setZoom(previewImg)} className="relative block w-full bg-white group mt-4 rounded overflow-hidden" title="Tap to enlarge">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewImg} alt={item.label} className="w-full max-h-[52vh] object-contain" />
                  <span className="absolute bottom-2 right-2 text-[11px] bg-ink/80 text-foreground px-1.5 py-0.5 rounded">🔍 tap to enlarge</span>
                </button>
              )}
              <div className="py-4 space-y-3">
                {(item.designs?.length ?? 0) > 1 && (
                  <div>
                    {/* One design per set: a plain dropdown, not multi-tap. The
                        preview above updates to the chosen colorway. Want a
                        second colorway? Add this one, then pick another and add
                        again. */}
                    <label className="display text-xs text-muted tracking-wide mb-1.5 block uppercase">Design</label>
                    <select
                      value={selectedDesigns[0] ?? ""}
                      onChange={(e) => setDraft(item.key, { designs: e.target.value ? [e.target.value] : [] })}
                      className="w-full bg-steel border border-line px-3 py-2.5 text-base sm:text-sm text-foreground focus:border-brand focus:outline-none"
                      aria-label={`${item.label} design`}
                    >
                      {item.designs!.map((dz) => (
                        <option key={dz.label} value={dz.label}>{dz.label}{dz.sku ? ` (${dz.sku})` : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
                <select
                  value={d.size}
                  onChange={(e) => setDraft(item.key, { size: e.target.value })}
                  className={`w-full bg-steel border px-3 py-2.5 text-base sm:text-sm focus:border-brand focus:outline-none ${d.size ? "border-line text-foreground" : "border-brand/50 text-muted"}`}
                  aria-label={`${item.label} size`}
                >
                  <option value="" disabled>Pick a size</option>
                  {item.sizes.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
                {item.nameNumber ? (
                  <div className="flex gap-2">
                    <input
                      value={d.playerName}
                      onChange={(e) => setDraft(item.key, { playerName: e.target.value })}
                      placeholder="Name on back (optional)"
                      maxLength={30}
                      className="flex-1 min-w-0 bg-steel border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                    />
                    <input
                      value={d.playerNumber}
                      onChange={(e) => setDraft(item.key, { playerNumber: e.target.value })}
                      placeholder="#"
                      maxLength={4}
                      className="w-16 bg-steel border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        value={d.playerName}
                        onChange={(e) => setDraft(item.key, { playerName: e.target.value })}
                        placeholder="Optional: who's this for?"
                        maxLength={30}
                        className="flex-1 min-w-0 bg-steel border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                      />
                      {item.numberAddOnCents ? (
                        <input
                          value={d.playerNumber}
                          onChange={(e) => setDraft(item.key, { playerNumber: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                          placeholder="#"
                          maxLength={4}
                          className="w-16 bg-steel border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                        />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted">
                      Name is just so you know whose it is - it won&apos;t be printed.
                      {item.numberAddOnCents
                        ? ` Number embroidered on the back adds ${money(item.numberAddOnCents)} - leave blank for none.`
                        : ""}
                    </p>
                  </>
                )}
                {(() => {
                  const mine = selections.filter((s) => s.key === item.key);
                  const addedOfThis = mine.length;
                  const addedTotal = mine.reduce((sum, s) => sum + s.priceCents, 0);
                  return (
                    <>
                      {/* Always ONE set at the item price - single-select design. */}
                      <button
                        type="button"
                        onClick={() => add(item)}
                        disabled={!d.size}
                        title={!d.size ? "Pick a size first" : undefined}
                        className="w-full clip-slant bg-brand text-on-brand display text-lg px-5 py-3 hover:bg-brand-dark disabled:opacity-50"
                      >
                        {justAdded === item.key ? "Added ✓" : `Add to order - ${money(item.priceCents)}`}
                      </button>
                      {/* Running tally + how to add a second colorway. */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground">
                          {addedOfThis > 0 ? (
                            <>Added <strong>{addedOfThis}</strong> {addedOfThis === 1 ? "set" : "sets"} · <strong className="text-brand">{money(addedTotal)}</strong>{(item.designs?.length ?? 0) > 1 ? <span className="text-muted"> · want another color? pick it above and add again</span> : null}</>
                          ) : (
                            <span className="text-muted">Pick a design and size, then add to order.</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveKey(null)}
                          className="text-sm display border border-line text-foreground px-4 py-1.5 hover:border-brand/50 whitespace-nowrap"
                        >
                          Done
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full-screen design zoom. */}
      {zoom && (
        <div className="fixed inset-0 z-[90] bg-black/85 grid place-items-center p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Design" className="max-h-[92vh] max-w-[95vw] object-contain" />
          <button type="button" className="absolute top-4 right-4 text-white text-3xl" aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
}
