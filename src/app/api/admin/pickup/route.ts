import { NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, orders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { scheduleUspsPickup } from "@/lib/shippo";

export const runtime = "nodejs";

const isUsps = (carrier: string | null) => !carrier || /usps/i.test(carrier);

// Gather every USPS label transaction (primary + additional) that's bought but
// hasn't gone out yet - the same "ready for pickup" set the pickup page shows.
async function readyUspsTransactions(db: ReturnType<typeof getDb>): Promise<string[]> {
  const [torders, shopOrders] = await Promise.all([
    db.select().from(teamOrders).where(isNotNull(teamOrders.shipTransactionId)),
    db.select().from(orders).where(isNotNull(orders.shipTransactionId)),
  ]);
  const txns: string[] = [];
  for (const o of torders) {
    if (o.archivedAt || ["shipped", "cancelled"].includes(o.status) || !isUsps(o.shipCarrier)) continue;
    if (o.shipTransactionId) txns.push(o.shipTransactionId);
    for (const s of o.additionalShipments ?? []) if (s.transactionId && isUsps(s.carrier ?? null)) txns.push(s.transactionId);
  }
  for (const o of shopOrders) {
    if (o.status !== "paid" || !isUsps(o.shipCarrier)) continue;
    if (o.shipTransactionId) txns.push(o.shipTransactionId);
    for (const s of o.additionalShipments ?? []) if (s.transactionId && isUsps(s.carrier ?? null)) txns.push(s.transactionId);
  }
  return txns;
}

// Schedule a FREE USPS pickup at the shop. Two modes:
//   - batch: one pickup covering every ready USPS label (the pickup page)
//   - single order: primary + additional labels on one order (order pages)
// UPS charges for pickups, so this is USPS-only.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { mode?: string; kind?: string; id?: string; date?: string } = {};
  try { body = await req.json(); } catch {}
  const date = (body.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Pick a pickup date." }, { status: 400 });

  const db = getDb();
  let txns: string[] = [];

  if (body.mode === "batch") {
    txns = await readyUspsTransactions(db);
    if (txns.length === 0) return NextResponse.json({ error: "No USPS packages are waiting for pickup." }, { status: 400 });
  } else {
    const kind = body.kind === "team_order" ? "team_order" : body.kind === "order" ? "order" : null;
    if (!kind || !body.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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
  }

  const result = await scheduleUspsPickup(txns, date);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, confirmation: result.confirmation, alreadyScheduled: result.alreadyScheduled ?? false, count: txns.length });
}
