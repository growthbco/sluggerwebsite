import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import {
  getByManageToken,
  getRoster,
  savePrintFileVerification,
  ensureTeamOrderDiscordThread,
} from "@/lib/team-orders";
import { verifyPrintFiles, type RosterEntry } from "@/lib/print-file-verifier";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";
export const maxDuration = 300; // large PDFs: Files API upload + processing + read

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;

  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { printFileUrl?: string; printFileUrls?: string[]; scope?: string } = {};
  try { body = await req.json(); } catch {}
  // Accept a single URL (legacy) or a list of sheets.
  const printFileUrls = (body.printFileUrls ?? (body.printFileUrl ? [body.printFileUrl] : []))
    .map((u) => (u ?? "").trim())
    .filter(Boolean)
    .slice(0, 10);
  if (printFileUrls.length === 0) {
    return NextResponse.json({ error: "Upload a print file first." }, { status: 400 });
  }

  // "add-ons only": verify just the NEW add-on pieces (paid after the order
  // shipped), using each piece's own size - so a sheet for the extras doesn't
  // re-flag the already-delivered originals as missing. Otherwise: the full
  // submitted roster (jersey size), the ground truth from the join link.
  const addonsOnly = body.scope === "addons";
  let roster: RosterEntry[];
  if (addonsOnly) {
    const { latestAddonBatchRoster } = await import("@/lib/team-order-addons");
    roster = await latestAddonBatchRoster(order.id);
  } else {
    const rosterRows = await getRoster(order.id);
    roster = rosterRows
      .map((r) => ({
        name: (r.playerName ?? "").trim(),
        number: (r.playerNumber ?? "").trim(),
        size: (r.sizes?.jersey ?? r.size ?? "").trim(),
      }))
      .filter((r) => r.name && r.number);
  }

  if (roster.length === 0) {
    return NextResponse.json(
      { error: addonsOnly ? "No new add-on pieces to verify." : "No roster entries to verify against yet." },
      { status: 400 },
    );
  }

  try {
    const result = await verifyPrintFiles(printFileUrls, roster);
    await savePrintFileVerification(order.id, printFileUrls, result);
    // On a clean pass, keep the approved sheet attached where it belongs:
    // add-ons-only -> the add-on batch(es); full roster -> the original order.
    if (result.ok) {
      if (addonsOnly) {
        const { markAddonsPrintVerified } = await import("@/lib/team-order-addons");
        await markAddonsPrintVerified(order.id, printFileUrls);
      } else {
        const { getDb } = await import("@/db");
        const { teamOrders } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        await getDb().update(teamOrders).set({ originalPrintFileUrls: printFileUrls }).where(eq(teamOrders.id, order.id));
      }
    }

    // Keep the QA audit in this order's persistent Design Requests thread.
    {
      const discordThreadId = await ensureTeamOrderDiscordThread(order.id);
      if (discordThreadId) {
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
        const scopeNote = addonsOnly ? " [add-ons only]" : "";
        const against = addonsOnly ? "the added pieces" : "the submitted roster";
        await postDesignThreadUpdate({
          threadId: discordThreadId,
          title: result.ok
            ? `🔍 Print file verified${scopeNote} - ${order.teamName} (${order.reference})`
            : `🔍 Print file QA${scopeNote} - ${order.teamName} (${order.reference})`,
          description: result.ok
            ? `Cross-checked ${printFileUrls.length} print ${printFileUrls.length === 1 ? "file" : "files"} against ${against}. Safe to send to production.`
            : `Found discrepancies between the print file and ${against} - fix and re-verify before printing.`,
          fields,
          imageUrl: printFileUrls[0],
          username: "Slugger Print QA",
        });
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("verifyPrintFile failed:", e);
    return NextResponse.json(
      { error: (e as Error).message || "Could not verify print file" },
      { status: 500 },
    );
  }
}
