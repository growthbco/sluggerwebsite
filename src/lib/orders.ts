// Persists paid Stripe shop / buy-in / team-store orders. The Stripe webhook
// is the single writer; dedupe rides on the unique index over
// stripe_checkout_session_id so webhook retries can't double-insert.

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
