import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teams } from "@/db/schema";
import { getStoreByHandle } from "@/lib/team-stores";
import { getStoreRoster } from "@/lib/store-print-file";
import { verifyPrintFiles } from "@/lib/print-file-verifier";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const store = await getStoreByHandle(token);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  let body: { printFileUrl?: string; printFileUrls?: string[] } = {};
  try { body = await req.json(); } catch {}
  const printFileUrls = (body.printFileUrls ?? (body.printFileUrl ? [body.printFileUrl] : []))
    .map((u) => (u ?? "").trim()).filter(Boolean).slice(0, 10);
  if (printFileUrls.length === 0) return NextResponse.json({ error: "Upload a print file first." }, { status: 400 });

  const roster = await getStoreRoster(store.id);
  if (roster.length === 0) {
    return NextResponse.json({ error: "No printed jerseys to verify yet - add-ons appear here once paid." }, { status: 400 });
  }

  try {
    const result = await verifyPrintFiles(printFileUrls, roster);
    await getDb().update(teams)
      .set({ storePrintFileUrls: printFileUrls, storePrintFileQa: { ...result, dismissed: [] } })
      .where(eq(teams.id, store.id));

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
          ? `🔍 Print file verified - ${store.name} store add-ons`
          : `🔍 Print file QA - ${store.name} store add-ons`,
        description: result.ok
          ? `Cross-checked ${printFileUrls.length} print ${printFileUrls.length === 1 ? "file" : "files"} against all ${roster.length} paid add-on jerseys. Safe to produce.`
          : "Found discrepancies between the print file and the paid add-on jerseys - fix and re-verify before printing.",
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
