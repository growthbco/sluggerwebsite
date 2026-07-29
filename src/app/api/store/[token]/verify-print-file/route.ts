import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teams } from "@/db/schema";
import { getStoreByHandle } from "@/lib/team-stores";
import { getStoreRoster, getStoreGroups } from "@/lib/store-print-file";
import { verifyPrintFiles } from "@/lib/print-file-verifier";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const store = await getStoreByHandle(token);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  let body: { printFileUrl?: string; printFileUrls?: string[]; group?: string } = {};
  try { body = await req.json(); } catch {}
  const printFileUrls = (body.printFileUrls ?? (body.printFileUrl ? [body.printFileUrl] : []))
    .map((u) => (u ?? "").trim()).filter(Boolean).slice(0, 10);
  if (printFileUrls.length === 0) return NextResponse.json({ error: "Upload a print file first." }, { status: 400 });

  const group = (body.group ?? "").trim();
  if (!group) return NextResponse.json({ error: "Pick which design you're verifying." }, { status: 400 });
  const groups = await getStoreGroups(store.id);
  const groupMeta = groups.find((g) => g.key === group);
  if (!groupMeta) return NextResponse.json({ error: "Unknown design group." }, { status: 400 });

  const roster = await getStoreRoster(store.id, group);
  if (roster.length === 0) return NextResponse.json({ error: "No printed jerseys in this design yet." }, { status: 400 });

  try {
    const result = await verifyPrintFiles(printFileUrls, roster);
    const qa = { ...(store.storePrintFileQa ?? {}) };
    qa[group] = { ...result, urls: printFileUrls, dismissed: [] };
    await getDb().update(teams).set({ storePrintFileQa: qa }).where(eq(teams.id, store.id));

    if (store.storeThreadId) {
      const fields = result.ok
        ? [{ name: "Result", value: `✅ ${result.summary}`, inline: false }]
        : [
            { name: "Result", value: `⚠️ ${result.summary}`, inline: false },
            ...result.mismatches.slice(0, 10).map((m, i) => ({
              name: `Issue ${i + 1} - ${m.kind.replace("_", " ")}`,
              value: m.detail.slice(0, 1024),
              inline: false,
            })),
          ];
      await postDesignThreadUpdate({
        threadId: store.storeThreadId,
        title: result.ok
          ? `🔍 Print file verified - ${store.name}: ${groupMeta.label}`
          : `🔍 Print file QA - ${store.name}: ${groupMeta.label}`,
        description: result.ok
          ? `Checked against all ${roster.length} paid ${groupMeta.label} ${roster.length === 1 ? "jersey" : "jerseys"}. Safe to produce.`
          : `Discrepancies on the ${groupMeta.label} print file vs the paid order - fix and re-verify before printing.`,
        fields,
        imageUrl: printFileUrls[0],
        username: "Slugger Print QA",
      });
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("store verifyPrintFile failed:", e);
    return NextResponse.json({ error: (e as Error).message || "Could not verify print file" }, { status: 500 });
  }
}
