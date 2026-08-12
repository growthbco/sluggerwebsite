import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designLabVisitors, designLabRenders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Delete Design Lab leads (and their saved concepts) - for clearing out test
// runs and junk. Money-gated so designers can't wipe leads.
//   { id }            -> delete one lead
//   { bulk: "unnamed" } -> delete all no-name, unpaid leads (test/abandoned)
export async function DELETE(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Not allowed" : "Not signed in" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { id?: string; bulk?: string } = {};
  try { body = await req.json(); } catch {}
  const db = getDb();

  if (body.bulk === "unnamed") {
    // No first/last name and never paid = a test run or an abandoned session.
    // (Named or paid leads are always kept, even here.)
    const all = await db.select().from(designLabVisitors);
    const ids = all
      .filter((v) => !(v.firstName ?? "").trim() && !(v.lastName ?? "").trim() && !v.paidAt)
      .map((v) => v.id);
    if (ids.length === 0) return NextResponse.json({ ok: true, deleted: 0 });
    await db.delete(designLabRenders).where(inArray(designLabRenders.visitorId, ids));
    await db.delete(designLabVisitors).where(inArray(designLabVisitors.id, ids));
    return NextResponse.json({ ok: true, deleted: ids.length });
  }

  if (!body.id) return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
  await db.delete(designLabRenders).where(eq(designLabRenders.visitorId, body.id));
  const removed = await db.delete(designLabVisitors).where(eq(designLabVisitors.id, body.id)).returning({ id: designLabVisitors.id });
  if (!removed.length) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: 1 });
}
