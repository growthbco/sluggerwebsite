// Public retail price list (owner-confirmed, Jul 2026). Per piece, plus tax.
// Flat pricing - no minimums, no quantity tiers. The custom design is included.
// Anything not listed here (hype chains, specialty items) is quoted custom.

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
      { item: "Fitted Hat", priceCents: 3000, note: "Custom embroidered" },
      { item: "Snapback Hat", priceCents: 2500, note: "Custom embroidered" },
    ],
  },
  {
    group: "Hoodies & Extras",
    rows: [
      { item: "Hoodie", priceCents: 4000 },
      { item: "Custom Socks", priceCents: 1500 },
    ],
  },
];

export function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}
