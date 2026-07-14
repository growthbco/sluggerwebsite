// Per-person team stores: a private link where each player/parent buys their
// own gear at list prices via Stripe. Created from an approved design request.
// Item prices are snapshotted onto the store so pricing edits never change a
// live store.

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { teams } from "@/db/schema";
import { APPAREL_SIZES, SOCK_SIZES } from "@/lib/order-items";

export type StoreItem = {
  key: string;
  label: string;
  priceCents: number;
  sizes: string[];
  nameNumber?: boolean;
  /** Approx shipping weight in ounces; drives the weight-based ship fee. */
  weightOz: number;
};

// Everything a store can offer. The owner picks a subset per team when the
// store is created. Prices mirror src/lib/pricing.ts at snapshot time.
export const STORE_ITEM_PRESETS: StoreItem[] = [
  { key: "round_neck_jersey", label: "Round-Neck Jersey", priceCents: 2800, sizes: APPAREL_SIZES, nameNumber: true, weightOz: 10 },
  { key: "long_sleeve_shirt", label: "Long-Sleeve Shirt", priceCents: 3200, sizes: APPAREL_SIZES, nameNumber: true, weightOz: 12 },
  { key: "two_button_jersey", label: "Two-Button Jersey", priceCents: 3500, sizes: APPAREL_SIZES, nameNumber: true, weightOz: 11 },
  { key: "full_button_jersey", label: "Full-Button Jersey", priceCents: 3800, sizes: APPAREL_SIZES, nameNumber: true, weightOz: 12 },
  { key: "reversible_basketball", label: "Reversible Basketball Uniform", priceCents: 8500, sizes: APPAREL_SIZES, nameNumber: true, weightOz: 16 },
  { key: "hoodie", label: "Hoodie", priceCents: 4000, sizes: APPAREL_SIZES, nameNumber: true, weightOz: 24 },
  { key: "baseball_pants", label: "Baseball / Softball Pants", priceCents: 4000, sizes: APPAREL_SIZES, weightOz: 16 },
  { key: "microfiber_pants", label: "Lightweight Microfiber Pants", priceCents: 4000, sizes: APPAREL_SIZES, weightOz: 12 },
  { key: "knickers", label: "Knickers", priceCents: 4000, sizes: APPAREL_SIZES, weightOz: 14 },
  { key: "shorts", label: "Shorts", priceCents: 2500, sizes: APPAREL_SIZES, weightOz: 10 },
  { key: "socks", label: "Custom Socks", priceCents: 1500, sizes: SOCK_SIZES, weightOz: 3 },
  { key: "fitted_hat", label: "Fitted Hat", priceCents: 3000, sizes: ["S/M", "L/XL"], weightOz: 5 },
  { key: "snapback_hat", label: "Snapback Hat", priceCents: 2500, sizes: ["One Size"], weightOz: 5 },
];

// Shipping margin: customers are charged carrier cost + 25% (covers
// packaging/handling with profit). Applies to the weight formula below and,
// later, to live Shippo rates.
export const SHIPPING_MARGIN = 0.25;

/** Estimated carrier cost: $7 covers the first 3 lb, then $1 per lb. */
export function shippingCostCentsFor(totalOz: number): number {
  const lbs = Math.max(1, Math.ceil(totalOz / 16));
  return 700 + Math.max(0, lbs - 3) * 100;
}

// What the customer is charged: cost + margin, rounded up to a clean quarter.
// Local pickup in Ocala stays free (offered as a checkout option).
export function shippingCentsFor(totalOz: number): number {
  const cost = shippingCostCentsFor(totalOz);
  return Math.ceil((cost * (1 + SHIPPING_MARGIN)) / 25) * 25;
}

const token = () => randomUUID().replace(/-/g, "");

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** Create (and open) a team store from an approved design request. */
export async function createTeamStore(input: {
  name: string;
  sport?: string | null;
  contactEmail?: string | null;
  approvedDesignUrl?: string | null;
  designRequestId: string;
  itemKeys: string[];
}) {
  const db = getDb();

  // One store per design: reuse if it already exists.
  const [existing] = await db
    .select()
    .from(teams)
    .where(eq(teams.designRequestId, input.designRequestId))
    .limit(1);
  if (existing) return existing;

  const items = STORE_ITEM_PRESETS.filter((p) => input.itemKeys.includes(p.key));
  const base = slugify(input.name) || "team";
  const [row] = await db
    .insert(teams)
    .values({
      // Suffix keeps slugs unique without a lookup loop.
      slug: `${base}-${token().slice(0, 6)}`,
      name: input.name.trim(),
      sport: input.sport ?? undefined,
      contactEmail: input.contactEmail ?? undefined,
      storeActive: true,
      storeToken: token(),
      approvedDesignUrl: input.approvedDesignUrl ?? undefined,
      designRequestId: input.designRequestId,
      storeItems: items,
    })
    .returning();
  return row;
}

export async function getByStoreToken(tkn: string) {
  const db = getDb();
  const [row] = await db.select().from(teams).where(eq(teams.storeToken, tkn)).limit(1);
  return row ?? null;
}

export async function getStoreByDesignRequestId(designRequestId: string) {
  const db = getDb();
  const [row] = await db.select().from(teams).where(eq(teams.designRequestId, designRequestId)).limit(1);
  return row ?? null;
}

export async function setStoreActive(id: string, active: boolean) {
  const db = getDb();
  await db.update(teams).set({ storeActive: active }).where(eq(teams.id, id));
}
