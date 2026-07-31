import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { dbEnabled, getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { getStoreByHandle, shippingCentsFor, applyFundraise, fundraisePortionCents } from "@/lib/team-stores";
import { taxCents, SALES_TAX_LABEL } from "@/lib/pricing";

export const runtime = "nodejs";

type IncomingItem = { key: string; size?: string; playerName?: string; playerNumber?: string; quantity: number; design?: string };

// Self-serve "add items to my existing store order". Reprices the new items
// from the store snapshot, recomputes shipping on the COMBINED weight, and
// charges only the new goods + any shipping INCREASE - the add ships in the
// same box as the original order (no new address). The webhook merges the
// items into that order on payment.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!stripeEnabled() || !dbEnabled()) return NextResponse.json({ error: "Checkout isn't configured yet." }, { status: 503 });
  const { token } = await params;
  const store = await getStoreByHandle(token);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  let items: IncomingItem[];
  let addToRef: string;
  try {
    const body = await req.json();
    items = body.items;
    addToRef = String(body.addToRef ?? "").trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "Nothing selected" }, { status: 400 });
  if (!addToRef) return NextResponse.json({ error: "Missing order reference" }, { status: 400 });

  const db = getDb();
  const [order] = await db.select().from(orders).where(sql`upper(${orders.reference}) = ${addToRef}`).limit(1);
  if (!order || order.type !== "team_store" || order.teamId !== store.id) {
    return NextResponse.json({ error: "That order isn't part of this store." }, { status: 404 });
  }
  if (order.shippedAt) return NextResponse.json({ error: "This order already shipped, so items can't be added - it would need its own order." }, { status: 409 });

  const catalog = new Map((store.storeItems ?? []).map((i) => [i.key, i]));
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Price the NEW items exactly like the store checkout does.
  const fundPct = store.fundraisePercent ?? 0;
  let addOz = 0;
  let fundraiseTotal = 0;
  const lineItems: { quantity: number; price_data: { currency: string; unit_amount: number; product_data: { name: string } } }[] = [];
  for (const item of items) {
    const def = catalog.get(item.key);
    if (!def) continue;
    const qty = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    const size = def.sizes.includes(item.size ?? "") ? item.size : def.sizes[0];
    const details = [size];
    const chosenDesign = def.designs?.find((dz) => dz.label === item.design)?.label ?? def.designs?.[0]?.label;
    if (chosenDesign) details.unshift(chosenDesign);
    let unitCents = applyFundraise(def.priceCents, fundPct);
    fundraiseTotal += fundraisePortionCents(def.priceCents, fundPct) * qty;
    if (def.nameNumber) {
      const nm = (item.playerName ?? "").trim().slice(0, 30);
      const num = (item.playerNumber ?? "").trim().slice(0, 4);
      if (nm) details.push(nm.toUpperCase());
      if (num) details.push(`#${num}`);
    }
    if (def.numberAddOnCents && !def.nameNumber) {
      const num = (item.playerNumber ?? "").trim().replace(/[^0-9]/g, "").slice(0, 4);
      if (num) { details.push(`#${num} on back`); unitCents += def.numberAddOnCents; }
    }
    if (!def.nameNumber) {
      const nm = (item.playerName ?? "").trim().slice(0, 30);
      if (nm) details.push(`(for ${nm} - not printed)`);
    }
    addOz += def.weightOz * qty;
    lineItems.push({ quantity: qty, price_data: { currency: "usd", unit_amount: unitCents, product_data: { name: `${def.label} - ${details.join(" - ")}` } } });
  }
  if (lineItems.length === 0) return NextResponse.json({ error: "No valid items selected" }, { status: 400 });

  // Existing order weight, recomputed from its items against the store snapshot
  // (order_items don't store weight). Combined weight sets the new shipping.
  const existing = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const snap = store.storeItems ?? [];
  let existingOz = 0;
  for (const li of existing) {
    const def = snap.find((s) => li.name.startsWith(s.label));
    existingOz += (def?.weightOz ?? 10) * li.quantity;
  }
  const wasPickup = (order.shippingCents ?? 0) === 0 && !order.shippingAddress?.line1;
  const newShipping = wasPickup ? 0 : shippingCentsFor(existingOz + addOz);
  const shipDelta = Math.max(0, newShipping - (order.shippingCents ?? 0));

  if (shipDelta > 0) {
    lineItems.push({ quantity: 1, price_data: { currency: "usd", unit_amount: shipDelta, product_data: { name: "Shipping (added weight)" } } });
  }
  if (!store.taxExempt) {
    const goods = lineItems.reduce((s, li) => s + li.price_data.unit_amount * li.quantity, 0) - shipDelta;
    const tax = taxCents(goods);
    if (tax > 0) lineItems.push({ quantity: 1, price_data: { currency: "usd", unit_amount: tax, product_data: { name: SALES_TAX_LABEL } } });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems.map((li) => ({ quantity: li.quantity, price_data: { ...li.price_data, currency: "usd" as const } })),
      success_url: `${SITE}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/store/${token}?addTo=${addToRef}`,
      // Ships with the existing order to the address already on file - no new address.
      metadata: { orderType: "store_order_add", addToOrderId: order.id, teamId: store.id, teamName: store.name, newShippingCents: String(newShipping), ...(fundraiseTotal > 0 ? { fundraiseCents: String(fundraiseTotal) } : {}) },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("store add-checkout error:", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
