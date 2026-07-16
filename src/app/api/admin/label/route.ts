import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, orders } from "@/db/schema";
import { getLabelRates, buyLabel, shippoEnabled, labelReady } from "@/lib/shippo";
import { markShipped } from "@/lib/fulfillment";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

type Addr = { name: string; street1: string; street2?: string; city: string; state: string; zip: string };

async function addressFor(kind: "team_order" | "order", id: string): Promise<Addr | null> {
  const db = getDb();
  if (kind === "order") {
    const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    const a = o?.shippingAddress;
    if (!o || !a?.line1 || !a.city || !a.state || !a.postalCode) return null;
    return { name: o.customerName ?? "Customer", street1: a.line1, street2: a.line2 ?? undefined, city: a.city, state: a.state, zip: a.postalCode };
  }
  const [t] = await db.select().from(teamOrders).where(eq(teamOrders.id, id)).limit(1);
  const a = t?.shippingAddress;
  if (!t || !a?.line1 || !a.city || !a.state || !a.postalCode) return null;
  return { name: t.contactName, street1: a.line1, street2: a.line2 ?? undefined, city: a.city, state: a.state, zip: a.postalCode };
}

// Two-step label buying (admin-only):
//   { action: "quote", kind, id, weightOz }        -> cheapest USPS/UPS rate
//   { action: "buy",   kind, id, rateId }          -> purchases the label,
//     saves tracking, flips status, emails the customer, returns label PDF url
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  if (!shippoEnabled()) return NextResponse.json({ error: "Shippo isn't configured (SHIPPO_API_KEY)." }, { status: 503 });

  let body: { action?: string; kind?: string; id?: string; weightOz?: number; rateId?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const kind = body.kind === "team_order" ? "team_order" : body.kind === "order" ? "order" : null;
  if (!kind || !body.id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (body.action === "quote") {
    if (!labelReady()) {
      return NextResponse.json(
        { error: "Add your ship-from street address first (SHIP_FROM_STREET env var) so labels print correctly." },
        { status: 409 },
      );
    }
    const weightOz = Math.max(1, Math.min(1120, Number(body.weightOz) || 16));
    const to = await addressFor(kind, body.id);
    if (!to) {
      return NextResponse.json(
        { error: "No shipping address on file for this order - use manual Mark shipped with a Pirate Ship label." },
        { status: 409 },
      );
    }
    try {
      const rates = await getLabelRates(to, weightOz);
      if (rates.length === 0) return NextResponse.json({ error: "No USPS/UPS rates returned." }, { status: 502 });
      // Show a spread of speeds, not just the cheapest few: keep the two
      // cheapest, then add distinct faster services by delivery estimate.
      const byDays = [...rates].sort((a, b) => (a.estimatedDays ?? 99) - (b.estimatedDays ?? 99));
      const picked = new Map<string, (typeof rates)[number]>();
      for (const r of rates.slice(0, 2)) picked.set(r.rateId, r);
      for (const r of byDays) {
        if (picked.size >= 6) break;
        picked.set(r.rateId, r);
      }
      return NextResponse.json({ ok: true, to, rates: Array.from(picked.values()) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  if (body.action === "buy") {
    if (!body.rateId) return NextResponse.json({ error: "Missing rateId" }, { status: 400 });
    try {
      const label = await buyLabel(body.rateId);
      const shipped = await markShipped(kind, body.id, label.trackingNumber, label.labelUrl);
      return NextResponse.json({
        ok: true,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        costCents: label.costCents,
        emailed: shipped?.emailed ?? false,
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
