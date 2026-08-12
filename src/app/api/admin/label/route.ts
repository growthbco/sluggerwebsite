import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, orders } from "@/db/schema";
import { getLabelRates, buyLabel, shippoEnabled, labelReady } from "@/lib/shippo";
import { saveLabelPurchase } from "@/lib/fulfillment";
import { requireApiRole } from "@/lib/admin-auth";

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
//   { action: "buy",   kind, id, rateId }          -> purchases the label and
//     saves tracking + PDF. Does NOT ship or email - "Mark shipped" does that.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  if (!shippoEnabled()) return NextResponse.json({ error: "Shippo isn't configured (SHIPPO_API_KEY)." }, { status: 503 });

  let body: { action?: string; kind?: string; id?: string; weightOz?: number; rateId?: string; additional?: boolean; note?: string } = {};
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
      // rates come sorted cheapest-first. Guarantee a useful spread:
      //   - the cheapest option from EACH carrier (so USPS ground always shows
      //     next to UPS, not just whichever carrier happens to win on price),
      //   - the overall two cheapest,
      //   - the single fastest express option,
      // then fill remaining slots with the next-cheapest, capped at 6.
      const picked = new Map<string, (typeof rates)[number]>();
      const add = (r?: (typeof rates)[number]) => { if (r && picked.size < 6) picked.set(r.rateId, r); };
      // Cheapest per provider.
      for (const provider of [...new Set(rates.map((r) => r.provider))]) {
        add(rates.find((r) => r.provider === provider));
      }
      // Overall two cheapest.
      add(rates[0]);
      add(rates[1]);
      // Fastest (lowest estimatedDays), useful for rush.
      add([...rates].sort((a, b) => (a.estimatedDays ?? 99) - (b.estimatedDays ?? 99))[0]);
      // Fill the rest by price.
      for (const r of rates) add(r);
      const out = Array.from(picked.values()).sort((a, b) => a.costCents - b.costCents);
      return NextResponse.json({ ok: true, to, rates: out });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  if (body.action === "buy") {
    if (!body.rateId) return NextResponse.json({ error: "Missing rateId" }, { status: 400 });
    try {
      const label = await buyLabel(body.rateId);
      if (body.additional === true) {
        // A SECOND parcel on an order that already has a primary label
        // (second box, reship, hats going separately). Append it and email
        // the customer this tracking right away - this box is going out now.
        const { appendAdditionalShipment } = await import("@/lib/fulfillment");
        const sent = await appendAdditionalShipment(kind, body.id, label.trackingNumber, label.labelUrl, (body.note ?? "").trim().slice(0, 80) || undefined, label.transactionId);
        return NextResponse.json({
          ok: true,
          additional: true,
          trackingNumber: label.trackingNumber,
          labelUrl: label.labelUrl,
          costCents: label.costCents,
          provider: label.provider,
          emailed: sent,
        });
      }
      // Primary label: save tracking, but don't ship or email yet - buying the
      // label ahead of time is a separate step from actually sending the box.
      await saveLabelPurchase(kind, body.id, label.trackingNumber, label.labelUrl, label.transactionId, label.provider);
      return NextResponse.json({
        ok: true,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        costCents: label.costCents,
        provider: label.provider,
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
