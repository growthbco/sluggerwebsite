// Post-submission add-ons: a coach pays for a few extra pieces on an existing
// team order. Rows are held pending until Stripe confirms payment, then
// appended to the roster so production and print-file QA see them.

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrderAddons, teamOrders } from "@/db/schema";
import { addRosterRow } from "@/lib/team-orders";
import { itemPriceCents } from "@/lib/team-order-pricing";
import { itemLabel, sizesFor, isInHouseItem } from "@/lib/order-items";

// Approx shipping weight per piece in ounces - used when an add-on comes in
// AFTER the main order shipped (it can't ride with the batch anymore).
export const ITEM_WEIGHT_OZ: Record<string, number> = {
  jersey: 11,
  knickers: 14,
  long_pants: 16,
  shorts: 10,
  hoodie: 24,
  socks: 3,
  fitted_hat: 5,
  snapback_hat: 5,
};

export function addonWeightOz(rows: { key: string; quantity: number }[]): number {
  return rows.reduce((s, r) => s + (ITEM_WEIGHT_OZ[r.key] ?? 12) * r.quantity, 0);
}

export type AddonRowInput = {
  key: string;
  size?: string;
  name?: string;
  number?: string;
  quantity?: number;
};

export type AddonRow = {
  key: string;
  label: string;
  size: string;
  name?: string;
  number?: string;
  quantity: number;
  unitPriceCents: number;
};

/** Validate + price requested add-on rows against the order's item types. */
export function priceAddonRows(
  order: { jerseyStyle?: string | null; items?: string[] | null; localPricing?: boolean | null; customJerseyCents?: number | null },
  inputs: AddonRowInput[],
): { rows: AddonRow[]; totalCents: number } {
  const allowed = new Set(order.items?.length ? order.items : ["jersey"]);
  const rows: AddonRow[] = [];
  for (const r of inputs.slice(0, 50)) {
    if (!allowed.has(r.key)) continue;
    const unit =
      r.key === "jersey" && order.customJerseyCents
        ? order.customJerseyCents
        : itemPriceCents(r.key, order.jerseyStyle, order.localPricing);
    if (!unit) continue;
    const sizes = sizesFor(r.key);
    rows.push({
      key: r.key,
      label: itemLabel(r.key),
      size: sizes.includes(r.size ?? "") ? (r.size as string) : sizes[0],
      name: (r.name ?? "").trim().slice(0, 30) || undefined,
      number: (r.number ?? "").trim().replace(/[^0-9]/g, "").slice(0, 4) || undefined,
      quantity: Math.max(1, Math.min(50, Number(r.quantity) || 1)),
      unitPriceCents: unit,
    });
  }
  const totalCents = rows.reduce((s, r) => s + r.unitPriceCents * r.quantity, 0);
  return { rows, totalCents };
}

export async function createAddon(teamOrderId: string, rows: AddonRow[], totalCents: number) {
  const db = getDb();
  const [row] = await db.insert(teamOrderAddons).values({ teamOrderId, rows, totalCents }).returning();
  return row;
}

export async function setAddonSession(addonId: string, sessionId: string) {
  const db = getDb();
  await db.update(teamOrderAddons).set({ stripeCheckoutSessionId: sessionId }).where(eq(teamOrderAddons.id, addonId));
}

/** Webhook: mark paid (idempotent) and append the pieces to the roster.
 *  paidTotalCents is Stripe's amount_total (goods + tax + shipping). */
export async function markAddonPaid(addonId: string, sessionId: string, paidTotalCents?: number) {
  const db = getDb();
  const [addon] = await db.select().from(teamOrderAddons).where(eq(teamOrderAddons.id, addonId)).limit(1);
  if (!addon || addon.status === "paid") return null; // retry or unknown: skip
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, addon.teamOrderId)).limit(1);
  if (!order) return null;

  await db
    .update(teamOrderAddons)
    .set({ status: "paid", paidAt: new Date(), stripeCheckoutSessionId: sessionId, paidTotalCents: paidTotalCents ?? null })
    .where(eq(teamOrderAddons.id, addonId));

  for (const r of addon.rows) {
    for (let i = 0; i < r.quantity; i++) {
      await addRosterRow(
        addon.teamOrderId,
        {
          playerName: r.name,
          playerNumber: r.number,
          sizes: { [r.key]: r.size },
          notes: "PAID ADD-ON",
        },
        "addon",
      );
    }
  }

  // A printed-piece add-on invalidates the current print-file QA: the file on
  // record doesn't include the new pieces, so the designer must upload an
  // updated print file and pass the AI check (or staff override) again before
  // printing - even if the original order was already verified and approved.
  // The old sheet URLs are kept so re-verifying against them flags the new
  // pieces as missing instead of silently passing. In-house pieces (hats) are
  // embroidered at the shop and never touch the print file, so a hat-only
  // add-on leaves the QA alone.
  if (addon.rows.some((r) => !isInHouseItem(r.key))) {
    await db
      .update(teamOrders)
      .set({ printFileVerifiedAt: null, printFileVerification: null, updatedAt: new Date() })
      .where(eq(teamOrders.id, addon.teamOrderId));
  }

  const summary = addon.rows.map((r) => `${r.quantity}× ${r.label}`).join(", ");
  return { addon, order, summary };
}
