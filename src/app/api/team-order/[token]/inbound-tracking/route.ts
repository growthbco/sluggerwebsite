import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, saveInboundTracking } from "@/lib/team-orders";
import { getById as getDesignById } from "@/lib/design-requests";
import { INBOUND_CARRIERS, inboundTrackingUrlFor } from "@/lib/tracking";
import { emailInboundShipment } from "@/lib/email";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

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

  let body: { trackingNumber?: string; carrier?: string; notify?: boolean } = {};
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

  // Notify the shop (email + the design's Discord thread). Non-fatal: the
  // tracking is saved either way and visible on the admin page.
  if (notify) {
    await emailInboundShipment({
      reference: order.reference,
      teamName: order.teamName,
      carrier,
      trackingNumber,
      trackingUrl,
    });
  }
  if (order.designRequestId) {
    const design = await getDesignById(order.designRequestId);
    await postDesignThreadUpdate({
      threadId: design?.discordThreadId,
      title: `📦 Inbound shipment - ${order.teamName} (${order.reference})`,
      description: `Production order is on the way to the shop.\n[${carrier} ${trackingNumber}](${trackingUrl})`,
      mention: notify,
    });
  }

  return NextResponse.json({ ok: true, trackingNumber, carrier, trackingUrl });
}
