import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, teamOrderAddons } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { createAddonCheckoutLink, removePendingAddon, type AddonRow } from "@/lib/team-order-addons";

export const runtime = "nodejs";

// Admin: manage an order's PENDING add-on invoices.
//   POST { teamOrderId, action: "combine" }     -> merge all pending into one link
//   POST { teamOrderId, action: "remove", addonId } -> delete one pending batch
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; action?: string; addonId?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.teamOrderId) return NextResponse.json({ error: "Missing order" }, { status: 400 });

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (body.action === "remove") {
    if (!body.addonId) return NextResponse.json({ error: "Missing addonId" }, { status: 400 });
    const ok = await removePendingAddon(body.addonId);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Already paid or not found" }, { status: 409 });
  }

  if (body.action === "combine") {
    const pending = await db
      .select()
      .from(teamOrderAddons)
      .where(and(eq(teamOrderAddons.teamOrderId, order.id), eq(teamOrderAddons.status, "pending")));
    if (pending.length < 2) return NextResponse.json({ error: "Need at least 2 pending invoices to combine." }, { status: 400 });

    const rows: AddonRow[] = pending.flatMap((p) => p.rows);
    const totalCents = rows.reduce((s, r) => s + r.unitPriceCents * r.quantity, 0);
    const result = await createAddonCheckoutLink(order, rows, totalCents);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });
    // Remove the old pending batches (keep the freshly created combined one).
    for (const p of pending) if (p.id !== result.addonId) await removePendingAddon(p.id);
    return NextResponse.json({ ok: true, url: result.url });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
