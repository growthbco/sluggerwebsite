import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { designRequests } from "@/db/schema";

export const runtime = "nodejs";

// Lightweight signal for the global admin notifier: the newest CLIENT email
// (design-thread reply) across all active designs, so a customer emailing in
// raises the same beep + desktop alert as a text. Selects only the LAST message
// per design (jsonb `-> -1`), never the whole thread.
export async function GET() {
  const gate = await requireApiRole("conversations");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ latestClientEmail: null });

  const db = getDb();
  const rows = await db
    .select({
      id: designRequests.id,
      reference: designRequests.reference,
      teamName: designRequests.teamName,
      status: designRequests.status,
      archivedAt: designRequests.archivedAt,
      lastMessage: sql<{ from?: string; at?: string; text?: string } | null>`${designRequests.messages} -> -1`,
    })
    .from(designRequests);

  let newest: { at: number; id: string; reference: string; team: string; preview: string } | null = null;
  for (const r of rows) {
    if (r.archivedAt || r.status === "cancelled") continue;
    const lm = r.lastMessage;
    if (!lm || lm.from !== "client" || !lm.at) continue;
    const at = new Date(lm.at).getTime();
    if (Number.isNaN(at)) continue;
    if (!newest || at > newest.at) {
      newest = { at, id: r.id, reference: r.reference, team: r.teamName.trim(), preview: (lm.text ?? "").slice(0, 120) };
    }
  }

  return NextResponse.json({
    latestClientEmail: newest
      ? { at: new Date(newest.at).toISOString(), id: newest.id, reference: newest.reference, team: newest.team, preview: newest.preview }
      : null,
  });
}
