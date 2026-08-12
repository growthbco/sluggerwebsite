import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designLabVisitors, designLabRenders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Delete a Design Lab lead (and its saved concepts) - for clearing out test
// runs and junk. Money-gated so designers can't wipe leads.
export async function DELETE(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Not allowed" : "Not signed in" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { id?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.id) return NextResponse.json({ error: "Missing lead id" }, { status: 400 });

  const db = getDb();
  await db.delete(designLabRenders).where(eq(designLabRenders.visitorId, body.id));
  const removed = await db.delete(designLabVisitors).where(eq(designLabVisitors.id, body.id)).returning({ id: designLabVisitors.id });
  if (!removed.length) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
