// Auto-pricing for quote-first team orders: roster rows x the public price
// list. Jersey price follows the order's jersey style; rush adds a flat $100.

import { itemLabel } from "@/lib/order-items";

// Per-item retail prices in cents (mirrors src/lib/pricing.ts).
const ITEM_PRICES: Record<string, number> = {
  jersey: 2800, // crew default; V-neck and premium cuts are overridden below
  hockey_jersey: 5500, // ice-hockey sweater; ~2.3x the $24 designer cost
  flag_football_jersey: 2800, // sleeveless compression game shirt
  practice_jersey: 2000,
  knickers: 4000,
  long_pants: 4000,
  shorts: 2500,
  hoodie: 4000, // heavyweight
  lightweight_hoodie: 3500,
  pullover: 4000, // 1/4-zip
  socks: 1500,
  cheer_uniform: 12000, // simple sublimated cheer set
  cheer_uniform_rhinestone: 17500, // rhinestone / all-star cheer set
  fitted_hat: 3000,
  snapback_hat: 3000, // leveled with fitted - one hat price
  performance_hat: 3800, // premium water-resistant performance cap
  beanie: 4000, // custom knit beanie, special-ordered from Cap America (estimate; adjust to real cost)
};

// Flat rush order fee: priority production + direct shipping. Charged once
// per order (not per piece) when rushShipping is set; staff approve the
// timeline before it's promised.
export const RUSH_FEE_CENTS = 10000;

// White-label upgrade (remove the SA back-logo + neck label): priced PER PIECE
// because the value is lost advertising, which scales with quantity - with a
// per-order floor so small runs still pay meaningfully.
export const WHITE_LABEL_PER_PIECE_CENTS = 250;
export const WHITE_LABEL_MIN_CENTS = 5000;

/** The white-label fee for an order of N billable pieces. */
export function whiteLabelFeeCents(pieces: number): number {
  return Math.max(WHITE_LABEL_MIN_CENTS, pieces * WHITE_LABEL_PER_PIECE_CENTS);
}

// One-time hat digitizing charge: converting the design into an embroidery
// file. Charged once on the FIRST order that includes hats; reorders of the
// same design never pay it again (embroideryFeeWaived).
export const EMBROIDERY_FEE_CENTS = 2000;
const HAT_KEYS = ["fitted_hat", "snapback_hat", "performance_hat"];

// Ocala league-family price for standard crew/V-neck jerseys.
export const LOCAL_JERSEY_CENTS = 2500;

// Approx shipping weight per item, ounces. The order's items are known, so the
// package weight - and thus shipping - is deterministic from the roster.
export const ITEM_WEIGHT_OZ: Record<string, number> = {
  jersey: 11,
  hockey_jersey: 14,
  flag_football_jersey: 8,
  practice_jersey: 10,
  knickers: 14,
  long_pants: 16,
  shorts: 10,
  hoodie: 24,
  lightweight_hoodie: 16,
  pullover: 20,
  socks: 3,
  cheer_uniform: 14, // shell + skirt
  cheer_uniform_rhinestone: 14,
  fitted_hat: 5,
  snapback_hat: 5,
  performance_hat: 5,
  beanie: 4,
};

/** Per-parcel weights (oz) for an order's roster. Hats ship in their OWN box
 *  (a structured hat can't be packed with folded apparel without crushing),
 *  so a mixed order is two parcels - and two shipping charges. Each non-empty
 *  parcel gets ~8oz packaging. */
export function estimateOrderParcelsOz(
  roster: { size?: string | null; sizes?: Record<string, string> | null; quantity?: number | null }[],
): { apparelOz: number; hatOz: number } {
  let apparel = 0;
  let hat = 0;
  for (const r of roster) {
    const qty = Math.max(1, r.quantity ?? 1);
    const sized = Object.entries(r.sizes ?? {}).filter(([, v]) => (v ?? "").trim());
    if (sized.length) {
      for (const [key] of sized) {
        const oz = (ITEM_WEIGHT_OZ[key] ?? 12) * qty;
        if (HAT_KEYS.includes(key)) hat += oz;
        else apparel += oz;
      }
    } else if ((r.size ?? "").trim()) {
      apparel += ITEM_WEIGHT_OZ.jersey * qty;
    }
  }
  return { apparelOz: apparel > 0 ? apparel + 8 : 0, hatOz: hat > 0 ? hat + 8 : 0 };
}

/** Total estimated shipping weight (oz) across all parcels. */
export function estimateOrderWeightOz(
  roster: { size?: string | null; sizes?: Record<string, string> | null; quantity?: number | null }[],
): number {
  const { apparelOz, hatOz } = estimateOrderParcelsOz(roster);
  return apparelOz + hatOz;
}

// The jersey styles a team order can use, in the order shown in the form. The
// price follows the style via jerseyPriceCents (zip $38, full $35, two $32,
// V-neck $29, crew $28; crew/V-neck are $25 with local pricing).
export const JERSEY_STYLES = ["Standard Crew Neck", "V-Neck", "Full Button", "Two Button", "Quarter-Zip"] as const;

export function jerseyPriceCents(jerseyStyle?: string | null, localPricing?: boolean | null, material?: string | null): number {
  const s = (jerseyStyle ?? "").toLowerCase();
  // Bowling shirts are cut in a pricier microfiber, so a full-button bowling
  // shirt is $42 (not the $35 standard full-button). Only full-button carries
  // this premium; other bowling styles price by their normal style.
  const microfiber = (material ?? "").toLowerCase() === "microfiber";
  if (s.includes("full") && microfiber) return 4200;
  if (s.includes("zip")) return 3800;
  if (s.includes("full")) return 3500;
  if (s.includes("two")) return 3200;
  if (/v[\s-]?neck/.test(s)) return localPricing ? LOCAL_JERSEY_CENTS : 2900;
  return localPricing ? LOCAL_JERSEY_CENTS : 2800; // crew / unspecified
}

/** Retail price for one piece of an order item ("jersey" follows the order's
 *  jersey style + material). Returns 0 for unknown keys. */
export function itemPriceCents(key: string, jerseyStyle?: string | null, localPricing?: boolean | null, material?: string | null): number {
  if (key === "jersey") return jerseyPriceCents(jerseyStyle, localPricing, material);
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
    jerseyMaterial?: string | null;
    items?: string[] | null;
    rushShipping?: boolean | null;
    localPricing?: boolean | null;
    /** Owner-negotiated per-jersey price for this order - wins over all defaults. */
    customJerseyCents?: number | null;
    /** Set when this design's one-time embroidery fee was already paid on a
     *  previous order (auto-detected at invoicing, or staff toggle). */
    embroideryFeeWaived?: boolean | null;
    /** Paid white-label upgrade: adds a flat fee and drops SA branding. */
    whiteLabel?: boolean | null;
  },
  roster: RosterRow[],
): TeamOrderQuote {
  // Exclude already-paid add-on pieces: they joined the roster via their own
  // paid checkout. Without this, the quote-drift warning tells staff to
  // "update" the locked quote to a total that double-bills the add-ons.
  const billable = roster.filter((r) => r.filledBy !== "addon");
  const orderItems = order.items?.length ? order.items : ["jersey"];
  const allowedItems = new Set(orderItems);
  const counts = new Map<string, number>();
  for (const row of billable) {
    const qty = Math.max(1, row.quantity ?? 1);
    const sized = Object.entries(row.sizes ?? {}).filter(([, v]) => (v ?? "").trim());
    const matching = sized.filter(([key]) => allowedItems.has(key));
    if (matching.length) {
      for (const [key] of matching) counts.set(key, (counts.get(key) ?? 0) + qty);
    } else if (sized.length && orderItems.length === 1) {
      // Legacy safety net: if an order's product was corrected after its
      // roster was entered (for example jersey -> rhinestone cheer set), its
      // single active item is the pricing source of truth—not the stale key.
      const key = orderItems[0];
      counts.set(key, (counts.get(key) ?? 0) + qty);
    } else if ((row.size ?? "").trim()) {
      const key = allowedItems.has("jersey") ? "jersey" : orderItems.length === 1 ? orderItems[0] : null;
      if (key) counts.set(key, (counts.get(key) ?? 0) + qty);
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
        ? order.customJerseyCents || jerseyPriceCents(order.jerseyStyle, order.localPricing, order.jerseyMaterial)
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

  // Paid white-label upgrade: per piece with a per-order floor, its own line.
  if (order.whiteLabel && pieces > 0) {
    const fee = whiteLabelFeeCents(pieces);
    const atFloor = fee === WHITE_LABEL_MIN_CENTS && pieces * WHITE_LABEL_PER_PIECE_CENTS < WHITE_LABEL_MIN_CENTS;
    lines.push(
      atFloor
        ? { label: `White-label - remove Slugger branding (${pieces} pc, minimum)`, quantity: 1, unitPriceCents: fee, totalCents: fee }
        : { label: "White-label - remove Slugger branding", quantity: pieces, unitPriceCents: WHITE_LABEL_PER_PIECE_CENTS, totalCents: fee },
    );
  }

  const rushFeeCents = order.rushShipping ? RUSH_FEE_CENTS : 0;
  const totalCents = lines.reduce((s, l) => s + l.totalCents, 0) + rushFeeCents;
  return { lines, pieces, rushFeeCents, totalCents };
}
