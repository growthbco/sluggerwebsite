import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teams } from "@/db/schema";
import { getStoreByHandle } from "@/lib/team-stores";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

// Designer marks AI-flagged issues as actually fine (font misreads etc.).
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const store = await getStoreByHandle(token);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  const qa = store.storePrintFileQa;
  if (!qa) return NextResponse.json({ error: "Nothing verified yet - run the print-file check first." }, { status: 409 });

  let body: { dismissed?: number[] } = {};
  try { body = await req.json(); } catch {}
  const count = qa.mismatches.length;
  const dismissed = Array.from(new Set((body.dismissed ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < count)));
  const unresolved = count - dismissed.length;
  const clearedByOverride = count > 0 && unresolved === 0;

  await getDb().update(teams).set({ storePrintFileQa: { ...qa, dismissed } }).where(eq(teams.id, store.id));

  if (clearedByOverride && store.storeThreadId) {
    await postDesignThreadUpdate({
      threadId: store.storeThreadId,
      title: `✅ Print file cleared - ${store.name} store add-ons`,
      description: "All AI-flagged issues were reviewed and marked correct by staff. Safe to produce.",
      username: "Slugger Print QA",
    });
  }
  return NextResponse.json({ ok: true, dismissed, cleared: clearedByOverride || qa.ok });
}
