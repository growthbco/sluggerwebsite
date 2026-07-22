// Public retail price list (owner-confirmed, Jul 2026). Per piece, plus tax.
// Flat pricing - no minimums, no quantity tiers. The custom design is included.
// Anything not listed here (specialty items) is quoted custom.

export type PriceRow = { item: string; priceCents: number; note?: string };
export type PriceGroup = { group: string; rows: PriceRow[] };

export const PRICE_LIST: PriceGroup[] = [
  {
    group: "Jerseys & Shirts",
    rows: [
      { item: "Round-Neck Jersey (any sport)", priceCents: 2800, note: "Baseball, softball, soccer, pickleball & more - dry-fit included" },
      { item: "Long-Sleeve Shirt", priceCents: 3200 },
      { item: "Two-Button Jersey", priceCents: 3500 },
      { item: "Full-Button Jersey", priceCents: 3800 },
      { item: "Reversible Basketball Uniform", priceCents: 8500, note: "Two looks in one - home & away" },
    ],
  },
  {
    group: "Bottoms",
    rows: [
      { item: "Baseball / Softball Pants", priceCents: 4000 },
      { item: "Knickers", priceCents: 4000 },
      { item: "Shorts", priceCents: 2500 },
    ],
  },
  {
    group: "Headwear",
    rows: [
      { item: "Fitted Hat", priceCents: 3000, note: "Cap America / Pacific Headwear performance cap with Flexfit, XS-XXL - add a number on the back for $5" },
      { item: "Snapback Hat", priceCents: 2500, note: "Cap America / Pacific Headwear premium trucker, one size fits most - add a number on the back for $5" },
    ],
  },
  {
    group: "Hoodies & Extras",
    rows: [
      { item: "Hoodie", priceCents: 4000 },
      { item: "Custom Socks", priceCents: 1500 },
      { item: "Custom 3D Hype Chain", priceCents: 4000, note: "Starting price - final depends on design detail and colors. Free mockup; one-time $50 3D design file fee per design, then each chain from $40" },
    ],
  },
];

export function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

// Flat Florida / Marion County sales tax applied to goods on every order.
export const SALES_TAX_RATE = 0.07;
export const SALES_TAX_LABEL = "FL Sales Tax (7%)";
export function taxCents(subtotalCents: number): number {
  return Math.round(subtotalCents * SALES_TAX_RATE);
}
