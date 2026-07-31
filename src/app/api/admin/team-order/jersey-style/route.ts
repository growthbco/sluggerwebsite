import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { JERSEY_STYLES } from "@/lib/team-order-pricing";

export const runtime = "nodejs";

// Admin-only: change a team order's jersey style (which drives the jersey
// price). Locked once an invoice has been sent.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; jerseyStyle?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamOrderId || !body.jerseyStyle || !(JERSEY_STYLES as readonly string[]).includes(body.jerseyStyle)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.invoiceUrl) {
    return NextResponse.json({ error: "Invoice already sent - style/pricing is locked for this order." }, { status: 409 });
  }
  await db.update(teamOrders).set({ jerseyStyle: body.jerseyStyle, updatedAt: new Date() }).where(eq(teamOrders.id, body.teamOrderId));
  return NextResponse.json({ ok: true });
}
