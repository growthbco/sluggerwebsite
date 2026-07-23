import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: mark a team order as local pickup (no shipping anywhere).
// Changeable until the balance invoice goes out - that's when shipping is
// actually charged.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; pickup?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamOrderId || typeof body.pickup !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.balanceInvoiceUrl || order.invoicePaidAt) {
    return NextResponse.json({ error: "The final invoice already went out - shipping is locked for this order." }, { status: 409 });
  }
  await db.update(teamOrders).set({ localPickup: body.pickup, updatedAt: new Date() }).where(eq(teamOrders.id, body.teamOrderId));
  return NextResponse.json({ ok: true });
}
