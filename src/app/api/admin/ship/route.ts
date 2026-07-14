import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, orders } from "@/db/schema";
import { emailOrderShipped } from "@/lib/email";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Pirate Ship labels are mostly USPS; UPS numbers start with 1Z.
function trackingUrlFor(num: string): string {
  const n = num.replace(/\s/g, "");
  if (/^1Z/i.test(n)) return `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`;
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`;
}

// Admin-only: record the tracking number, flip the status, email the customer.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { kind?: string; id?: string; trackingNumber?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const tracking = (body.trackingNumber ?? "").trim().slice(0, 60);
  if (!body.id || !tracking || !["team_order", "order"].includes(body.kind ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();

  if (body.kind === "team_order") {
    const [row] = await db
      .update(teamOrders)
      .set({ status: "shipped", trackingNumber: tracking, shippedAt: now, updatedAt: now })
      .where(eq(teamOrders.id, body.id))
      .returning({ reference: teamOrders.reference, email: teamOrders.contactEmail, name: teamOrders.contactName });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const emailed = await emailOrderShipped({
      to: row.email,
      name: row.name,
      reference: row.reference,
      trackingNumber: tracking,
      trackingUrl: trackingUrlFor(tracking),
    });
    return NextResponse.json({ ok: true, emailed });
  }

  const [row] = await db
    .update(orders)
    .set({ status: "fulfilled", trackingNumber: tracking, shippedAt: now })
    .where(eq(orders.id, body.id))
    .returning({ reference: orders.reference, email: orders.customerEmail, name: orders.customerName });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const emailed = row.email
    ? await emailOrderShipped({
        to: row.email,
        name: row.name,
        reference: row.reference,
        trackingNumber: tracking,
        trackingUrl: trackingUrlFor(tracking),
      })
    : false;
  return NextResponse.json({ ok: true, emailed });
}
