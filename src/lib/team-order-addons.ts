// Post-submission add-ons: a coach pays for a few extra pieces on an existing
// team order. Rows are held pending until Stripe confirms payment, then
// appended to the roster so production and print-file QA see them.

import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrderAddons, teamOrders } from "@/db/schema";
import { addRosterRow } from "@/lib/team-orders";
import { itemPriceCents } from "@/lib/team-order-pricing";
import { itemLabel, sizesFor, notDesignerMade, EXTRA_ADDON_KEYS } from "@/lib/order-items";

// Approx shipping weight per piece in ounces - used when an add-on comes in
// AFTER the main order shipped (it can't ride with the batch anymore).
export const ITEM_WEIGHT_OZ: Record<string, number> = {
  jersey: 11,
  practice_jersey: 10,
  knickers: 14,
  long_pants: 16,
  shorts: 10,
  hoodie: 24,
  lightweight_hoodie: 16,
  pullover: 20,
  jacket: 20,
  socks: 3,
  fitted_hat: 5,
  snapback_hat: 5,
};

export function addonWeightOz(rows: { key: string; quantity: number }[]): number {
  return rows.reduce((s, r) => s + (ITEM_WEIGHT_OZ[r.key] ?? 12) * r.quantity, 0);
}

/** Per-box weights for an add-on that ships on its own: hats go in their own
 *  box, so a mixed add-on is two parcels (and two shipping charges). */
export function addonParcelsOz(rows: { key: string; quantity: number }[]): number[] {
  let apparel = 0;
  let hat = 0;
  for (const r of rows) {
    const oz = (ITEM_WEIGHT_OZ[r.key] ?? 12) * r.quantity;
    if (r.key === "fitted_hat" || r.key === "snapback_hat") hat += oz;
    else apparel += oz;
  }
  return [apparel, hat].filter((w) => w > 0);
}

/** Paid add-on batches that still need print-file verification (printVerifiedAt
 *  null). Verified/archived batches are excluded. */
async function unverifiedPaidAddonBatches(teamOrderId: string) {
  const db = getDb();
  const { isNull } = await import("drizzle-orm");
  return db
    .select()
    .from(teamOrderAddons)
    .where(and(eq(teamOrderAddons.teamOrderId, teamOrderId), eq(teamOrderAddons.status, "paid"), isNull(teamOrderAddons.printVerifiedAt)));
}

/**
 * The NEW add-on pieces still to verify against a print file, expanded per
 * quantity, as name/number/size entries. Uses each piece's own size
 * (hoodie/pullover/etc.), not the jersey size. Scope: paid add-on batches not
 * yet print-verified (earlier verified/shipped batches are archived history and
 * never re-checked). Non-printed in-house items (hats) are excluded.
 */
export async function pendingAddonRoster(teamOrderId: string): Promise<{ name: string; number: string; size: string }[]> {
  const batches = await unverifiedPaidAddonBatches(teamOrderId);
  return batches
    .flatMap((b) => b.rows)
    .filter((r) => !notDesignerMade(r.key))
    .flatMap((r) =>
      Array.from({ length: Math.max(1, r.quantity) }, () => ({
        name: (r.name ?? "").trim(),
        number: (r.number ?? "").trim(),
        size: (r.size ?? "").trim(),
      })),
    )
    .filter((r) => r.name && r.number);
}

/** Paid add-on batches for display as roster history: pieces (with item label
 *  + size), when it was paid, and whether its print file was verified. Newest
 *  first. */
export async function getPaidAddonBatches(teamOrderId: string): Promise<
  { id: string; paidAt: Date | null; verified: boolean; printFileUrls: string[]; pieces: { label: string; name: string; number: string; size: string; quantity: number }[] }[]
> {
  const db = getDb();
  const { desc } = await import("drizzle-orm");
  const batches = await db
    .select()
    .from(teamOrderAddons)
    .where(and(eq(teamOrderAddons.teamOrderId, teamOrderId), eq(teamOrderAddons.status, "paid")))
    .orderBy(desc(teamOrderAddons.paidAt));
  return batches.map((b) => ({
    id: b.id,
    paidAt: b.paidAt,
    verified: Boolean(b.printVerifiedAt),
    printFileUrls: b.printFileUrls ?? [],
    pieces: b.rows.map((r) => ({ label: itemLabel(r.key), name: (r.name ?? "").trim(), number: (r.number ?? "").trim(), size: r.size, quantity: r.quantity })),
  }));
}

/**
 * The MOST RECENT paid add-on batch's pieces (verified or not), expanded per
 * quantity, using each piece's own size. This is the "current add-on roster"
 * shown/checked in add-ons-only mode - so the view stays available even after
 * the batch has been verified. Non-printed in-house items excluded.
 */
export async function latestAddonBatchRoster(teamOrderId: string): Promise<{ name: string; number: string; size: string; item: string }[]> {
  const db = getDb();
  const { desc } = await import("drizzle-orm");
  const [latest] = await db
    .select()
    .from(teamOrderAddons)
    .where(and(eq(teamOrderAddons.teamOrderId, teamOrderId), eq(teamOrderAddons.status, "paid")))
    .orderBy(desc(teamOrderAddons.paidAt))
    .limit(1);
  if (!latest) return [];
  return latest.rows
    .filter((r) => !notDesignerMade(r.key))
    .flatMap((r) =>
      Array.from({ length: Math.max(1, r.quantity) }, () => ({
        name: (r.name ?? "").trim(),
        number: (r.number ?? "").trim(),
        size: (r.size ?? "").trim(),
        item: itemLabel(r.key),
      })),
    )
    .filter((r) => r.name && r.number);
}

/** Mark every currently-unverified paid add-on batch as print-verified (so a
 *  later add-on's check won't re-flag them) and attach the approved sheet URLs
 *  to the most recent paid batch. */
export async function markAddonsPrintVerified(teamOrderId: string, printFileUrls?: string[]): Promise<void> {
  const db = getDb();
  const { isNull, desc } = await import("drizzle-orm");
  await db
    .update(teamOrderAddons)
    .set({ printVerifiedAt: new Date() })
    .where(and(eq(teamOrderAddons.teamOrderId, teamOrderId), eq(teamOrderAddons.status, "paid"), isNull(teamOrderAddons.printVerifiedAt)));
  if (printFileUrls && printFileUrls.length) {
    const [latest] = await db
      .select({ id: teamOrderAddons.id })
      .from(teamOrderAddons)
      .where(and(eq(teamOrderAddons.teamOrderId, teamOrderId), eq(teamOrderAddons.status, "paid")))
      .orderBy(desc(teamOrderAddons.paidAt))
      .limit(1);
    if (latest) await db.update(teamOrderAddons).set({ printFileUrls }).where(eq(teamOrderAddons.id, latest.id));
  }
}

export type AddonRowInput = {
  key: string;
  size?: string;
  name?: string;
  number?: string;
  design?: string;
  quantity?: number;
};

export type AddonRow = {
  key: string;
  label: string;
  size: string;
  name?: string;
  number?: string;
  design?: string;
  quantity: number;
  unitPriceCents: number;
};

/** Validate + price requested add-on rows against the order's item types. */
export function priceAddonRows(
  order: { jerseyStyle?: string | null; jerseyMaterial?: string | null; items?: string[] | null; localPricing?: boolean | null; customJerseyCents?: number | null },
  inputs: AddonRowInput[],
): { rows: AddonRow[]; totalCents: number } {
  // The order's own items, plus the always-available add-on apparel (hoodies
  // etc.) any team can add in their design.
  const allowed = new Set([...(order.items?.length ? order.items : ["jersey"]), ...EXTRA_ADDON_KEYS]);
  const rows: AddonRow[] = [];
  for (const r of inputs.slice(0, 50)) {
    if (!allowed.has(r.key)) continue;
    const unit =
      r.key === "jersey" && order.customJerseyCents
        ? order.customJerseyCents
        : itemPriceCents(r.key, order.jerseyStyle, order.localPricing, order.jerseyMaterial);
    if (!unit) continue;
    const sizes = sizesFor(r.key);
    rows.push({
      key: r.key,
      label: itemLabel(r.key),
      size: sizes.includes(r.size ?? "") ? (r.size as string) : sizes[0],
      name: (r.name ?? "").trim().slice(0, 30) || undefined,
      number: (r.number ?? "").trim().replace(/[^0-9]/g, "").slice(0, 4) || undefined,
      design: (r.design ?? "").trim().slice(0, 60) || undefined,
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
          design: r.design,
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
  if (addon.rows.some((r) => !notDesignerMade(r.key))) {
    await db
      .update(teamOrders)
      .set({ printFileVerifiedAt: null, printFileVerification: null, updatedAt: new Date() })
      .where(eq(teamOrders.id, addon.teamOrderId));
  }

  const summary = addon.rows.map((r) => `${r.quantity}× ${r.label}`).join(", ");
  return { addon, order, summary };
}


/** Build a single-use Stripe payment link for a set of add-on rows on an
 *  order (shared by the public add-on endpoint and the admin combine action).
 *  Creates the addon batch, the link, and stores the link id on the batch. */
export async function createAddonCheckoutLink(
  order: { id: string; reference: string; teamName: string; status: string; jerseyStyle?: string | null; items?: string[] | null; localPricing?: boolean | null; customJerseyCents?: number | null },
  rows: AddonRow[],
  totalCents: number,
): Promise<{ url: string; addonId: string } | { error: string }> {
  const { getStripe } = await import("@/lib/stripe");
  const { taxCents, SALES_TAX_LABEL } = await import("@/lib/pricing");
  const { shippingCentsFor } = await import("@/lib/team-stores");
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  const stripe = getStripe();
  try {
    const addon = await createAddon(order.id, rows, totalCents);
    const ADDON_SEPARATE_SHIP_MIN = 10;
    const pieceCount = rows.reduce((s, r) => s + r.quantity, 0);
    const shipsSeparately = order.status === "shipped" || pieceCount >= ADDON_SEPARATE_SHIP_MIN;
    const makePrice = async (name: string, unitAmount: number) =>
      (await stripe.prices.create({ currency: "usd", unit_amount: unitAmount, product_data: { name } })).id;
    const lineItems: { price: string; quantity: number }[] = [];
    for (const r of rows) {
      lineItems.push({
        quantity: r.quantity,
        price: await makePrice(
          `${r.label} - ${[r.design, r.size, r.name?.toUpperCase(), r.number ? `#${r.number}` : null].filter(Boolean).join(" - ")} (add-on ${order.reference})`,
          r.unitPriceCents,
        ),
      });
    }
    const addonTax = taxCents(totalCents);
    if (addonTax > 0) lineItems.push({ quantity: 1, price: await makePrice(SALES_TAX_LABEL, addonTax) });
    let shippingOptions: { shipping_rate: string }[] = [];
    if (shipsSeparately) {
      const boxes = addonParcelsOz(rows);
      const [byWeight, pickup] = await Promise.all([
        stripe.shippingRates.create({ display_name: boxes.length > 1 ? "Shipping (2 boxes - hats ship separately)" : "Shipping (by weight)", type: "fixed_amount", fixed_amount: { amount: boxes.reduce((s, w) => s + shippingCentsFor(w), 0), currency: "usd" } }),
        stripe.shippingRates.create({ display_name: "Free local pickup (Ocala, FL)", type: "fixed_amount", fixed_amount: { amount: 0, currency: "usd" } }),
      ]);
      shippingOptions = [{ shipping_rate: byWeight.id }, { shipping_rate: pickup.id }];
    }
    const link = await stripe.paymentLinks.create({
      line_items: lineItems,
      restrictions: { completed_sessions: { limit: 1 } },
      ...(shipsSeparately ? { shipping_address_collection: { allowed_countries: ["US"] as const }, shipping_options: shippingOptions } : {}),
      metadata: { kind: "team_order_addon", addonId: addon.id, teamOrderId: order.id, teamName: order.teamName },
      after_completion: { type: "redirect", redirect: { url: `${SITE}/checkout/success` } },
    });
    await setAddonSession(addon.id, link.id);
    return { url: link.url!, addonId: addon.id };
  } catch (e) {
    console.error("createAddonCheckoutLink failed:", e);
    return { error: "Could not create the payment link" };
  }
}

/** Remove a pending add-on batch (and deactivate its Stripe link). No-op if
 *  the batch is already paid. */
export async function removePendingAddon(addonId: string): Promise<boolean> {
  const db = getDb();
  const [a] = await db.select().from(teamOrderAddons).where(eq(teamOrderAddons.id, addonId)).limit(1);
  if (!a || a.status !== "pending") return false;
  if (a.stripeCheckoutSessionId?.startsWith("plink_")) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      await getStripe().paymentLinks.update(a.stripeCheckoutSessionId, { active: false });
    } catch {}
  }
  await db.delete(teamOrderAddons).where(eq(teamOrderAddons.id, addonId));
  return true;
}
