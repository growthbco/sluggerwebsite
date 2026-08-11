import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, orders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { scheduleUspsPickup } from "@/lib/shippo";

export const runtime = "nodejs";

// Schedule a FREE USPS pickup at the shop for all USPS labels on an order
// (primary + additional). UPS charges for pickups, so this is USPS-only.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { kind?: string; id?: string; date?: string } = {};
  try { body = await req.json(); } catch {}
  const kind = body.kind === "team_order" ? "team_order" : body.kind === "order" ? "order" : null;
  const date = (body.date ?? "").trim();
  if (!kind || !body.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Pick a pickup date." }, { status: 400 });

  const db = getDb();
  const txns: string[] = [];
  if (kind === "team_order") {
    const [o] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.id)).limit(1);
    if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (o.shipTransactionId) txns.push(o.shipTransactionId);
    for (const s of o.additionalShipments ?? []) if (s.transactionId) txns.push(s.transactionId);
  } else {
    const [o] = await db.select().from(orders).where(eq(orders.id, body.id)).limit(1);
    if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (o.shipTransactionId) txns.push(o.shipTransactionId);
    for (const s of o.additionalShipments ?? []) if (s.transactionId) txns.push(s.transactionId);
  }

  const result = await scheduleUspsPickup(txns, date);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, confirmation: result.confirmation });
}
