// Auto-pricing for quote-first team orders: roster rows x the public price
// list. Jersey price follows the order's jersey style; rush adds a flat $100.

import { itemLabel } from "@/lib/order-items";

// Per-item retail prices in cents (mirrors src/lib/pricing.ts).
const ITEM_PRICES: Record<string, number> = {
  jersey: 2800, // crew / v-neck default; overridden by style below
  practice_jersey: 2000,
  knickers: 4000,
  long_pants: 4000,
  shorts: 2500,
  hoodie: 4000, // heavyweight
  lightweight_hoodie: 3500,
  pullover: 4000, // 1/4-zip
  socks: 1500,
  fitted_hat: 3000,
  snapback_hat: 2500,
};

// Flat rush order fee: priority production + direct shipping. Charged once
// per order (not per piece) when rushShipping is set; staff approve the
// timeline before it's promised.
export const RUSH_FEE_CENTS = 10000;

// One-time hat digitizing charge: converting the design into an embroidery
// file. Charged once on the FIRST order that includes hats; reorders of the
// same design never pay it again (embroideryFeeWaived).
export const EMBROIDERY_FEE_CENTS = 2000;
const HAT_KEYS = ["fitted_hat", "snapback_hat"];

// Ocala league-family price for standard (crew/v-neck) jerseys.
export const LOCAL_JERSEY_CENTS = 2500;

// Approx shipping weight per item, ounces. The order's items are known, so the
// package weight - and thus shipping - is deterministic from the roster.
export const ITEM_WEIGHT_OZ: Record<string, number> = {
  jersey: 11,
  practice_jersey: 10,
  knickers: 14,
  long_pants: 16,
  shorts: 10,
  hoodie: 24,
  lightweight_hoodie: 16,
  pullover: 20,
  socks: 3,
  fitted_hat: 5,
  snapback_hat: 5,
};

/** Total estimated package weight (oz) for an order's roster. Each player's
 *  sized items count; a legacy row with only a jersey size counts as 1 jersey.
 *  Adds ~8oz packaging. */
export function estimateOrderWeightOz(
  roster: { size?: string | null; sizes?: Record<string, string> | null; quantity?: number | null }[],
): number {
  let oz = 0;
  for (const r of roster) {
    const qty = Math.max(1, r.quantity ?? 1);
    const sized = Object.entries(r.sizes ?? {}).filter(([, v]) => (v ?? "").trim());
    if (sized.length) {
      for (const [key] of sized) oz += (ITEM_WEIGHT_OZ[key] ?? 12) * qty;
    } else if ((r.size ?? "").trim()) {
      oz += ITEM_WEIGHT_OZ.jersey * qty;
    }
  }
  return oz > 0 ? oz + 8 : 0; // + packaging
}

// The jersey styles a team order can use, in the order shown in the form. The
// price follows the style via jerseyPriceCents (zip $38, full $35, two $32,
// crew/v-neck $28 / $25 local).
export const JERSEY_STYLES = ["Standard Crew Neck", "V-Neck", "Full Button", "Two Button", "Quarter-Zip"] as const;

export function jerseyPriceCents(jerseyStyle?: string | null, localPricing?: boolean | null): number {
  const s = (jerseyStyle ?? "").toLowerCase();
  if (s.includes("zip")) return 3800;
  if (s.includes("full")) return 3500;
  if (s.includes("two")) return 3200;
  return localPricing ? LOCAL_JERSEY_CENTS : 2800; // crew / v-neck / unspecified
}

/** Retail price for one piece of an order item ("jersey" follows the order's
 *  jersey style). Returns 0 for unknown keys. */
export function itemPriceCents(key: string, jerseyStyle?: string | null, localPricing?: boolean | null): number {
  if (key === "jersey") return jerseyPriceCents(jerseyStyle, localPricing);
  return ITEM_PRICES[key] ?? 0;
}

export type QuoteLine = { label: string; quantity: number; unitPriceCents: number; totalCents: number };

export type TeamOrderQuote = {
  lines: QuoteLine[];
  pieces: number;
  rushFeeCents: number;
  totalCents: number;
};

type RosterRow = {
  size?: string | null;
  sizes?: Record<string, string> | null;
  quantity?: number | null;
  /** "coach" | "self" | "addon". Paid add-on rows were bought through their
   *  own Stripe checkout, so quotes/invoices must never price them again. */
  filledBy?: string | null;
};

/** Count what each player actually ordered (their per-item sizes) and price
 *  it. A row with only the legacy `size` field counts as one jersey. */
export function computeTeamOrderQuote(
  order: {
    jerseyStyle?: string | null;
    items?: string[] | null;
    rushShipping?: boolean | null;
    localPricing?: boolean | null;
    /** Owner-negotiated per-jersey price for this order - wins over all defaults. */
    customJerseyCents?: number | null;
    /** Set when this design's one-time embroidery fee was already paid on a
     *  previous order (auto-detected at invoicing, or staff toggle). */
    embroideryFeeWaived?: boolean | null;
  },
  roster: RosterRow[],
): TeamOrderQuote {
  // Exclude already-paid add-on pieces: they joined the roster via their own
  // paid checkout. Without this, the quote-drift warning tells staff to
  // "update" the locked quote to a total that double-bills the add-ons.
  const billable = roster.filter((r) => r.filledBy !== "addon");
  const counts = new Map<string, number>();
  for (const row of billable) {
    const qty = Math.max(1, row.quantity ?? 1);
    const sized = Object.entries(row.sizes ?? {}).filter(([, v]) => (v ?? "").trim());
    if (sized.length) {
      for (const [key] of sized) counts.set(key, (counts.get(key) ?? 0) + qty);
    } else if ((row.size ?? "").trim()) {
      counts.set("jersey", (counts.get("jersey") ?? 0) + qty);
    }
  }

  const lines: QuoteLine[] = [];
  let pieces = 0;
  // Stable order: jersey first, then the rest alphabetically.
  const keys = Array.from(counts.keys()).sort((a, b) => (a === "jersey" ? -1 : b === "jersey" ? 1 : a.localeCompare(b)));
  for (const key of keys) {
    const quantity = counts.get(key)!;
    const unit =
      key === "jersey"
        ? order.customJerseyCents || jerseyPriceCents(order.jerseyStyle, order.localPricing)
        : ITEM_PRICES[key];
    if (!unit) continue; // unknown item type: leave for a manual quote
    const label =
      key === "jersey" && order.jerseyStyle ? `${order.jerseyStyle} Jersey` : itemLabel(key);
    lines.push({ label, quantity, unitPriceCents: unit, totalCents: unit * quantity });
    pieces += quantity;
  }

  // Hats in the order -> one-time embroidery digitizing fee, unless this
  // design already paid it on an earlier order. Added as a labeled line so
  // every invoice/estimate/email explains itself.
  if (!order.embroideryFeeWaived && HAT_KEYS.some((k) => counts.has(k))) {
    lines.push({
      label: "Embroidery Setup Fee (one-time, first hat order only)",
      quantity: 1,
      unitPriceCents: EMBROIDERY_FEE_CENTS,
      totalCents: EMBROIDERY_FEE_CENTS,
    });
  }

  const rushFeeCents = order.rushShipping ? RUSH_FEE_CENTS : 0;
  const totalCents = lines.reduce((s, l) => s + l.totalCents, 0) + rushFeeCents;
  return { lines, pieces, rushFeeCents, totalCents };
}
