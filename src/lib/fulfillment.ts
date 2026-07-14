// Shared "mark shipped" logic: set tracking + status and email the customer.
// Used by the manual Mark-shipped button and the Shippo Buy-label flow.

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrders, orders, designRequests } from "@/db/schema";
import { emailOrderShipped } from "@/lib/email";
import { archiveDiscordThread } from "@/lib/discord-bot";

export function trackingUrlFor(num: string): string {
  const n = num.replace(/\s/g, "");
  if (/^1Z/i.test(n)) return `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`;
}

export async function markShipped(
  kind: "team_order" | "order",
  id: string,
  trackingNumber: string,
  labelUrl?: string,
): Promise<{ reference: string; emailed: boolean } | null> {
  const db = getDb();
  const now = new Date();

  if (kind === "team_order") {
    const [row] = await db
      .update(teamOrders)
      .set({ status: "shipped", trackingNumber, labelUrl, shippedAt: now, updatedAt: now })
      .where(eq(teamOrders.id, id))
      .returning({
        reference: teamOrders.reference,
        email: teamOrders.contactEmail,
        name: teamOrders.contactName,
        designRequestId: teamOrders.designRequestId,
      });
    if (!row) return null;
    const emailed = await emailOrderShipped({
      to: row.email,
      name: row.name,
      reference: row.reference,
      trackingNumber,
      trackingUrl: trackingUrlFor(trackingNumber),
    });
    // Shipped = this project's Discord thread is done; archive it (no-op
    // without a bot token).
    if (row.designRequestId) {
      const [d] = await db
        .select({ threadId: designRequests.discordThreadId })
        .from(designRequests)
        .where(eq(designRequests.id, row.designRequestId))
        .limit(1);
      await archiveDiscordThread(d?.threadId);
    }
    return { reference: row.reference, emailed };
  }

  const [row] = await db
    .update(orders)
    .set({ status: "fulfilled", trackingNumber, labelUrl, shippedAt: now })
    .where(eq(orders.id, id))
    .returning({ reference: orders.reference, email: orders.customerEmail, name: orders.customerName });
  if (!row) return null;
  const emailed = row.email
    ? await emailOrderShipped({
        to: row.email,
        name: row.name,
        reference: row.reference,
        trackingNumber,
        trackingUrl: trackingUrlFor(trackingNumber),
      })
    : false;
  return { reference: row.reference, emailed };
}
