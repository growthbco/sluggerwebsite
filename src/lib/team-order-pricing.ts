// Auto-pricing for quote-first team orders: roster rows x the public price
// list. Jersey price follows the order's jersey style; rush adds $5/piece.

import { itemLabel } from "@/lib/order-items";

// Per-item retail prices in cents (mirrors src/lib/pricing.ts).
const ITEM_PRICES: Record<string, number> = {
  jersey: 2800, // crew / v-neck default; overridden by style below
  knickers: 4000,
  long_pants: 4000,
  shorts: 2500,
  hoodie: 4000,
  socks: 1500,
};

export const RUSH_FEE_CENTS = 500; // per piece, when rushShipping is set

// Ocala league-family price for standard (crew/v-neck) jerseys.
export const LOCAL_JERSEY_CENTS = 2500;

// Approx shipping weight per item, ounces. The order's items are known, so the
// package weight - and thus shipping - is deterministic from the roster.
export const ITEM_WEIGHT_OZ: Record<string, number> = {
  jersey: 11,
  knickers: 14,
  long_pants: 16,
  shorts: 10,
  hoodie: 24,
  socks: 3,
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

export function jerseyPriceCents(jerseyStyle?: string | null, localPricing?: boolean | null): number {
  const s = (jerseyStyle ?? "").toLowerCase();
  if (s.includes("full")) return 3800;
  if (s.includes("two")) return 3500;
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
};

/** Count what each player actually ordered (their per-item sizes) and price
 *  it. A row with only the legacy `size` field counts as one jersey. */
export function computeTeamOrderQuote(
  order: { jerseyStyle?: string | null; items?: string[] | null; rushShipping?: boolean | null; localPricing?: boolean | null },
  roster: RosterRow[],
): TeamOrderQuote {
  const counts = new Map<string, number>();
  for (const row of roster) {
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
    const unit = key === "jersey" ? jerseyPriceCents(order.jerseyStyle, order.localPricing) : ITEM_PRICES[key];
    if (!unit) continue; // unknown item type: leave for a manual quote
    const label =
      key === "jersey" && order.jerseyStyle ? `${order.jerseyStyle} Jersey` : itemLabel(key);
    lines.push({ label, quantity, unitPriceCents: unit, totalCents: unit * quantity });
    pieces += quantity;
  }

  const rushFeeCents = order.rushShipping ? pieces * RUSH_FEE_CENTS : 0;
  const totalCents = lines.reduce((s, l) => s + l.totalCents, 0) + rushFeeCents;
  return { lines, pieces, rushFeeCents, totalCents };
}
