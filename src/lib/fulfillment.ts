// Fulfillment: two deliberate, separate steps.
//   saveLabelPurchase - a label was bought (tracking + PDF on file). Does NOT
//                       ship or email; buying a label just gets it out of the way.
//   markShipped       - the box actually went out: flip status + email the
//                       customer. Reuses tracking already on file (from a bought
//                       label) or takes a manually entered number.

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrders, orders, designRequests } from "@/db/schema";
import { emailOrderShipped, emailAdditionalShipment } from "@/lib/email";
import { sendFollowUpSms } from "@/lib/sms";
import { archiveDiscordThread } from "@/lib/discord-bot";
import { trackingUrlFor } from "@/lib/tracking";

export { trackingUrlFor };

/** Record a purchased label (tracking + PDF) without shipping or emailing.
 *  Buying the label ahead of time is fine; the customer hears nothing yet. */
export async function saveLabelPurchase(
  kind: "team_order" | "order",
  id: string,
  trackingNumber: string,
  labelUrl: string,
  transactionId?: string,
): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  if (kind === "team_order") {
    const [row] = await db
      .update(teamOrders)
      .set({ trackingNumber, labelUrl, shipTransactionId: transactionId ?? null, updatedAt: now })
      .where(eq(teamOrders.id, id))
      .returning({ id: teamOrders.id });
    return Boolean(row);
  }
  const [row] = await db
    .update(orders)
    .set({ trackingNumber, labelUrl, shipTransactionId: transactionId ?? null })
    .where(eq(orders.id, id))
    .returning({ id: orders.id });
  return Boolean(row);
}

/** Append an ADDITIONAL parcel (second box, reship, hats going separately) to
 *  an order that already has a primary label, and email the customer this
 *  tracking immediately - this box is going out now. Returns whether the
 *  email sent. */
export async function appendAdditionalShipment(
  kind: "team_order" | "order",
  id: string,
  trackingNumber: string,
  labelUrl: string,
  note?: string,
  transactionId?: string,
): Promise<boolean> {
  const db = getDb();
  const entry = { trackingNumber, labelUrl, transactionId, at: new Date().toISOString() };
  let email: string | null = null;
  let name: string | null = null;
  let reference = "";
  if (kind === "team_order") {
    const [row] = await db.select().from(teamOrders).where(eq(teamOrders.id, id)).limit(1);
    if (!row) return false;
    await db
      .update(teamOrders)
      .set({ additionalShipments: [...(row.additionalShipments ?? []), entry], updatedAt: new Date() })
      .where(eq(teamOrders.id, id));
    email = row.contactEmail; name = row.contactName; reference = row.reference;
  } else {
    const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!row) return false;
    await db
      .update(orders)
      .set({ additionalShipments: [...(row.additionalShipments ?? []), entry] })
      .where(eq(orders.id, id));
    email = row.customerEmail; name = row.customerName; reference = row.reference;
  }
  if (!email) return false;
  return emailAdditionalShipment({ to: email, name, reference, trackingNumber, trackingUrl: trackingUrlFor(trackingNumber), note });
}

export async function markShipped(
  kind: "team_order" | "order",
  id: string,
  trackingNumber?: string,
  labelUrl?: string,
): Promise<{ reference: string; emailed: boolean } | null> {
  const db = getDb();
  const now = new Date();

  if (kind === "team_order") {
    const [existing] = await db
      .select({ tracking: teamOrders.trackingNumber, label: teamOrders.labelUrl })
      .from(teamOrders)
      .where(eq(teamOrders.id, id))
      .limit(1);
    const tracking = (trackingNumber ?? existing?.tracking ?? "").trim();
    if (!tracking) return null;
    const [row] = await db
      .update(teamOrders)
      .set({ status: "shipped", trackingNumber: tracking, labelUrl: labelUrl ?? existing?.label ?? null, shippedAt: now, updatedAt: now })
      .where(eq(teamOrders.id, id))
      .returning({
        reference: teamOrders.reference,
        email: teamOrders.contactEmail,
        name: teamOrders.contactName,
        phone: teamOrders.contactPhone,
        smsOptInAt: teamOrders.smsOptInAt,
        designRequestId: teamOrders.designRequestId,
      });
    if (!row) return null;
    await sendFollowUpSms({
      phone: row.phone,
      body: `Slugger Athletics: your ${row.reference} order shipped! 🚚 Track it: ${trackingUrlFor(tracking)}\nReply STOP to opt out.`,
    });
    const emailed = await emailOrderShipped({
      to: row.email,
      name: row.name,
      reference: row.reference,
      trackingNumber: tracking,
      trackingUrl: trackingUrlFor(tracking),
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

  const [existing] = await db
    .select({ tracking: orders.trackingNumber, label: orders.labelUrl })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  const tracking = (trackingNumber ?? existing?.tracking ?? "").trim();
  if (!tracking) return null;
  const [row] = await db
    .update(orders)
    .set({ status: "fulfilled", trackingNumber: tracking, labelUrl: labelUrl ?? existing?.label ?? null, shippedAt: now })
    .where(eq(orders.id, id))
    .returning({ reference: orders.reference, email: orders.customerEmail, name: orders.customerName, phone: orders.customerPhone });
  if (!row) return null;
  await sendFollowUpSms({
    phone: row.phone,
    body: `Slugger Athletics: your ${row.reference} order shipped! 🚚 Track it: ${trackingUrlFor(tracking)}\nReply STOP to opt out.`,
  });
  const emailed = row.email
    ? await emailOrderShipped({
        to: row.email,
        name: row.name,
        reference: row.reference,
        trackingNumber: tracking,
        trackingUrl: trackingUrlFor(tracking),
      })
    : false;
  return { reference: row.reference, emailed };
}
