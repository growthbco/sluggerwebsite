import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import {
  getByManageToken,
  getRoster,
  savePrintFileVerification,
} from "@/lib/team-orders";
import { verifyPrintFiles, type RosterEntry } from "@/lib/print-file-verifier";
import { getById as getDesignById } from "@/lib/design-requests";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";
export const maxDuration = 60; // Gemini call can take ~10–30s on large prints

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;

  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { printFileUrl?: string; printFileUrls?: string[] } = {};
  try { body = await req.json(); } catch {}
  // Accept a single URL (legacy) or a list of sheets.
  const printFileUrls = (body.printFileUrls ?? (body.printFileUrl ? [body.printFileUrl] : []))
    .map((u) => (u ?? "").trim())
    .filter(Boolean)
    .slice(0, 10);
  if (printFileUrls.length === 0) {
    return NextResponse.json({ error: "Upload a print file first." }, { status: 400 });
  }

  // Roster ground truth — pulled directly from the rows the team submitted via
  // the join link. Jersey size only (verifier compares per-jersey).
  const rosterRows = await getRoster(order.id);
  const roster: RosterEntry[] = rosterRows
    .map((r) => ({
      name: (r.playerName ?? "").trim(),
      number: (r.playerNumber ?? "").trim(),
      size: (r.sizes?.jersey ?? r.size ?? "").trim(),
    }))
    .filter((r) => r.name && r.number);

  if (roster.length === 0) {
    return NextResponse.json(
      { error: "No roster entries to verify against yet." },
      { status: 400 },
    );
  }

  try {
    const result = await verifyPrintFiles(printFileUrls, roster);
    await savePrintFileVerification(order.id, printFileUrls, result);

    // Post to the linked design Discord thread (if any) so the designer/team
    // get an auditable "Print file verified" message.
    if (order.designRequestId) {
      const design = await getDesignById(order.designRequestId);
      if (design?.discordThreadId) {
        const fields = result.ok
          ? [{ name: "Result", value: `✅ ${result.summary}`, inline: false }]
          : [
              { name: "Result", value: `⚠️ ${result.summary}`, inline: false },
              ...result.mismatches.slice(0, 10).map((m, i) => ({
                name: `Issue ${i + 1} — ${m.kind.replace("_", " ")}`,
                value: m.detail.slice(0, 1024),
                inline: false,
              })),
            ];
        await postDesignThreadUpdate({
          threadId: design.discordThreadId,
          title: result.ok
            ? `🔍 Print file verified — ${order.teamName} (${order.reference})`
            : `🔍 Print file QA — ${order.teamName} (${order.reference})`,
          description: result.ok
            ? `Cross-checked ${printFileUrls.length} print ${printFileUrls.length === 1 ? "file" : "files"} against the submitted roster. Safe to send to production.`
            : "Found discrepancies between the print file and the submitted roster — fix and re-verify before printing.",
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
