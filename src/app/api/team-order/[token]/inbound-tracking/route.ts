import { NextResponse } from "next/server";
import { and, eq, isNull, ne, inArray } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getByManageToken, saveInboundTracking } from "@/lib/team-orders";
import { getById as getDesignById } from "@/lib/design-requests";
import { INBOUND_CARRIERS, inboundTrackingUrlFor } from "@/lib/tracking";
import { emailInboundShipment } from "@/lib/email";
import { postDesignThreadUpdate } from "@/lib/discord";

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
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const candidates = await boxmateCandidates(order.id);
  return NextResponse.json({ candidates });
}

// Designer logs the factory -> Slugger shipment. Auth: the team-order manage
// token, same as verify-print-file - the designer reaches the form from the
// staff-only Discord thread. The customer-facing pages never render this data.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;

  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { trackingNumber?: string; carrier?: string; notify?: boolean; alsoOrderIds?: string[] } = {};
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

  await saveInboundTracking(order.id, trackingNumber, carrier);
  const trackingUrl = inboundTrackingUrlFor(trackingNumber, carrier);

  // The designer marked other orders as riding in the SAME box: apply the
  // same tracking to each (validated against the open-candidate set so a
  // stale/shipped order can't be tagged by accident).
  const alsoIds = (Array.isArray(body.alsoOrderIds) ? body.alsoOrderIds : []).filter((x) => typeof x === "string").slice(0, 25);
  const boxmates: { id: string; reference: string; teamName: string; designRequestId?: string | null }[] = [];
  if (alsoIds.length) {
    const candidates = await boxmateCandidates(order.id);
    const valid = candidates.filter((c) => alsoIds.includes(c.id));
    for (const c of valid) {
      await saveInboundTracking(c.id, trackingNumber, carrier);
      const [full] = await getDb().select({ designRequestId: teamOrders.designRequestId }).from(teamOrders).where(eq(teamOrders.id, c.id)).limit(1);
      boxmates.push({ ...c, designRequestId: full?.designRequestId });
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
    if (!target.designRequestId) continue;
    const design = await getDesignById(target.designRequestId);
    await postDesignThreadUpdate({
      threadId: design?.discordThreadId,
      title: `📦 Inbound shipment - ${target.teamName} (${target.reference})`,
      description: `Production order is on the way to the shop.\n[${carrier} ${trackingNumber}](${trackingUrl})${boxNote}`,
      mention: notify,
    });
  }

  return NextResponse.json({ ok: true, trackingNumber, carrier, trackingUrl, applied: 1 + boxmates.length });
}
