// Public 2026 retail price list (owner-confirmed, Jul 2026). Per piece, plus
// tax. Prices are reviewed as market costs / rates / duties change.
// Flat pricing, no quantity tiers; 6-piece minimum per custom design (hats
// hats included; embroidered in-house so they turn fast). Custom design included.
// Anything not listed here (specialty items) is quoted custom.

export type PriceRow = { item: string; priceCents: number; note?: string };
export type PriceGroup = { group: string; rows: PriceRow[] };

export const PRICE_LIST: PriceGroup[] = [
  {
    group: "Jerseys & Shirts",
    rows: [
      { item: "Round-Neck Jersey (any sport)", priceCents: 2800, note: "Baseball, softball, soccer, pickleball & more - your choice of mesh or dry-fit material" },
      { item: "V-Neck Jersey", priceCents: 3000, note: "Fully sublimated with names, numbers, and custom design included" },
      { item: "Dry-Fit Practice Jersey", priceCents: 2000, note: "Lightweight practice-weight shirt (not a game jersey) - practice sets, coaches, parents & fans" },
      { item: "Long-Sleeve Shirt", priceCents: 3200 },
      { item: "Two-Button Jersey", priceCents: 3200 },
      { item: "Full-Button Jersey", priceCents: 3500 },
      { item: "Bowling Shirt (full-button)", priceCents: 4200, note: "Camp-collar / full-button bowling shirt in premium microfiber. Crew-cut bowling shirts start at $28." },
      { item: "Quarter-Zip Jersey", priceCents: 4000, note: "Premium quarter-zip pullover in full custom sublimation" },
      { item: "Reversible Basketball Uniform", priceCents: 8500, note: "Two looks in one - home & away" },
      { item: "Hockey Jersey", priceCents: 5500, note: "Fully sublimated ice-hockey jersey (sweater) - standard or lace-up collar" },
      { item: "Cheer Uniform (Set)", priceCents: 12000, note: "Simple sublimated cheer set; rhinestone sets are $175. Same price youth to adult. Accessories: crop top $48, brief $35, pom-poms $40, bow $25, socks $20, team bag $90" },
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
      { item: "Snapback Hat", priceCents: 3000, note: "Cap America / Pacific Headwear premium trucker, one size fits most - add a number on the back for $5" },
      { item: "Performance Cap", priceCents: 3800, note: "Water-resistant, moisture-wicking performance shell, one size fits most, limited colors (black, white, gray) - add a number on the back for $5" },
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

// 2026 bundles (owner-approved Jul 2026). Priced with round-neck jerseys and
// snapback hats; button jerseys upgrade at the usual difference. The discount
// is deliberately small - bundles exist to simplify the decision, not to be
// cheap (margins stay above the 2x floor).
export type Bundle = {
  name: string;
  priceCents: number;
  compareAtCents: number; // a-la-carte total
  includes: string[];
  image: string;
  blurb: string;
};

export const BUNDLES: Bundle[] = [
  {
    name: "Game Day Bundle",
    priceCents: 8900,
    compareAtCents: 9300,
    includes: ["Crew-Style Custom Jersey", "Baseball / Softball Pants", "Snapback Hat"],
    image: "/bundles/game-day.jpg",
    blurb: "Everything one player needs to take the field - jersey, pants, and the hat to match.",
  },
  {
    name: "Home & Away Bundle",
    priceCents: 9300,
    compareAtCents: 9600,
    includes: ["2 Crew-Style Custom Jerseys (home + away)", "Baseball / Softball Pants"],
    image: "/bundles/home-away.jpg",
    blurb: "Two looks, one price - a home and an away jersey with pants to run all season.",
  },
  {
    name: "The Total Package",
    priceCents: 12900,
    compareAtCents: 13600,
    includes: ["2 Crew-Style Custom Jerseys (home + away)", "Baseball / Softball Pants", "Snapback Hat", "Custom Socks"],
    image: "/bundles/total-package.jpg",
    blurb: "The full kit, head to toe - our best per-player value.",
  },
];

export const BUNDLE_UPGRADE_NOTE =
  "Bundle prices are estimated for crew-style (over-the-head) jerseys with a snapback hat. V-neck adds $2 per jersey, two-button adds $4, full-button adds $7, quarter-zip adds $12, and a water-resistant performance cap instead of a snapback adds $8.";

export function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

// Flat Florida / Marion County sales tax applied to goods on every order.
export const SALES_TAX_RATE = 0.07;
export const SALES_TAX_LABEL = "FL Sales Tax (7%)";
export function taxCents(subtotalCents: number): number {
  return Math.round(subtotalCents * SALES_TAX_RATE);
}
