// Persists paid Stripe shop / buy-in / team-store orders. The Stripe webhook
// is the single writer; dedupe rides on the unique index over
// stripe_checkout_session_id so webhook retries can't double-insert.

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";

export type PaidOrderLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export async function persistPaidOrder(args: {
  reference: string;
  type: "shop" | "buy_in" | "team_store";
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string;
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  teamId?: string;
  customerNote?: string;
  fundraiseCents?: number;
  lines: PaidOrderLine[];
}): Promise<{ inserted: boolean }> {
  const db = getDb();
  const [row] = await db
    .insert(orders)
    .values({
      reference: args.reference,
      type: args.type,
      status: "paid",
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      shippingAddress: args.shippingAddress,
      subtotalCents: args.subtotalCents,
      shippingCents: args.shippingCents,
      totalCents: args.totalCents,
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      teamId: args.teamId,
      customerNote: args.customerNote,
      fundraiseCents: args.fundraiseCents ?? 0,
      discordNotifiedAt: new Date(),
    })
    .onConflictDoNothing({ target: orders.stripeCheckoutSessionId })
    .returning({ id: orders.id });

  // No row back means the session was already recorded (Stripe retry).
  if (!row) return { inserted: false };

  if (args.lines.length) {
    await db.insert(orderItems).values(
      args.lines.map((l) => ({
        orderId: row.id,
        name: l.name,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
      })),
    );
  }
  return { inserted: true };
}

/** Merge a paid "add to my order" top-up into an existing store order: append
 *  the new line items and roll up the totals + new shipping. Idempotent -
 *  the Stripe session id is recorded so a webhook retry can't double-append. */
export async function mergeStoreOrderAdd(args: {
  orderId: string;
  sessionId: string;
  newShippingCents: number;
  paidTotalCents: number;
  lines: PaidOrderLine[];
}): Promise<{ merged: boolean; teamId: string | null; reference: string; addedLines: PaidOrderLine[] }> {
  const db = getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, args.orderId)).limit(1);
  if (!o) return { merged: false, teamId: null, reference: "", addedLines: [] };
  const done = o.addSessionIds ?? [];
  if (done.includes(args.sessionId)) return { merged: false, teamId: o.teamId, reference: o.reference, addedLines: [] };

  if (args.lines.length) {
    await db.insert(orderItems).values(
      args.lines.map((l) => ({ orderId: o.id, name: l.name, quantity: l.quantity, unitPriceCents: l.unitPriceCents })),
    );
  }
  const addGoods = args.lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  await db
    .update(orders)
    .set({
      subtotalCents: (o.subtotalCents ?? 0) + addGoods,
      shippingCents: args.newShippingCents,
      totalCents: (o.totalCents ?? 0) + args.paidTotalCents,
      addSessionIds: [...done, args.sessionId],
    })
    .where(eq(orders.id, o.id));
  return { merged: true, teamId: o.teamId, reference: o.reference, addedLines: args.lines };
}
