import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { emailTeamOrderInvoice } from "@/lib/email";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: price the roster from the public price list and email the coach
// a one-time Stripe Payment Link (a checkout session would expire in 24h;
// payment links don't).
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled() || !stripeEnabled()) {
    return NextResponse.json({ error: "Database or Stripe not configured" }, { status: 503 });
  }

  let body: { teamOrderId?: string; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamOrderId) return NextResponse.json({ error: "Missing teamOrderId" }, { status: 400 });

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Team order not found" }, { status: 404 });
  if (order.status === "paid" || order.invoicePaidAt) {
    return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
  }

  const roster = await getRoster(order.id);
  if (roster.length === 0) {
    return NextResponse.json({ error: "Roster is empty - nothing to invoice." }, { status: 400 });
  }
  const quote = computeTeamOrderQuote(order, roster);
  if (quote.totalCents <= 0) {
    return NextResponse.json({ error: "Could not price this roster - quote it manually." }, { status: 400 });
  }

  // Preview mode: return the math without creating anything or emailing.
  if (body.dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, quote });
  }

  try {
    const stripe = getStripe();
    // Payment Links require real Price objects (price_data isn't supported).
    const lineItems = [];
    for (const l of quote.lines) {
      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: l.unitPriceCents,
        product_data: { name: `${l.label} — ${order.teamName} (${order.reference})` },
      });
      lineItems.push({ price: price.id, quantity: l.quantity });
    }
    if (quote.rushFeeCents > 0) {
      const rush = await stripe.prices.create({
        currency: "usd",
        unit_amount: quote.rushFeeCents,
        product_data: { name: `Rush production — ${order.reference}` },
      });
      lineItems.push({ price: rush.id, quantity: 1 });
    }

    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
    const link = await stripe.paymentLinks.create({
      line_items: lineItems,
      restrictions: { completed_sessions: { limit: 1 } },
      metadata: { kind: "team_order_invoice", teamOrderId: order.id, teamName: order.teamName },
      after_completion: { type: "redirect", redirect: { url: `${SITE}/checkout/success` } },
    });

    await db
      .update(teamOrders)
      .set({ status: "quoted", quotedTotalCents: quote.totalCents, invoiceUrl: link.url, updatedAt: new Date() })
      .where(eq(teamOrders.id, order.id));

    const emailed = await emailTeamOrderInvoice({
      to: order.contactEmail,
      teamName: order.teamName,
      reference: order.reference,
      lines: quote.lines,
      rushFeeCents: quote.rushFeeCents,
      totalCents: quote.totalCents,
      payUrl: link.url,
    });

    return NextResponse.json({ ok: true, quote, invoiceUrl: link.url, emailed });
  } catch (e) {
    console.error("send invoice failed:", e);
    return NextResponse.json({ error: "Could not create the invoice" }, { status: 500 });
  }
}
