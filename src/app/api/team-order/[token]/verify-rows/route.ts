import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getById, getByManageToken, getPrintableJerseys, markJerseysVerified, ensureTeamOrderDiscordThread } from "@/lib/team-orders";
import { verifyPrintFiles, type RosterEntry } from "@/lib/print-file-verifier";
import { getById as getDesignById } from "@/lib/design-requests";
import { postDesignThreadUpdate } from "@/lib/discord";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

// Per-jersey print-file QA: verify a print sheet against ONLY the selected
// jerseys, then mark those jerseys verified. Already-verified jerseys aren't
// re-checked; newly-added ones are just the ones you select.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const gate = await requireApiRole("production");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = (await getById(token)) ?? (await getByManageToken(token));
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const rowIds: string[] = Array.isArray(body?.rowIds) ? body.rowIds.filter((x: unknown) => typeof x === "string") : [];
  const printFileUrls: string[] = (Array.isArray(body?.printFileUrls) ? body.printFileUrls : [])
    .map((u: unknown) => (typeof u === "string" ? u.trim() : "")).filter(Boolean).slice(0, 10);
  if (printFileUrls.length === 0) return NextResponse.json({ error: "Upload a print file first." }, { status: 400 });
  if (rowIds.length === 0) return NextResponse.json({ error: "Select which jerseys are on this sheet." }, { status: 400 });

  const all = await getPrintableJerseys(order.id);
  const selected = all.filter((j) => rowIds.includes(j.id));
  const roster: RosterEntry[] = selected
    .map((j) => ({ name: j.name, number: j.number, size: j.size }))
    // A jersey is verifiable with a name OR a number - many teams (bowling,
    // rec, adult league) run names with no numbers.
    .filter((r) => r.name || r.number);
  if (roster.length === 0) return NextResponse.json({ error: "The selected jerseys have no name or number to verify." }, { status: 400 });

  try {
    const result = await verifyPrintFiles(printFileUrls, roster);
    if (result.ok) {
      await markJerseysVerified(order.id, rowIds, printFileUrls[0]);
    }

    {
      const design = order.designRequestId ? await getDesignById(order.designRequestId) : null;
      const discordThreadId = await ensureTeamOrderDiscordThread(order.id);
      if (discordThreadId) {
        const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
        const link = design?.manageToken
          ? `\n\n🔗 [Open this order](${SITE}/design/manage/${design.manageToken})`
          : order.manageToken
            ? `\n\n🔗 [Open this order](${SITE}/team-order/manage/${order.manageToken})`
            : "";
        await postDesignThreadUpdate({
          threadId: discordThreadId,
          title: result.ok
            ? `🔍 ${roster.length} jersey${roster.length === 1 ? "" : "s"} verified - ${order.teamName} (${order.reference})`
            : `🔍 Print file QA - ${order.teamName} (${order.reference})`,
          description: (result.ok
            ? `Verified ${roster.length} selected ${roster.length === 1 ? "jersey" : "jerseys"} against the uploaded sheet.`
            : "Found discrepancies between the sheet and the selected jerseys - fix and re-verify.") + link,
          fields: result.ok ? undefined : result.mismatches.slice(0, 10).map((m, i) => ({ name: `Issue ${i + 1} - ${m.kind.replace("_", " ")}`, value: m.detail.slice(0, 1024), inline: false })),
          imageUrl: printFileUrls[0],
          username: "Slugger Print QA",
        });
      }
    }

    return NextResponse.json({ ok: true, result, verifiedRowIds: result.ok ? rowIds : [] });
  } catch (e) {
    console.error("verify-rows failed:", e);
    return NextResponse.json({ error: (e as Error).message || "Could not verify" }, { status: 500 });
  }
}
