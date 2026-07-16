import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: mark a team order tax-exempt (companies/orgs with a cert).
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; exempt?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamOrderId || typeof body.exempt !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.invoiceUrl) {
    return NextResponse.json({ error: "Invoice already sent - re-send it after changing tax status." }, { status: 409 });
  }
  await db.update(teamOrders).set({ taxExempt: body.exempt, updatedAt: new Date() }).where(eq(teamOrders.id, body.teamOrderId));
  return NextResponse.json({ ok: true });
}
