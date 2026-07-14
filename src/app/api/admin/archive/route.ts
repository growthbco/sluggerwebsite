import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, designRequests } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: archive (with a follow-up note) or restore a team order or a
// design request. Nothing is deleted - archived records live in their own
// dashboard sections, and archived designs stop getting auto follow-ups.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { kind?: string; id?: string; archive?: boolean; note?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.id || typeof body.archive !== "boolean" || !["team_order", "design_request"].includes(body.kind ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const values = body.archive
    ? { archivedAt: new Date(), archivedNote: (body.note ?? "").trim().slice(0, 200) || null }
    : { archivedAt: null, archivedNote: null };

  const db = getDb();
  const table = body.kind === "team_order" ? teamOrders : designRequests;
  const [row] = await db.update(table).set(values).where(eq(table.id, body.id)).returning({ id: table.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
