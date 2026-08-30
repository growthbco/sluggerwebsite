import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, orders } from "@/db/schema";
import { trackingUrlFor, trackingUrlForCarrier } from "@/lib/tracking";

export const runtime = "nodejs";

const TEAM_STATUS: Record<string, string> = {
  draft: "Building your roster",
  collecting: "Collecting players",
  submitted: "Roster received - we're getting your quote ready",
  quoted: "Invoice sent - awaiting your deposit",
  in_production: "In production (3-week standard target)",
  paid: "Paid in full - preparing to ship",
  shipped: "Shipped",
  cancelled: "Cancelled",
};

const SHOP_STATUS: Record<string, string> = {
  pending: "Payment processing",
  paid: "Paid - in production",
  fulfilled: "Shipped",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

// Public order lookup. Requires BOTH the reference and the email that placed
// it, so orders can't be enumerated by reference alone.
export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: "Not available" }, { status: 503 });

  let body: { reference?: string; email?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const reference = (body.reference ?? "").trim().toUpperCase();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!reference || !email) {
    return NextResponse.json({ error: "Enter your order number and the email you used." }, { status: 400 });
  }

  const db = getDb();
  const notFound = NextResponse.json(
    { error: "No order matches that number and email. Double-check both, or text us at (352) 414-7270." },
    { status: 404 },
  );

  if (reference.startsWith("TO-")) {
    const [o] = await db
      .select()
      .from(teamOrders)
      .where(and(eq(teamOrders.reference, reference), sql`lower(${teamOrders.contactEmail}) = ${email}`))
      .limit(1);
    if (!o) return notFound;
    return NextResponse.json({
      ok: true,
      reference: o.reference,
      team: o.teamName.trim(),
      status: TEAM_STATUS[o.status] ?? o.status,
      shipped: Boolean(o.shippedAt),
      tracking: o.trackingNumber ? { number: o.trackingNumber, url: trackingUrlForCarrier(o.trackingNumber, o.shipCarrier) } : null,
    });
  }

  // Shop / store orders (SA-xxxx).
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.reference, reference), sql`lower(${orders.customerEmail}) = ${email}`))
    .limit(1);
  if (!o) return notFound;
  return NextResponse.json({
    ok: true,
    reference: o.reference,
    team: o.customerName ?? "Your order",
    status: SHOP_STATUS[o.status] ?? o.status,
    shipped: Boolean(o.shippedAt),
    tracking: o.trackingNumber ? { number: o.trackingNumber, url: trackingUrlFor(o.trackingNumber) } : null,
  });
}
