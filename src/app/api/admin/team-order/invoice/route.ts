import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote, estimateOrderWeightOz } from "@/lib/team-order-pricing";
import { taxCents, SALES_TAX_LABEL } from "@/lib/pricing";
import { emailTeamOrderInvoice } from "@/lib/email";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { isAdmin } from "@/lib/admin-auth";
import { getCustomer } from "@/lib/customers";

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

  let body: { teamOrderId?: string; stage?: string; ship?: "auto" | "pickup"; shipWeightOz?: number } = {};
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

  // One-time embroidery fee: if a SIBLING order of the same design already
  // paid an invoice that included hats, the digitizing was already covered -
  // auto-waive it here (persisted, so estimates agree afterwards).
  const hasHats = (rows: { sizes?: Record<string, string> | null }[]) =>
    rows.some((r) => Object.entries(r.sizes ?? {}).some(([k, v]) => (k === "fitted_hat" || k === "snapback_hat") && (v ?? "").trim()));
  if (!order.embroideryFeeWaived && order.designRequestId && hasHats(roster)) {
    const { ne, and, isNotNull, or } = await import("drizzle-orm");
    const sibs = await db
      .select({ id: teamOrders.id })
      .from(teamOrders)
      .where(and(
        eq(teamOrders.designRequestId, order.designRequestId),
        ne(teamOrders.id, order.id),
        or(isNotNull(teamOrders.depositPaidAt), isNotNull(teamOrders.invoicePaidAt)),
      ));
    for (const s of sibs) {
      if (hasHats(await getRoster(s.id))) {
        await db.update(teamOrders).set({ embroideryFeeWaived: true }).where(eq(teamOrders.id, order.id));
        order.embroideryFeeWaived = true;
        break;
      }
    }
  }

  let totalCents = order.quotedTotalCents ?? 0;
  let quoteLines: { label: string; quantity: number; unitPriceCents: number; totalCents: number }[] = [];
  if (stage === "deposit") {
    if (roster.length === 0) return NextResponse.json({ error: "Roster is empty - nothing to invoice." }, { status: 400 });
    const quote = computeTeamOrderQuote(order, roster);
    if (quote.totalCents <= 0) return NextResponse.json({ error: "Could not price this roster - quote it manually." }, { status: 400 });
    totalCents = quote.totalCents;
    quoteLines = quote.lines;
    if (quote.rushFeeCents > 0) {
      quoteLines = [...quote.lines, { label: "Rush Order Fee (priority production + direct shipping)", quantity: 1, unitPriceCents: quote.rushFeeCents, totalCents: quote.rushFeeCents }];
    }
  }
  if (totalCents <= 0) return NextResponse.json({ error: "No quoted total on file." }, { status: 400 });

  const depositCents = stage === "deposit" ? Math.round(totalCents / 2) : order.depositCents ?? Math.round(totalCents / 2);
  const dueCents = stage === "deposit" ? depositCents : totalCents - depositCents;

  // Shipping charged to the customer (final invoice only). The package weight
  // is computed automatically from the roster (we know every item's weight),
  // so shipping is deterministic - no manual entry. "pickup" = $0. A manual
  // shipWeightOz still overrides if ever needed.
  let shipCents = 0;
  // Explicit choice from the modal wins; otherwise a local-pickup order
  // defaults to no shipping.
  const wantShip = stage === "balance" && (body.ship ? body.ship !== "pickup" : !order.localPickup);
  if (wantShip) {
    const weightOz = body.shipWeightOz && body.shipWeightOz > 0 ? Math.round(body.shipWeightOz) : estimateOrderWeightOz(roster);
    if (weightOz > 0) {
      const zip = order.shippingAddress?.postalCode;
      if (!zip) {
        return NextResponse.json({ error: "No shipping address on file - collect one or use local pickup." }, { status: 409 });
      }
      try {
        const { quoteChargedShipping, shippoEnabled } = await import("@/lib/shippo");
        if (shippoEnabled()) {
          const q = await quoteChargedShipping(zip, Math.min(1120, weightOz));
          if (q) shipCents = q.chargedCents;
        }
      } catch (e) {
        console.error("invoice shipping quote failed:", e);
      }
      if (shipCents === 0) {
        const { shippingCentsFor } = await import("@/lib/team-stores");
        shipCents = shippingCentsFor(weightOz); // formula fallback
      }
    }
  }

  // The "pay in full" option (offered at the deposit stage) must ALSO include
  // shipping, so paying everything upfront covers it. There's often no address
  // yet at this point, so we charge the weight-based formula amount (a shippo
  // quote if an address happens to be on file); local-pickup orders stay $0.
  let fullShipCents = 0;
  if (stage === "deposit" && !(body.ship ? body.ship === "pickup" : order.localPickup)) {
    const weightOz = body.shipWeightOz && body.shipWeightOz > 0 ? Math.round(body.shipWeightOz) : estimateOrderWeightOz(roster);
    if (weightOz > 0) {
      const zip = order.shippingAddress?.postalCode;
      if (zip) {
        try {
          const { quoteChargedShipping, shippoEnabled } = await import("@/lib/shippo");
          if (shippoEnabled()) {
            const q = await quoteChargedShipping(zip, Math.min(1120, weightOz));
            if (q) fullShipCents = q.chargedCents;
          }
        } catch (e) {
          console.error("pay-in-full shipping quote failed:", e);
        }
      }
      if (fullShipCents === 0) {
        const { shippingCentsFor } = await import("@/lib/team-stores");
        fullShipCents = shippingCentsFor(weightOz);
      }
    }
  }

  // Referral store credit the coach has banked. Applied to the pay-in-full and
  // final-balance links (never the partial 50% deposit), reducing the goods and
  // the tax on them. Capped so at least $1 is still charged, and decremented
  // from the balance in the webhook when the link is actually paid.
  const bankedCredit = (await getCustomer(order.contactEmail))?.referralCreditCents ?? 0;
  const creditFor = (goods: number) => (bankedCredit > 0 ? Math.max(0, Math.min(bankedCredit, goods - 100)) : 0);
  const creditForFull = stage === "deposit" ? creditFor(totalCents) : 0;
  const creditForBalance = stage === "balance" ? creditFor(dueCents) : 0;

  try {
    const stripe = getStripe();
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
    // Collect the delivery address on the payment page unless we already have
    // one - it's required for buying the shipping label later.
    const needsAddress = !order.shippingAddress?.line1;
    const exempt = order.taxExempt;
    // Each link charges the goods + 7% FL sales tax (skipped when tax-exempt).
    // creditCents is subtracted from the goods (and the tax base) before the
    // Stripe prices are built, so the customer pays the discounted amount.
    const makeLink = async (name: string, goodsCents: number, linkStage: string, extraMeta: Record<string, string> = {}, shippingCents = 0, creditCents = 0) => {
      const netGoods = Math.max(0, goodsCents - creditCents);
      const goodsPrice = await stripe.prices.create({
        currency: "usd",
        unit_amount: netGoods,
        product_data: { name: creditCents > 0 ? `${name} (incl. $${(creditCents / 100).toFixed(2)} referral credit)` : name },
      });
      const items = [{ price: goodsPrice.id, quantity: 1 }];
      if (!exempt && taxCents(netGoods) > 0) {
        const taxPrice = await stripe.prices.create({
          currency: "usd",
          unit_amount: taxCents(netGoods),
          product_data: { name: SALES_TAX_LABEL },
        });
        items.push({ price: taxPrice.id, quantity: 1 });
      }
      if (shippingCents > 0) {
        const shipPrice = await stripe.prices.create({
          currency: "usd",
          unit_amount: shippingCents,
          product_data: { name: "Shipping" },
        });
        items.push({ price: shipPrice.id, quantity: 1 });
      }
      return stripe.paymentLinks.create({
        line_items: items,
        restrictions: { completed_sessions: { limit: 1 } },
        ...(needsAddress ? { shipping_address_collection: { allowed_countries: ["US"] } } : {}),
        metadata: { kind: "team_order_invoice", stage: linkStage, teamOrderId: order.id, teamName: order.teamName, ...(creditCents > 0 ? { creditAppliedCents: String(creditCents) } : {}), ...extraMeta },
        after_completion: { type: "redirect", redirect: { url: `${SITE}/checkout/success` } },
      });
    };

    let link;
    let fullLink = null;
    if (stage === "deposit") {
      // Deposit + a pay-in-full sibling. Whichever is paid first deactivates
      // the other (via siblingLinkId in the webhook) so nobody double-pays.
      // Credit rides on the pay-in-full link only (the deposit is partial).
      link = await makeLink(`50% Production Deposit - ${order.teamName} (${order.reference})`, dueCents, "deposit");
      fullLink = await makeLink(`Pay in Full - ${order.teamName} (${order.reference})`, totalCents, "full", { siblingLinkId: link.id, shipCents: String(fullShipCents) }, fullShipCents, creditForFull);
      await stripe.paymentLinks.update(link.id, { metadata: { ...link.metadata, siblingLinkId: fullLink.id } });
    } else {
      link = await makeLink(`Final Balance - ${order.teamName} (${order.reference})`, dueCents, "balance", {}, shipCents, creditForBalance);
    }

    await db
      .update(teamOrders)
      .set({
        ...(stage === "deposit"
          ? { status: "quoted", quotedTotalCents: totalCents, depositCents, invoiceUrl: link.url, fullInvoiceUrl: fullLink?.url ?? null }
          : { balanceInvoiceUrl: link.url, shippingChargedCents: shipCents }),
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
      taxDueCents: order.taxExempt ? 0 : taxCents(dueCents - creditForBalance),
      taxExempt: order.taxExempt,
      shipCents,
      creditAppliedCents: creditForBalance,
      payFullCreditCents: creditForFull,
      localPickup: order.localPickup,
      roster: roster.map((r) => ({
        name: (r.playerName ?? "").trim(),
        number: (r.playerNumber ?? "").trim(),
        size: (r.sizes?.jersey ?? r.size ?? "").trim(),
      })),
      payUrl: link.url,
      payFullUrl: fullLink?.url ?? undefined,
      payFullCents: fullLink ? (totalCents - creditForFull) + (order.taxExempt ? 0 : taxCents(totalCents - creditForFull)) + fullShipCents : undefined,
    });

    return NextResponse.json({ ok: true, stage, totalCents, dueCents, shipCents, creditAppliedCents: creditForBalance || creditForFull, taxDueCents: order.taxExempt ? 0 : taxCents((stage === "balance" ? dueCents - creditForBalance : dueCents)), invoiceUrl: link.url, fullInvoiceUrl: fullLink?.url, emailed });
  } catch (e) {
    console.error("send invoice failed:", e);
    return NextResponse.json({ error: "Could not create the invoice" }, { status: 500 });
  }
}
