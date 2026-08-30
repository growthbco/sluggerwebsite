import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

// Capture the paid white-label decision at the design stage, before approval
// auto-creates a team order. If an unpaid order already exists, keep it in sync.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { designRequestId?: string; whiteLabel?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.designRequestId || typeof body.whiteLabel !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = getDb();
  const [design] = await db.select().from(designRequests).where(eq(designRequests.id, body.designRequestId)).limit(1);
  if (!design) return NextResponse.json({ error: "Design request not found" }, { status: 404 });

  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.designRequestId, design.id)).limit(1);
  if (order && (order.invoiceUrl || order.depositPaidAt || order.invoicePaidAt)) {
    return NextResponse.json({ error: "Pricing is already locked. Update and reissue the invoice from the linked team order." }, { status: 409 });
  }

  if (design.whiteLabel === body.whiteLabel && (!order || order.whiteLabel === body.whiteLabel)) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  await Promise.all([
    db.update(designRequests).set({ whiteLabel: body.whiteLabel, updatedAt: new Date() }).where(eq(designRequests.id, design.id)),
    order
      ? db.update(teamOrders).set({ whiteLabel: body.whiteLabel, updatedAt: new Date() }).where(eq(teamOrders.id, order.id))
      : Promise.resolve(),
  ]);

  await postDesignThreadUpdate({
    threadId: design.discordThreadId ?? undefined,
    title: `${body.whiteLabel ? "⚠️ White-label confirmed" : "White-label removed"} - ${design.teamName} (${design.reference})`,
    description: body.whiteLabel
      ? "Customer accepted the $2.50-per-piece white-label upgrade ($50 minimum). Remove every Slugger mark from production: SA back logo, branded neck label, and branded lower-front size/barcode tag. The final charge will be calculated from the submitted roster."
      : "White-label is no longer enabled. Use the standard Slugger branding unless a newer customer instruction says otherwise.",
    username: "Slugger Design Requests",
  });

  return NextResponse.json({ ok: true });
}
