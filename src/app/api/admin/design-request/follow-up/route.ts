import { NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { markDesignUnresponsive } from "@/lib/design-requests";
import { sendProofFollowUp } from "@/lib/proof-follow-up";
import { MAX_PROOF_FOLLOW_UPS } from "@/lib/proof-follow-up-policy";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

type Action = "send_next" | "send_final" | "snooze" | "mark_unresponsive";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { id?: string; action?: Action; days?: number } = {};
  try { body = await req.json(); } catch {}
  if (!body.id || !body.action || !["send_next", "send_final", "snooze", "mark_unresponsive"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.action === "mark_unresponsive") {
    const result = await markDesignUnresponsive(body.id);
    if (!result.ok) {
      const error = result.reason === "funded"
        ? "This design has a paid or production order and cannot be marked unresponsive."
        : "Design request not found.";
      return NextResponse.json({ error }, { status: result.reason === "funded" ? 409 : 404 });
    }
    return NextResponse.json({ ok: true, action: body.action });
  }

  const db = getDb();
  const [request] = await db.select().from(designRequests).where(eq(designRequests.id, body.id)).limit(1);
  if (!request) return NextResponse.json({ error: "Design request not found." }, { status: 404 });
  if (request.archivedAt || request.status !== "proof_sent" || !request.proofSentAt || !request.statusToken) {
    return NextResponse.json({ error: "Only an active proof waiting on the customer can use this action." }, { status: 409 });
  }

  const funded = await db
    .select({ id: teamOrders.id })
    .from(teamOrders)
    .where(and(
      eq(teamOrders.designRequestId, request.id),
      isNotNull(teamOrders.depositPaidAt),
    ))
    .limit(1);
  if (funded.length) {
    return NextResponse.json({ error: "This customer already paid a deposit. Keep the order in the active staff queue." }, { status: 409 });
  }

  if (body.action === "snooze") {
    const days = body.days === 30 ? 30 : 7;
    const until = new Date(Date.now() + days * 86_400_000);
    await db
      .update(designRequests)
      .set({ followUpSnoozedUntil: until, updatedAt: new Date() })
      .where(eq(designRequests.id, request.id));
    await postDesignThreadUpdate({
      threadId: request.discordThreadId,
      title: `⏸ Follow-up snoozed - ${request.teamName} (${request.reference})`,
      description: `Staff paused automated proof reminders for ${days} days.`,
      username: "Slugger Design Requests",
    });
    return NextResponse.json({ ok: true, action: body.action, until: until.toISOString() });
  }

  const round = body.action === "send_final"
    ? MAX_PROOF_FOLLOW_UPS
    : Math.min(MAX_PROOF_FOLLOW_UPS, (request.followUpsSent ?? 0) + 1);
  const result = await sendProofFollowUp({
    id: request.id,
    reference: request.reference,
    teamName: request.teamName,
    contactName: request.contactName,
    contactEmail: request.contactEmail,
    contactPhone: request.contactPhone,
    smsOptInAt: request.smsOptInAt,
    statusToken: request.statusToken,
    discordThreadId: request.discordThreadId,
    followUpsSent: request.followUpsSent ?? 0,
    proofSentAt: request.proofSentAt,
    neededBy: request.neededBy,
  }, round);
  if (!result.sent) return NextResponse.json({ error: "The reminder could not be delivered by email or text." }, { status: 502 });
  return NextResponse.json({ ok: true, action: body.action, round: result.round });
}
