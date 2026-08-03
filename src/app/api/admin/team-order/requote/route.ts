import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";

export const runtime = "nodejs";

// Admin-only: re-lock the quoted total from the CURRENT roster. Used when the
// roster changed after an invoice locked the quote (added jerseys), so the
// next invoice charges the right amount. The paid deposit is untouched - only
// the total (and therefore the remaining balance) moves.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.teamOrderId) return NextResponse.json({ error: "Missing order" }, { status: 400 });

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.invoicePaidAt) {
    return NextResponse.json({ error: "Already paid in full - use the add-on flow for new pieces." }, { status: 409 });
  }

  const roster = await getRoster(order.id);
  if (!roster.length) return NextResponse.json({ error: "Roster is empty." }, { status: 400 });
  const quote = computeTeamOrderQuote(order, roster);
  if (quote.totalCents <= 0) return NextResponse.json({ error: "Could not price the roster." }, { status: 400 });

  await db
    .update(teamOrders)
    .set({ quotedTotalCents: quote.totalCents, updatedAt: new Date() })
    .where(eq(teamOrders.id, order.id));

  return NextResponse.json({ ok: true, quotedTotalCents: quote.totalCents });
}
