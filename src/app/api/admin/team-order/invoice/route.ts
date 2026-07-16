import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { taxCents, SALES_TAX_LABEL } from "@/lib/pricing";
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
  // Roster recap goes on every invoice so the coach can reference exactly
  // what they're paying for.
  const roster = await getRoster(order.id);

  let totalCents = order.quotedTotalCents ?? 0;
  let quoteLines: { label: string; quantity: number; unitPriceCents: number; totalCents: number }[] = [];
  if (stage === "deposit") {
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
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
    // Collect the delivery address on the payment page unless we already have
    // one - it's required for buying the shipping label later.
    const needsAddress = !order.shippingAddress?.line1;
    const exempt = order.taxExempt;
    // Each link charges the goods + 7% FL sales tax (skipped when tax-exempt).
    const makeLink = async (name: string, goodsCents: number, linkStage: string, extraMeta: Record<string, string> = {}) => {
      const goodsPrice = await stripe.prices.create({
        currency: "usd",
        unit_amount: goodsCents,
        product_data: { name },
      });
      const items = [{ price: goodsPrice.id, quantity: 1 }];
      if (!exempt && taxCents(goodsCents) > 0) {
        const taxPrice = await stripe.prices.create({
          currency: "usd",
          unit_amount: taxCents(goodsCents),
          product_data: { name: SALES_TAX_LABEL },
        });
        items.push({ price: taxPrice.id, quantity: 1 });
      }
      return stripe.paymentLinks.create({
        line_items: items,
        restrictions: { completed_sessions: { limit: 1 } },
        ...(needsAddress ? { shipping_address_collection: { allowed_countries: ["US"] } } : {}),
        metadata: { kind: "team_order_invoice", stage: linkStage, teamOrderId: order.id, teamName: order.teamName, ...extraMeta },
        after_completion: { type: "redirect", redirect: { url: `${SITE}/checkout/success` } },
      });
    };

    let link;
    let fullLink = null;
    if (stage === "deposit") {
      // Deposit + a pay-in-full sibling. Whichever is paid first deactivates
      // the other (via siblingLinkId in the webhook) so nobody double-pays.
      link = await makeLink(`50% Production Deposit — ${order.teamName} (${order.reference})`, dueCents, "deposit");
      fullLink = await makeLink(`Pay in Full — ${order.teamName} (${order.reference})`, totalCents, "full", { siblingLinkId: link.id });
      await stripe.paymentLinks.update(link.id, { metadata: { ...link.metadata, siblingLinkId: fullLink.id } });
    } else {
      link = await makeLink(`Final Balance — ${order.teamName} (${order.reference})`, dueCents, "balance");
    }

    await db
      .update(teamOrders)
      .set({
        ...(stage === "deposit"
          ? { status: "quoted", quotedTotalCents: totalCents, depositCents, invoiceUrl: link.url, fullInvoiceUrl: fullLink?.url ?? null }
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
      taxDueCents: order.taxExempt ? 0 : taxCents(dueCents),
      taxExempt: order.taxExempt,
      roster: roster.map((r) => ({
        name: (r.playerName ?? "").trim(),
        number: (r.playerNumber ?? "").trim(),
        size: (r.sizes?.jersey ?? r.size ?? "").trim(),
      })),
      payUrl: link.url,
      payFullUrl: fullLink?.url ?? undefined,
    });

    return NextResponse.json({ ok: true, stage, totalCents, dueCents, taxDueCents: order.taxExempt ? 0 : taxCents(dueCents), invoiceUrl: link.url, fullInvoiceUrl: fullLink?.url, emailed });
  } catch (e) {
    console.error("send invoice failed:", e);
    return NextResponse.json({ error: "Could not create the invoice" }, { status: 500 });
  }
}
