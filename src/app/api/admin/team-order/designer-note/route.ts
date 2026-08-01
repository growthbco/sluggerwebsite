import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { getById } from "@/lib/design-requests";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

// Admin-only: set a designer/production note on a team order and (by default)
// push it to Discord so the designer sees it - into the linked design thread
// when there is one, otherwise a fresh thread in the design-requests channel.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body?.teamOrderId) return NextResponse.json({ error: "Missing order" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const notify = body.notify !== false;

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(teamOrders).set({ designerNote: note || null, updatedAt: new Date() }).where(eq(teamOrders.id, order.id));

  let posted = false;
  if (notify && note) {
    try {
      const design = order.designRequestId ? await getById(order.designRequestId) : null;
      const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
      // Direct link to the order so the designer can jump straight to it: the
      // design-manage page (print QA + roster) when linked, else the team-order.
      const link = design?.manageToken ? `${SITE}/design/manage/${design.manageToken}` : `${SITE}/team-order/manage/${order.manageToken}`;
      posted = await postDesignThreadUpdate({
        threadId: design?.discordThreadId,
        title: `📝 Designer note - ${order.teamName} (${order.reference})`,
        description: `${note}\n\n🔗 [Open this order](${link})`,
        mention: true,
        username: "Slugger Team Orders",
      });
    } catch (e) {
      console.error("designer note discord post failed:", e);
    }
  }

  return NextResponse.json({ ok: true, note: note || null, posted });
}
