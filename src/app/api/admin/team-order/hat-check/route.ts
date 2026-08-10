import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: check/uncheck one production stage for one physical hat on the
// hat-sheet page. Merged into teamOrders.hatChecklist so progress is shared
// across staff and survives reloads.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; key?: string; stage?: string; on?: boolean } = {};
  try { body = await req.json(); } catch {}
  const stage = body.stage as "s" | "c" | "b";
  if (!body.teamOrderId || !body.key || !["s", "c", "b"].includes(stage) || typeof body.on !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = getDb();
  const [order] = await db
    .select({ id: teamOrders.id, hatChecklist: teamOrders.hatChecklist })
    .from(teamOrders)
    .where(eq(teamOrders.id, body.teamOrderId))
    .limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const checklist = { ...(order.hatChecklist ?? {}) };
  checklist[body.key] = { ...checklist[body.key], [stage]: body.on };
  await db.update(teamOrders).set({ hatChecklist: checklist, updatedAt: new Date() }).where(eq(teamOrders.id, order.id));
  return NextResponse.json({ ok: true });
}
