import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { assistantFacts } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: teach (or un-teach) the AI assistant a fact. Facts are injected
// into every AI reply/draft as authoritative shop policy.
export async function POST(req: Request) {
  const gate = await requireApiRole("customer");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { fact?: string; addedBy?: string } = {};
  try { body = await req.json(); } catch {}
  const fact = (body.fact ?? "").trim().slice(0, 600);
  if (!fact) return NextResponse.json({ error: "Write the fact first." }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .insert(assistantFacts)
    .values({ fact, addedBy: (body.addedBy ?? "").trim().slice(0, 40) || null })
    .returning();
  return NextResponse.json({ ok: true, fact: { id: row.id, fact: row.fact } });
}

export async function DELETE(req: Request) {
  const gate = await requireApiRole("customer");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { id?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = getDb();
  await db.delete(assistantFacts).where(eq(assistantFacts.id, body.id));
  return NextResponse.json({ ok: true });
}
