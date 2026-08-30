import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, designRequests, orders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { postDesignThreadUpdate } from "@/lib/discord";
import {
  archiveDiscordThread,
  setThreadStageTag,
  unarchiveDiscordThread,
  type StageTag,
} from "@/lib/discord-bot";
import { markDesignUnresponsive, reactivateUnresponsiveDesignRequest } from "@/lib/design-requests";
import { isUnresponsiveArchiveNote } from "@/lib/proof-follow-up-policy";

export const runtime = "nodejs";

// Admin-only: archive (with a follow-up note) or restore a team order or a
// design request. Nothing is deleted - archived records live in their own
// dashboard sections, and archived designs stop getting auto follow-ups.
export async function POST(req: Request) {
  const gate = await requireApiRole("customer");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { kind?: string; id?: string; archive?: boolean; note?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.id || typeof body.archive !== "boolean" || !["team_order", "design_request", "order"].includes(body.kind ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const note = (body.note ?? "").trim().slice(0, 200);
  const unresponsive = isUnresponsiveArchiveNote(note);

  if (body.archive && body.kind === "design_request" && unresponsive) {
    const result = await markDesignUnresponsive(body.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason === "funded" ? "This design has a paid or production order and cannot be marked unresponsive." : "Not found" },
        { status: result.reason === "funded" ? 409 : 404 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.archive && body.kind === "design_request") {
    const [existing] = await getDb()
      .select({ archivedNote: designRequests.archivedNote })
      .from(designRequests)
      .where(eq(designRequests.id, body.id))
      .limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isUnresponsiveArchiveNote(existing.archivedNote)) {
      await reactivateUnresponsiveDesignRequest(body.id);
      return NextResponse.json({ ok: true });
    }
  }

  const values = body.archive
    ? { archivedAt: new Date(), archivedNote: note || null }
    : { archivedAt: null, archivedNote: null };

  const db = getDb();
  const table = body.kind === "team_order" ? teamOrders : body.kind === "order" ? orders : designRequests;

  let teamThreadId: string | null = null;
  let teamStatus: string | null = null;
  if (body.kind === "team_order") {
    const [order] = await db
      .select({
        status: teamOrders.status,
        teamName: teamOrders.teamName,
        reference: teamOrders.reference,
        depositPaidAt: teamOrders.depositPaidAt,
        invoicePaidAt: teamOrders.invoicePaidAt,
        discordThreadId: teamOrders.discordThreadId,
        designRequestId: teamOrders.designRequestId,
      })
      .from(teamOrders)
      .where(eq(teamOrders.id, body.id))
      .limit(1);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (body.archive && unresponsive && (order.depositPaidAt || order.invoicePaidAt || ["in_production", "paid", "shipped"].includes(order.status))) {
      return NextResponse.json({ error: "Paid and production orders stay active for staff follow-up and cannot be marked unresponsive." }, { status: 409 });
    }
    teamStatus = order.status;
    teamThreadId = order.discordThreadId;
    if (!teamThreadId && order.designRequestId) {
      const [design] = await db
        .select({ discordThreadId: designRequests.discordThreadId })
        .from(designRequests)
        .where(eq(designRequests.id, order.designRequestId))
        .limit(1);
      teamThreadId = design?.discordThreadId ?? null;
    }
    if (body.archive && unresponsive) {
      await postDesignThreadUpdate({
        threadId: teamThreadId,
        title: `💤 Moved to Unresponsive - ${order.teamName} (${order.reference})`,
        description: "The unpaid order was removed from the active queue. No history was deleted; restore it if the customer comes back.",
        username: "Slugger Team Orders",
      });
      await setThreadStageTag(teamThreadId, "💤 Unresponsive");
    }
  }

  const [row] = await db.update(table).set(values).where(eq(table.id, body.id)).returning({ id: table.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Archiving a design also archives its Discord thread (bot token required;
  // no-ops silently without one). Restoring doesn't unarchive - posting into
  // the thread un-archives it automatically on Discord's side.
  if (body.archive && body.kind === "design_request") {
    const [d] = await db
      .select({ threadId: designRequests.discordThreadId })
      .from(designRequests)
      .where(eq(designRequests.id, body.id))
      .limit(1);
    await archiveDiscordThread(d?.threadId);
  } else if (body.archive && body.kind === "team_order" && unresponsive) {
    await archiveDiscordThread(teamThreadId);
  } else if (!body.archive && body.kind === "team_order") {
    await unarchiveDiscordThread(teamThreadId);
    await setThreadStageTag(teamThreadId, stageTagForStatus(teamStatus));
  } else if (!body.archive && body.kind === "design_request") {
    const [design] = await db
      .select({ status: designRequests.status, threadId: designRequests.discordThreadId })
      .from(designRequests)
      .where(eq(designRequests.id, body.id))
      .limit(1);
    await unarchiveDiscordThread(design?.threadId);
    await setThreadStageTag(design?.threadId, stageTagForStatus(design?.status ?? null));
  }
  return NextResponse.json({ ok: true });
}

function stageTagForStatus(status: string | null): StageTag {
  if (status === "shipped") return "🚚 Shipped";
  if (status === "paid") return "💸 Paid in Full";
  if (status === "in_production") return "💰 Deposit Paid";
  if (status === "submitted" || status === "collecting" || status === "quoted") return "📋 Roster In";
  if (status === "approved" || status === "ordered") return "✅ Approved";
  return "🎨 Designing";
}
