import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: set (or clear) an owner-negotiated per-jersey price for one
// order. Wins over standard/Ocala pricing. Locked once invoicing starts.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; jerseyCents?: number | null } = {};
  try { body = await req.json(); } catch {}
  if (!body.teamOrderId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const cents =
    body.jerseyCents == null ? null : Math.round(Number(body.jerseyCents));
  if (cents !== null && (!Number.isFinite(cents) || cents < 100 || cents > 20000)) {
    return NextResponse.json({ error: "Enter a price between $1 and $200." }, { status: 400 });
  }

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.invoiceUrl) {
    return NextResponse.json({ error: "Invoice already sent - pricing is locked for this order." }, { status: 409 });
  }
  await db.update(teamOrders).set({ customJerseyCents: cents, updatedAt: new Date() }).where(eq(teamOrders.id, body.teamOrderId));
  return NextResponse.json({ ok: true, jerseyCents: cents });
}
