import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrders } from "@/db/schema";

type Order = typeof teamOrders.$inferSelect;

/** Self-service is limited to uninvoiced drafts. Never reprice an existing
 * payment link or override a staff-arranged production timeline. */
export function customerServiceLocked(order: Order) {
  return !["draft", "collecting"].includes(order.status)
    || Boolean(order.depositPaidAt || order.invoicePaidAt || order.shippedAt || order.deliveredAt
      || order.invoiceUrl || order.fullInvoiceUrl || order.balanceInvoiceUrl
      || order.timelineStartAt || order.promisedInHandAt)
    || order.quotedTotalCents !== null
    || order.turnaroundTier === "priority" || order.priorityFeeCents > 0;
}

export async function saveCustomerProductionService(order: Order, rush: boolean, updatedAt: string) {
  if (customerServiceLocked(order) || updatedAt !== order.updatedAt.toISOString()) return false;
  const [saved] = await getDb().update(teamOrders).set({
    rushShipping: rush, turnaroundTier: rush ? "rush" : "standard",
    shippingChargedCents: null, specSnapshot: null, specConfirmedAt: null,
    deliveryTermsAcceptedAt: null, updatedAt: new Date(),
  }).where(and(
    eq(teamOrders.id, order.id),
    inArray(teamOrders.status, ["draft", "collecting"]),
    isNull(teamOrders.depositPaidAt), isNull(teamOrders.invoicePaidAt),
    isNull(teamOrders.invoiceUrl), isNull(teamOrders.fullInvoiceUrl), isNull(teamOrders.balanceInvoiceUrl),
    isNull(teamOrders.quotedTotalCents), isNull(teamOrders.timelineStartAt), isNull(teamOrders.promisedInHandAt),
    isNull(teamOrders.shippedAt), isNull(teamOrders.deliveredAt),
    eq(teamOrders.priorityFeeCents, 0),
    sql`coalesce(${teamOrders.turnaroundTier}, 'standard') <> 'priority'`,
    sql`date_trunc('milliseconds', ${teamOrders.updatedAt}) = ${updatedAt}::timestamptz`,
  )).returning({ id: teamOrders.id });
  return Boolean(saved);
}
