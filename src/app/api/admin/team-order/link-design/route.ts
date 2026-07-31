import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { getRoster } from "@/lib/team-orders";
import { getById, markOrdered } from "@/lib/design-requests";
import { postTeamOrderToDiscord } from "@/lib/discord";
import { setThreadStageTag } from "@/lib/discord-bot";

export const runtime = "nodejs";

// Admin-only: manually link a standalone team order to a design request. Used
// when a coach placed the order under a different email so it didn't auto-link.
// Also posts the roster into that design's Discord thread and marks it ordered.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; designRequestId?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamOrderId || !body.designRequestId) {
    return NextResponse.json({ error: "Missing order or design" }, { status: 400 });
  }

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const design = await getById(body.designRequestId);
  if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });

  await db.update(teamOrders).set({ designRequestId: design.id, updatedAt: new Date() }).where(eq(teamOrders.id, order.id));

  // Best-effort: mark the design ordered + drop the roster into its thread so
  // the whole project is together in Discord.
  try {
    await markOrdered(design.id);
  } catch (e) {
    console.error("markOrdered (link) failed:", e);
  }
  try {
    const roster = await getRoster(order.id);
    await postTeamOrderToDiscord(
      {
        reference: order.reference,
        teamName: order.teamName,
        contactName: order.contactName,
        contactEmail: order.contactEmail,
        contactPhone: order.contactPhone ?? undefined,
        jerseyStyle: order.jerseyStyle ?? undefined,
        jerseyMaterial: order.jerseyMaterial ?? undefined,
        items: order.items ?? ["jersey"],
        roster: roster.map((r) => ({
          name: r.playerName ?? undefined,
          number: r.playerNumber ?? undefined,
          size: r.sizes?.jersey ?? r.size ?? undefined,
          sizes: r.sizes ?? undefined,
          notes: r.notes ?? undefined,
        })),
      },
      { designThreadId: design.discordThreadId },
    );
    await setThreadStageTag(design.discordThreadId, "📋 Roster In");
  } catch (e) {
    console.error("link Discord post failed:", e);
  }

  return NextResponse.json({ ok: true });
}
