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

// Admin-only, two-stage invoicing:
//   stage "deposit" - 50% of the roster total; production starts on payment
//   stage "balance" - the remaining half, sent when the order is ready
// Each is a one-time Stripe Payment Link (checkout sessions expire in 24h;
// payment links don't).
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled() || !stripeEnabled()) {
    return NextResponse.json({ error: "Database or Stripe not configured" }, { status: 503 });
  }

  let body: { teamOrderId?: string; stage?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const stage = body.stage === "balance" ? "balance" : "deposit";
  if (!body.teamOrderId) return NextResponse.json({ error: "Missing teamOrderId" }, { status: 400 });

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Team order not found" }, { status: 404 });
  if (order.invoicePaidAt) return NextResponse.json({ error: "This order is already paid in full." }, { status: 409 });
  if (stage === "deposit" && order.depositPaidAt) {
    return NextResponse.json({ error: "Deposit already paid - send the final invoice instead." }, { status: 409 });
  }
  if (stage === "balance" && !order.depositPaidAt) {
    return NextResponse.json({ error: "Send (and collect) the 50% deposit first." }, { status: 409 });
  }

  // Price from the roster; the balance stage reuses the locked-in quote so a
  // late roster edit can't silently change what was already deposited against.
  let totalCents = order.quotedTotalCents ?? 0;
  let quoteLines: { label: string; quantity: number; unitPriceCents: number; totalCents: number }[] = [];
  if (stage === "deposit") {
    const roster = await getRoster(order.id);
    if (roster.length === 0) return NextResponse.json({ error: "Roster is empty - nothing to invoice." }, { status: 400 });
    const quote = computeTeamOrderQuote(order, roster);
    if (quote.totalCents <= 0) return NextResponse.json({ error: "Could not price this roster - quote it manually." }, { status: 400 });
    totalCents = quote.totalCents;
    quoteLines = quote.lines;
    if (quote.rushFeeCents > 0) {
      quoteLines = [...quote.lines, { label: "Rush production ($5/item)", quantity: 1, unitPriceCents: quote.rushFeeCents, totalCents: quote.rushFeeCents }];
    }
  }
  if (totalCents <= 0) return NextResponse.json({ error: "No quoted total on file." }, { status: 400 });

  const depositCents = stage === "deposit" ? Math.round(totalCents / 2) : order.depositCents ?? Math.round(totalCents / 2);
  const dueCents = stage === "deposit" ? depositCents : totalCents - depositCents;

  try {
    const stripe = getStripe();
    const label =
      stage === "deposit"
        ? `50% Production Deposit — ${order.teamName} (${order.reference})`
        : `Final Balance — ${order.teamName} (${order.reference})`;
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: dueCents,
      product_data: { name: label },
    });
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      restrictions: { completed_sessions: { limit: 1 } },
      metadata: { kind: "team_order_invoice", stage, teamOrderId: order.id, teamName: order.teamName },
      after_completion: { type: "redirect", redirect: { url: `${SITE}/checkout/success` } },
    });

    await db
      .update(teamOrders)
      .set({
        ...(stage === "deposit"
          ? { status: "quoted", quotedTotalCents: totalCents, depositCents, invoiceUrl: link.url }
          : { balanceInvoiceUrl: link.url }),
        invoiceRemindersSent: 0,
        lastInvoiceReminderAt: null,
        updatedAt: new Date(),
      })
      .where(eq(teamOrders.id, order.id));

    const emailed = await emailTeamOrderInvoice({
      to: order.contactEmail,
      teamName: order.teamName,
      reference: order.reference,
      stage,
      lines: quoteLines,
      totalCents,
      dueCents,
      payUrl: link.url,
    });

    return NextResponse.json({ ok: true, stage, totalCents, dueCents, invoiceUrl: link.url, emailed });
  } catch (e) {
    console.error("send invoice failed:", e);
    return NextResponse.json({ error: "Could not create the invoice" }, { status: 500 });
  }
}
