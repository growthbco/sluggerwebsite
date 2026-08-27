import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: record the ACTUAL amount paid to the designer/factory for this
// order (COGS), so per-order margin is real, not estimated. Pass cents; null
// (or a blank body value) clears it back to the estimate.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; cents?: number | null } = {};
  try { body = await req.json(); } catch {}
  if (!body.teamOrderId) return NextResponse.json({ error: "Missing order" }, { status: 400 });
  const cents =
    body.cents === null || body.cents === undefined || Number.isNaN(Number(body.cents))
      ? null
      : Math.max(0, Math.round(Number(body.cents)));

  const db = getDb();
  const [row] = await db
    .update(teamOrders)
    .set({ designerCostCents: cents, updatedAt: new Date() })
    .where(eq(teamOrders.id, body.teamOrderId))
    .returning({ id: teamOrders.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
