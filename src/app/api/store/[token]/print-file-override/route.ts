import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teams } from "@/db/schema";
import { getStoreByHandle } from "@/lib/team-stores";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const store = await getStoreByHandle(token);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  let body: { dismissed?: number[]; group?: string } = {};
  try { body = await req.json(); } catch {}
  const group = (body.group ?? "").trim();
  const all = { ...(store.storePrintFileQa ?? {}) };
  const qa = group ? all[group] : undefined;
  if (!qa) return NextResponse.json({ error: "Nothing verified for this design yet." }, { status: 409 });

  const count = qa.mismatches.length;
  const dismissed = Array.from(new Set((body.dismissed ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < count)));
  const unresolved = count - dismissed.length;
  const clearedByOverride = count > 0 && unresolved === 0;

  all[group] = { ...qa, dismissed };
  await getDb().update(teams).set({ storePrintFileQa: all }).where(eq(teams.id, store.id));

  if (clearedByOverride && store.storeThreadId) {
    await postDesignThreadUpdate({
      threadId: store.storeThreadId,
      title: `✅ Print file cleared - ${store.name}`,
      description: "All AI-flagged issues on this design were reviewed and marked correct. Safe to produce.",
      username: "Slugger Print QA",
    });
  }
  return NextResponse.json({ ok: true, dismissed, cleared: clearedByOverride || qa.ok });
}
