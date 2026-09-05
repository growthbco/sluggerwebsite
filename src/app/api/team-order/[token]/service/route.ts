import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { customerServiceLocked, saveCustomerProductionService } from "@/lib/customer-production-service";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Ordering is unavailable." }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || !["standard", "rush"].includes(body.service) || typeof body.updatedAt !== "string") {
    return NextResponse.json({ error: "Choose Standard or Rush from the current order page." }, { status: 400 });
  }
  if (customerServiceLocked(order)) {
    return NextResponse.json({ error: "This order is submitted, invoiced, paid, or has a staff-arranged timeline. Contact Slugger to review a rush upgrade." }, { status: 409 });
  }
  const rush = body.service === "rush";
  try {
    if (!(await saveCustomerProductionService(order, rush, body.updatedAt))) {
      return NextResponse.json({ error: "Your order changed. Refresh the page before changing production speed." }, { status: 409 });
    }
    const quote = computeTeamOrderQuote({ ...order, rushShipping: rush }, await getRoster(order.id));
    return NextResponse.json({ ok: true, rushFeeCents: quote.rushFeeCents, totalCents: quote.totalCents });
  } catch (error) {
    console.error("Could not save customer production speed", error);
    return NextResponse.json({ error: "Could not confirm the change. Refresh to check your order." }, { status: 500 });
  }
}
