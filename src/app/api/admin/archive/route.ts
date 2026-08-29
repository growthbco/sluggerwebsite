import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, designRequests, orders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { archiveDiscordThread } from "@/lib/discord-bot";

export const runtime = "nodejs";

// Admin-only: archive (with a follow-up note) or restore a team order or a
// design request. Nothing is deleted - archived records live in their own
// dashboard sections, and archived designs stop getting auto follow-ups.
export async function POST(req: Request) {
  const gate = await requireApiRole("customer");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { kind?: string; id?: string; archive?: boolean; note?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.id || typeof body.archive !== "boolean" || !["team_order", "design_request", "order"].includes(body.kind ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const values = body.archive
    ? { archivedAt: new Date(), archivedNote: (body.note ?? "").trim().slice(0, 200) || null }
    : { archivedAt: null, archivedNote: null };

  const db = getDb();
  const table = body.kind === "team_order" ? teamOrders : body.kind === "order" ? orders : designRequests;
  const [row] = await db.update(table).set(values).where(eq(table.id, body.id)).returning({ id: table.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Archiving a design also archives its Discord thread (bot token required;
  // no-ops silently without one). Restoring doesn't unarchive - posting into
  // the thread un-archives it automatically on Discord's side.
  if (body.archive && body.kind === "design_request") {
    const [d] = await db
      .select({ threadId: designRequests.discordThreadId })
      .from(designRequests)
      .where(eq(designRequests.id, body.id))
      .limit(1);
    await archiveDiscordThread(d?.threadId);
  }
  return NextResponse.json({ ok: true });
}
