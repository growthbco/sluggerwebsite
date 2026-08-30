import { and, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, teamOrders } from "@/db/schema";
import { claimDeadlineFromDelivery, formatCustomerDate } from "@/lib/customer-policy";
import { emailOrderDelivered } from "@/lib/email";
import { getLiveTracking } from "@/lib/shippo";
import { smsIfConsented } from "@/lib/sms";
import { carrierFor } from "@/lib/tracking";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
const LOOKBACK_DAYS = 90;

type Parcel = { trackingNumber: string; carrier?: string | null };
type DeliveryResult = {
  kind: "team_order" | "order";
  reference: string;
  deliveredAt?: Date;
  noticeSent?: boolean;
  waitingOn?: string[];
};

function issueUrl(reference: string): string {
  const query = new URLSearchParams({ topic: "delivery", order: reference });
  return `${SITE}/contact?${query}`;
}

async function finalDeliveryTime(parcels: Parcel[]): Promise<{ deliveredAt?: Date; waitingOn: string[] }> {
  const scans = await Promise.all(parcels.map(async (parcel) => {
    const carrier = parcel.carrier || carrierFor(parcel.trackingNumber);
    const live = await getLiveTracking(carrier, parcel.trackingNumber);
    const at = live?.at ? new Date(live.at) : null;
    return {
      trackingNumber: parcel.trackingNumber,
      deliveredAt: live?.status === "Delivered" && at && !Number.isNaN(+at) ? at : null,
    };
  }));
  const waitingOn = scans.filter((scan) => !scan.deliveredAt).map((scan) => scan.trackingNumber);
  if (waitingOn.length) return { waitingOn };
  return {
    waitingOn: [],
    deliveredAt: new Date(Math.max(...scans.map((scan) => +scan.deliveredAt!))),
  };
}

async function notifyTeamOrder(row: typeof teamOrders.$inferSelect, deliveredAt: Date): Promise<boolean> {
  const db = getDb();
  const attempt = new Date();
  const [claimed] = await db
    .update(teamOrders)
    .set({ deliveryNoticeSentAt: attempt, updatedAt: attempt })
    .where(and(eq(teamOrders.id, row.id), isNull(teamOrders.deliveryNoticeSentAt)))
    .returning({ id: teamOrders.id });
  if (!claimed) return false;

  const deadline = claimDeadlineFromDelivery(deliveredAt);
  const deliveredDate = formatCustomerDate(deliveredAt);
  const reportByDate = formatCustomerDate(deadline);
  const reportUrl = issueUrl(row.reference);
  const [emailed, texted] = await Promise.all([
    row.contactEmail
      ? emailOrderDelivered({ to: row.contactEmail, name: row.contactName, reference: row.reference, deliveredDate, reportByDate, reportUrl })
      : Promise.resolve(false),
    smsIfConsented({
      phone: row.contactPhone,
      optInAt: row.smsOptInAt,
      body: `Slugger Athletics: ${row.reference} was delivered. Please inspect every item and report any problem by ${reportByDate}: ${reportUrl}\nReply STOP to opt out.`,
    }),
  ]);
  if (!emailed && !texted) {
    await db.update(teamOrders).set({ deliveryNoticeSentAt: null }).where(and(eq(teamOrders.id, row.id), eq(teamOrders.deliveryNoticeSentAt, attempt)));
  }
  return emailed || texted;
}

async function notifyOrder(row: typeof orders.$inferSelect, deliveredAt: Date): Promise<boolean> {
  const db = getDb();
  const attempt = new Date();
  const [claimed] = await db
    .update(orders)
    .set({ deliveryNoticeSentAt: attempt })
    .where(and(eq(orders.id, row.id), isNull(orders.deliveryNoticeSentAt)))
    .returning({ id: orders.id });
  if (!claimed) return false;

  const sent = row.customerEmail
    ? await emailOrderDelivered({
        to: row.customerEmail,
        name: row.customerName,
        reference: row.reference,
        deliveredDate: formatCustomerDate(deliveredAt),
        reportByDate: formatCustomerDate(claimDeadlineFromDelivery(deliveredAt)),
        reportUrl: issueUrl(row.reference),
      })
    : false;
  if (!sent) {
    await db.update(orders).set({ deliveryNoticeSentAt: null }).where(and(eq(orders.id, row.id), eq(orders.deliveryNoticeSentAt, attempt)));
  }
  return sent;
}

async function reconcileTeamOrder(row: typeof teamOrders.$inferSelect, dryRun: boolean): Promise<DeliveryResult> {
  let deliveredAt = row.deliveredAt;
  let waitingOn: string[] = [];
  if (!deliveredAt) {
    const parcels: Parcel[] = [
      ...(row.trackingNumber ? [{ trackingNumber: row.trackingNumber, carrier: row.shipCarrier }] : []),
      ...(row.additionalShipments ?? []).map((shipment) => ({ trackingNumber: shipment.trackingNumber, carrier: shipment.carrier })),
    ];
    if (!parcels.length) return { kind: "team_order", reference: row.reference, waitingOn: [] };
    const result = await finalDeliveryTime(parcels);
    deliveredAt = result.deliveredAt ?? null;
    waitingOn = result.waitingOn;
    if (deliveredAt && !dryRun) {
      const claimExpired = claimDeadlineFromDelivery(deliveredAt) < new Date();
      await getDb().update(teamOrders).set({ deliveredAt, ...(claimExpired ? { deliveryNoticeSentAt: new Date() } : {}), updatedAt: new Date() }).where(and(eq(teamOrders.id, row.id), isNull(teamOrders.deliveredAt)));
    }
  }
  const claimExpired = deliveredAt ? claimDeadlineFromDelivery(deliveredAt) < new Date() : false;
  if (deliveredAt && claimExpired && !row.deliveryNoticeSentAt && !dryRun) {
    await getDb().update(teamOrders).set({ deliveryNoticeSentAt: new Date(), updatedAt: new Date() }).where(and(eq(teamOrders.id, row.id), isNull(teamOrders.deliveryNoticeSentAt)));
  }
  const noticeSent = deliveredAt && !claimExpired && !row.deliveryNoticeSentAt && !dryRun ? await notifyTeamOrder(row, deliveredAt) : undefined;
  return { kind: "team_order", reference: row.reference, deliveredAt: deliveredAt ?? undefined, noticeSent, waitingOn };
}

async function reconcileOrder(row: typeof orders.$inferSelect, dryRun: boolean): Promise<DeliveryResult> {
  let deliveredAt = row.deliveredAt;
  let waitingOn: string[] = [];
  if (!deliveredAt) {
    const parcels: Parcel[] = [
      ...(row.trackingNumber ? [{ trackingNumber: row.trackingNumber, carrier: row.shipCarrier }] : []),
      ...(row.additionalShipments ?? []).map((shipment) => ({ trackingNumber: shipment.trackingNumber, carrier: shipment.carrier })),
    ];
    if (!parcels.length) return { kind: "order", reference: row.reference, waitingOn: [] };
    const result = await finalDeliveryTime(parcels);
    deliveredAt = result.deliveredAt ?? null;
    waitingOn = result.waitingOn;
    if (deliveredAt && !dryRun) {
      const claimExpired = claimDeadlineFromDelivery(deliveredAt) < new Date();
      await getDb().update(orders).set({ deliveredAt, ...(claimExpired ? { deliveryNoticeSentAt: new Date() } : {}) }).where(and(eq(orders.id, row.id), isNull(orders.deliveredAt)));
    }
  }
  const claimExpired = deliveredAt ? claimDeadlineFromDelivery(deliveredAt) < new Date() : false;
  if (deliveredAt && claimExpired && !row.deliveryNoticeSentAt && !dryRun) {
    await getDb().update(orders).set({ deliveryNoticeSentAt: new Date() }).where(and(eq(orders.id, row.id), isNull(orders.deliveryNoticeSentAt)));
  }
  const noticeSent = deliveredAt && !claimExpired && !row.deliveryNoticeSentAt && !dryRun ? await notifyOrder(row, deliveredAt) : undefined;
  return { kind: "order", reference: row.reference, deliveredAt: deliveredAt ?? undefined, noticeSent, waitingOn };
}

/** Reconcile recent outbound shipments. Passing a tracking number narrows the
 * work after a Shippo webhook; the webhook remains advisory because every
 * status is re-fetched from Shippo before the database changes. */
export async function syncOutstandingDeliveries(options: { dryRun?: boolean; trackingNumber?: string } = {}): Promise<DeliveryResult[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const tracking = options.trackingNumber?.trim();
  const teamTrackingFilter = tracking
    ? or(eq(teamOrders.trackingNumber, tracking), sql`${teamOrders.additionalShipments} @> ${JSON.stringify([{ trackingNumber: tracking }])}::jsonb`)
    : undefined;
  const orderTrackingFilter = tracking
    ? or(eq(orders.trackingNumber, tracking), sql`${orders.additionalShipments} @> ${JSON.stringify([{ trackingNumber: tracking }])}::jsonb`)
    : undefined;
  const [teamRows, shopRows] = await Promise.all([
    db.select().from(teamOrders).where(and(
      isNotNull(teamOrders.shippedAt),
      gt(teamOrders.shippedAt, cutoff),
      or(isNull(teamOrders.deliveredAt), isNull(teamOrders.deliveryNoticeSentAt)),
      teamTrackingFilter,
    )).limit(200),
    db.select().from(orders).where(and(
      isNotNull(orders.shippedAt),
      gt(orders.shippedAt, cutoff),
      or(isNull(orders.deliveredAt), isNull(orders.deliveryNoticeSentAt)),
      orderTrackingFilter,
    )).limit(200),
  ]);
  const results: DeliveryResult[] = [];
  for (const row of teamRows) results.push(await reconcileTeamOrder(row, Boolean(options.dryRun)));
  for (const row of shopRows) results.push(await reconcileOrder(row, Boolean(options.dryRun)));
  return results;
}
