import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: archive (with a note like "lost") or unarchive a team order.
// Nothing is deleted - archived orders live in their own dashboard section.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; archive?: boolean; note?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamOrderId || typeof body.archive !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .update(teamOrders)
    .set(
      body.archive
        ? { archivedAt: new Date(), archivedNote: (body.note ?? "").trim().slice(0, 200) || null }
        : { archivedAt: null, archivedNote: null },
    )
    .where(eq(teamOrders.id, body.teamOrderId))
    .returning({ id: teamOrders.id });
  if (!row) return NextResponse.json({ error: "Team order not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
