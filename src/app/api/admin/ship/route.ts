import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { markShipped } from "@/lib/fulfillment";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only manual path: record an externally bought (e.g. Pirate Ship)
// tracking number, flip the status, email the customer.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { kind?: string; id?: string; trackingNumber?: string } = {};
  try {
    body = await req.json();
  } catch {}
  // Tracking is optional: if a label was already bought, "Mark shipped" reuses
  // the tracking on file. Otherwise the admin pastes one (e.g. Pirate Ship).
  const tracking = (body.trackingNumber ?? "").trim().slice(0, 60);
  if (!body.id || !["team_order", "order"].includes(body.kind ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await markShipped(body.kind as "team_order" | "order", body.id, tracking || undefined);
  if (!result) {
    return NextResponse.json({ error: "Order not found, or no tracking number on file. Enter one to ship." }, { status: 404 });
  }

  // Move the design thread's stage tag along. Best-effort.
  if (body.kind === "team_order") {
    try {
      const { getDb } = await import("@/db");
      const { teamOrders } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      const [o] = await getDb()
        .select({ designRequestId: teamOrders.designRequestId })
        .from(teamOrders)
        .where(eq(teamOrders.id, body.id))
        .limit(1);
      if (o?.designRequestId) {
        const { getById } = await import("@/lib/design-requests");
        const design = await getById(o.designRequestId);
        const { setThreadStageTag } = await import("@/lib/discord-bot");
        await setThreadStageTag(design?.discordThreadId, "🚚 Shipped");
      }
    } catch (e) {
      console.error("ship stage tag failed:", e);
    }
  }
  return NextResponse.json({ ok: true, emailed: result.emailed });
}
