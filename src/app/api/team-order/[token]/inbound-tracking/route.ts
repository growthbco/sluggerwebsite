import { NextResponse } from "next/server";
import { and, isNull, ne, inArray } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getById, getByManageToken, saveInboundTracking, ensureTeamOrderDiscordThread } from "@/lib/team-orders";
import { INBOUND_CARRIERS, inboundTrackingUrlFor } from "@/lib/tracking";
import { emailInboundShipment } from "@/lib/email";
import { postDesignThreadUpdate } from "@/lib/discord";
import { requireApiRole } from "@/lib/admin-auth";
import { markShipped } from "@/lib/fulfillment";

export const runtime = "nodejs";

// Other orders that could be riding in the same factory box: in production or
// paid, not shipped, no inbound tracking yet, not archived.
async function boxmateCandidates(excludeId: string) {
  const db = getDb();
  return db
    .select({ id: teamOrders.id, reference: teamOrders.reference, teamName: teamOrders.teamName, status: teamOrders.status })
    .from(teamOrders)
    .where(
      and(
        ne(teamOrders.id, excludeId),
        inArray(teamOrders.status, ["in_production", "paid"]),
        isNull(teamOrders.shippedAt),
        isNull(teamOrders.inboundTrackingNumber),
        isNull(teamOrders.archivedAt),
      ),
    );
}

// The checklist of possible boxmates for the designer's tracking form.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const gate = await requireApiRole("production");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = (await getById(token)) ?? (await getByManageToken(token));
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const candidates = await boxmateCandidates(order.id);
  return NextResponse.json({ candidates });
}

// A signed-in designer or staff member records either an internal
// factory-to-Slugger shipment or a final direct-to-customer shipment. The
// private order token identifies the record; the admin session authorizes it.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const gate = await requireApiRole("production");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;

  const order = (await getById(token)) ?? (await getByManageToken(token));
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: {
    trackingNumber?: string;
    carrier?: string;
    destination?: "slugger" | "customer";
    directConfirmed?: boolean;
    notify?: boolean;
    alsoOrderIds?: string[];
  } = {};
  try { body = await req.json(); } catch {}
  // notify:false = staff entered it from the admin side; no point emailing
  // the shop about its own action. The Discord log still posts (no ping).
  const notify = body.notify !== false;

  const trackingNumber = (body.trackingNumber ?? "").trim();
  const carrier = (INBOUND_CARRIERS as readonly string[]).includes(body.carrier ?? "")
    ? body.carrier!
    : "Other";
  if (!trackingNumber || trackingNumber.length > 60) {
    return NextResponse.json({ error: "Enter a tracking number." }, { status: 400 });
  }

  if (body.destination !== "slugger" && body.destination !== "customer") {
    return NextResponse.json({ error: "Choose whether this package is going to Slugger or directly to the customer." }, { status: 400 });
  }
  const destination = body.destination;

  if (destination === "customer") {
    if (body.directConfirmed !== true) {
      return NextResponse.json({ error: "Confirm that this package is going directly to the customer." }, { status: 400 });
    }
    if (order.status === "cancelled" || order.archivedAt) {
      return NextResponse.json({ error: "A cancelled or archived order cannot be marked as shipped." }, { status: 409 });
    }
    if (!order.invoicePaidAt) {
      return NextResponse.json({ error: "The final balance must be recorded before a direct shipment can be released to the customer." }, { status: 409 });
    }
    if (order.shippedAt) {
      if (order.trackingNumber === trackingNumber) {
        return NextResponse.json({
          ok: true,
          destination,
          trackingNumber,
          carrier: order.shipCarrier ?? carrier,
          trackingUrl: inboundTrackingUrlFor(trackingNumber, order.shipCarrier ?? carrier),
          alreadySaved: true,
          applied: 1,
        });
      }
      return NextResponse.json({ error: "This order is already marked shipped with different tracking. Ask Slugger staff to correct it." }, { status: 409 });
    }

    const result = await markShipped("team_order", order.id, trackingNumber, undefined, {
      directFromProduction: true,
      carrier,
    });
    if (!result) return NextResponse.json({ error: "Could not mark the order shipped." }, { status: 500 });

    return NextResponse.json({
      ok: true,
      destination,
      trackingNumber,
      carrier,
      trackingUrl: inboundTrackingUrlFor(trackingNumber, carrier),
      customerNotified: result.emailed,
      warning: result.emailed ? undefined : "Tracking was saved, but the customer email could not be sent. Ask Slugger staff to notify the customer manually.",
      applied: 1,
    });
  }

  await saveInboundTracking(order.id, trackingNumber, carrier);
  const trackingUrl = inboundTrackingUrlFor(trackingNumber, carrier);

  // The designer marked other orders as riding in the SAME box: apply the
  // same tracking to each (validated against the open-candidate set so a
  // stale/shipped order can't be tagged by accident).
  const alsoIds = (Array.isArray(body.alsoOrderIds) ? body.alsoOrderIds : []).filter((x) => typeof x === "string").slice(0, 25);
  const boxmates: { id: string; reference: string; teamName: string }[] = [];
  if (alsoIds.length) {
    const candidates = await boxmateCandidates(order.id);
    const valid = candidates.filter((c) => alsoIds.includes(c.id));
    for (const c of valid) {
      await saveInboundTracking(c.id, trackingNumber, carrier);
      boxmates.push(c);
    }
  }

  const allRefs = [`${order.teamName} (${order.reference})`, ...boxmates.map((b) => `${b.teamName} (${b.reference})`)];

  // Notify the shop (email + each design's Discord thread). Non-fatal: the
  // tracking is saved either way and visible on the admin page.
  if (notify) {
    await emailInboundShipment({
      reference: [order.reference, ...boxmates.map((b) => b.reference)].join(", "),
      teamName: allRefs.length > 1 ? `${allRefs.length} orders in one box: ${allRefs.join(" + ")}` : order.teamName,
      carrier,
      trackingNumber,
      trackingUrl,
    });
  }
  const boxNote = allRefs.length > 1 ? `\nThis box also contains: ${allRefs.join(", ")}.` : "";
  for (const target of [order, ...boxmates]) {
    await postDesignThreadUpdate({
      threadId: (await ensureTeamOrderDiscordThread(target.id)) ?? undefined,
      title: `📦 Inbound shipment - ${target.teamName} (${target.reference})`,
      description: `Production order is on the way to the shop.\n[${carrier} ${trackingNumber}](${trackingUrl})${boxNote}`,
      mention: notify,
    });
  }

  return NextResponse.json({ ok: true, destination, trackingNumber, carrier, trackingUrl, applied: 1 + boxmates.length });
}
