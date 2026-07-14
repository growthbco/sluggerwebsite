import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: mark a team order as Ocala league-family (standard jerseys $25).
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; local?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamOrderId || typeof body.local !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // Locked once invoicing starts - the quote was already sent at a price.
  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.invoiceUrl) {
    return NextResponse.json({ error: "Invoice already sent - pricing is locked for this order." }, { status: 409 });
  }
  await db.update(teamOrders).set({ localPricing: body.local, updatedAt: new Date() }).where(eq(teamOrders.id, body.teamOrderId));
  return NextResponse.json({ ok: true });
}
