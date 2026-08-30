import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: toggle the flat $100 two-week rush order fee.
// automatically when the order comes from a rush design request; staff can
// remove it if the rush is declined, or add it to any order.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; rush?: boolean } = {};
  try { body = await req.json(); } catch {}
  if (!body.teamOrderId || typeof body.rush !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.invoiceUrl) {
    return NextResponse.json({ error: "Invoice already sent - pricing is locked for this order." }, { status: 409 });
  }
  await db.update(teamOrders).set({ rushShipping: body.rush, updatedAt: new Date() }).where(eq(teamOrders.id, body.teamOrderId));
  return NextResponse.json({ ok: true });
}
