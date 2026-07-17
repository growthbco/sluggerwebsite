import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getByManageToken } from "@/lib/team-orders";
import { getById as getDesignById } from "@/lib/design-requests";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

// Staff marks specific AI-flagged issues as actually fine (font misreads etc.).
// When every mismatch is dismissed, the print file counts as verified.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  const verification = order.printFileVerification;
  if (!verification) {
    return NextResponse.json({ error: "Nothing verified yet - run the print-file check first." }, { status: 409 });
  }

  let body: { dismissed?: number[] } = {};
  try {
    body = await req.json();
  } catch {}
  const count = verification.mismatches.length;
  const dismissed = Array.from(
    new Set((body.dismissed ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < count)),
  );

  const unresolved = verification.mismatches.length - dismissed.length;
  const clearedByOverride = verification.mismatches.length > 0 && unresolved === 0;
  const fullyClear = verification.ok || unresolved === 0;

  const db = getDb();
  const now = new Date();
  await db
    .update(teamOrders)
    .set({
      printFileVerification: { ...verification, dismissed },
      printFileVerifiedAt: fullyClear ? now : null,
      updatedAt: now,
    })
    .where(eq(teamOrders.id, order.id));

  // Note the manual sign-off in the design thread for the audit trail.
  if (clearedByOverride && order.designRequestId) {
    const design = await getDesignById(order.designRequestId);
    if (design?.discordThreadId) {
      await postDesignThreadUpdate({
        threadId: design.discordThreadId,
        title: `✍️ Print file manually approved - ${order.teamName} (${order.reference})`,
        description: `Staff reviewed ${dismissed.length} AI-flagged item${dismissed.length === 1 ? "" : "s"} and marked ${dismissed.length === 1 ? "it" : "them"} correct. Clear for production.`,
        username: "Slugger Print QA",
      });
    }
  }

  return NextResponse.json({ ok: true, dismissed, verified: fullyClear, unresolved });
}
