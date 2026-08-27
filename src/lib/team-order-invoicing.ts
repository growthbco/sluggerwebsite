// Two-stage team-order invoicing, shared by the admin "Send invoice" button
// and the auto-invoice that fires when a roster is submitted:
//   stage "deposit" - 50% of the roster total; production starts on payment
//   stage "balance" - the remaining half, sent when the order is ready
// Each is a one-time Stripe Payment Link (checkout sessions expire in 24h;
// payment links don't).

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getRoster, invoiceRosterEntries, ensureTeamOrderDiscordThread } from "@/lib/team-orders";
import { computeTeamOrderQuote, estimateOrderParcelsOz } from "@/lib/team-order-pricing";
import { taxCents, SALES_TAX_LABEL } from "@/lib/pricing";
import { emailTeamOrderInvoice } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { getCustomer } from "@/lib/customers";
import { smsIfConsented } from "@/lib/sms";

export type InvoiceResult =
  | { ok: true; stage: string; totalCents: number; dueCents: number; shipCents: number; creditAppliedCents: number; taxDueCents: number; invoiceUrl: string | null; fullInvoiceUrl?: string; emailed: boolean; teamName: string; reference: string }
  | { ok: false; error: string; status: number };

export async function sendTeamOrderInvoice(opts: {
  teamOrderId: string;
  stage: "deposit" | "balance";
  ship?: "auto" | "pickup";
  shipWeightOz?: number;
}): Promise<InvoiceResult> {
  const stage = opts.stage === "balance" ? "balance" : "deposit";
  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, opts.teamOrderId)).limit(1);
  if (!order) return { ok: false as const, error: "Team order not found", status: 404 };
  if (order.invoicePaidAt) return { ok: false as const, error: "This order is already paid in full.", status: 409 };
  if (stage === "deposit" && order.depositPaidAt) {
    return { ok: false as const, error: "Deposit already paid - send the final invoice instead.", status: 409 };
  }
  if (stage === "balance" && !order.depositPaidAt) {
    return { ok: false as const, error: "Send (and collect) the 50% deposit first.", status: 409 };
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
    if (roster.length === 0) return { ok: false as const, error: "Roster is empty - nothing to invoice.", status: 400 };
    const quote = computeTeamOrderQuote(order, roster);
    if (quote.totalCents <= 0) return { ok: false as const, error: "Could not price this roster - quote it manually.", status: 400 };
    totalCents = quote.totalCents;
    quoteLines = quote.lines;
    if (quote.rushFeeCents > 0) {
      quoteLines = [...quote.lines, { label: "Rush Order Fee (priority production + direct shipping)", quantity: 1, unitPriceCents: quote.rushFeeCents, totalCents: quote.rushFeeCents }];
    }
  }
  if (totalCents <= 0) return { ok: false as const, error: "No quoted total on file.", status: 400 };

  const depositCents = stage === "deposit" ? Math.round(totalCents / 2) : order.depositCents ?? Math.round(totalCents / 2);
  const dueCents = stage === "deposit" ? depositCents : totalCents - depositCents;

  // Shipping charged to the customer (final invoice only). The package weight
  // is computed automatically from the roster (we know every item's weight),
  // so shipping is deterministic - no manual entry. "pickup" = $0. A manual
  // shipWeightOz still overrides if ever needed.
  let shipCents = 0;
  // Explicit choice from the modal wins; otherwise a local-pickup order
  // defaults to no shipping.
  // Hats ship in their own box, so a mixed hats+apparel order is TWO parcels
  // - each quoted (and charged) separately. A manual shipWeightOz override is
  // trusted as a single staff-decided parcel.
  const parcelsFor = (): number[] => {
    if (opts.shipWeightOz && opts.shipWeightOz > 0) return [Math.round(opts.shipWeightOz)];
    const p = estimateOrderParcelsOz(roster);
    return [p.apparelOz, p.hatOz].filter((w) => w > 0);
  };
  const wantShip = stage === "balance" && (opts.ship ? opts.ship !== "pickup" : !order.localPickup);
  if (wantShip) {
    // A pre-set amount is an intentional staff override (for example, a
    // customer-approved rush shipment). Preserve it when the final invoice is
    // generated instead of silently replacing it with the normal ground quote.
    if (order.shippingChargedCents != null && !opts.shipWeightOz) {
      shipCents = order.shippingChargedCents;
    } else {
      const parcels = parcelsFor();
      if (parcels.length > 0) {
        const zip = order.shippingAddress?.postalCode;
        if (!zip) {
          return { ok: false as const, error: "No shipping address on file - collect one or use local pickup.", status: 409 };
        }
        const { quoteShippingCents } = await import("@/lib/ship-quote");
        for (const w of parcels) {
          shipCents += (await quoteShippingCents(zip, w)).chargedCents;
        }
      }
    }
  }

  // The "pay in full" option (offered at the deposit stage) must ALSO include
  // shipping, so paying everything upfront covers it. There's often no address
  // yet at this point, so we charge the weight-based formula amount (a shippo
  // quote if an address happens to be on file); local-pickup orders stay $0.
  let fullShipCents = 0;
  if (stage === "deposit" && !(opts.ship ? opts.ship === "pickup" : order.localPickup)) {
    // quoteShippingCents falls back to the weight formula when there's no zip
    // on file yet - same per-parcel math either way.
    const zip = order.shippingAddress?.postalCode ?? "";
    const { quoteShippingCents } = await import("@/lib/ship-quote");
    for (const w of parcelsFor()) {
      fullShipCents += (await quoteShippingCents(zip, w)).chargedCents;
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

  // Plain-English summary shown under the amount on the Stripe checkout page,
  // so the coach sees what the payment buys and how the two stages work - not
  // a bare dollar figure. Goods breakdown comes from the priced quote (deposit
  // stage); the balance link just needs the closing terms.
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const goodsSummary = quoteLines
    .filter((l) => !/rush order fee|embroider|digitiz/i.test(l.label))
    .map((l) => `${l.quantity}x ${l.label}`)
    .join(", ");
  const balanceRemaining = totalCents - depositCents;
  const withSummary = (terms: string) => (goodsSummary ? `${goodsSummary}. ${terms}` : terms);
  const depositDesc = withSummary(
    `This is your 50% production deposit. The remaining ${money(balanceRemaining)} plus shipping is billed once your order is ready. Production starts as soon as this deposit is paid.`,
  );
  const fullDesc = withSummary(
    "Pays your order in full including shipping, so there is nothing left to collect later. Production starts right away.",
  );
  const balanceDesc = withSummary(
    "Final balance for your order, including shipping. This clears your account in full.",
  );

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
    const makeLink = async (name: string, goodsCents: number, linkStage: string, extraMeta: Record<string, string> = {}, shippingCents = 0, creditCents = 0, description?: string) => {
      const netGoods = Math.max(0, goodsCents - creditCents);
      const goodsName = creditCents > 0 ? `${name} (incl. $${(creditCents / 100).toFixed(2)} credit)` : name;
      // Stripe's inline `product_data` on a price does NOT accept a description.
      // To show the order-summary line on checkout we create a real Product with
      // the description, then price it; otherwise a name-only inline product.
      const goodsPrice = description
        ? await stripe.prices.create({
            currency: "usd",
            unit_amount: netGoods,
            product: (await stripe.products.create({ name: goodsName, description })).id,
          })
        : await stripe.prices.create({
            currency: "usd",
            unit_amount: netGoods,
            product_data: { name: goodsName },
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
      link = await makeLink(`50% Production Deposit - ${order.teamName} (${order.reference})`, dueCents, "deposit", {}, 0, 0, depositDesc);
      fullLink = await makeLink(`Pay in Full - ${order.teamName} (${order.reference})`, totalCents, "full", { siblingLinkId: link.id, shipCents: String(fullShipCents) }, fullShipCents, creditForFull, fullDesc);
      await stripe.paymentLinks.update(link.id, { metadata: { ...link.metadata, siblingLinkId: fullLink.id } });
    } else {
      link = await makeLink(`Final Balance - ${order.teamName} (${order.reference})`, dueCents, "balance", {}, shipCents, creditForBalance, balanceDesc);
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

    // Defense in depth: never let a team name inject URLs or newlines into the
    // outbound SMS body (the name is customer-supplied on public forms).
    const safeTeam = order.teamName.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim().slice(0, 40) || "your team";
    await smsIfConsented({
      phone: order.contactPhone,
      optInAt: order.smsOptInAt,
      body:
        stage === "deposit"
          ? `Slugger Athletics: your ${safeTeam} invoice is ready. Pay the 50% deposit to start production: ${link.url}`
          : `Slugger Athletics: final balance for ${safeTeam} (${order.reference}) is ready. Pay here: ${link.url}`,
    });
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
      shipBoxes: parcelsFor().length,
      creditAppliedCents: creditForBalance,
      payFullCreditCents: creditForFull,
      localPickup: order.localPickup,
      roster: invoiceRosterEntries(roster),
      payUrl: link.url,
      payFullUrl: fullLink?.url ?? undefined,
      payFullCents: fullLink ? (totalCents - creditForFull) + (order.taxExempt ? 0 : taxCents(totalCents - creditForFull)) + fullShipCents : undefined,
    });

    return { ok: true as const, stage, totalCents, dueCents, shipCents, creditAppliedCents: creditForBalance || creditForFull, taxDueCents: order.taxExempt ? 0 : taxCents((stage === "balance" ? dueCents - creditForBalance : dueCents)), invoiceUrl: link.url, fullInvoiceUrl: fullLink?.url ?? undefined, emailed, teamName: order.teamName, reference: order.reference };
  } catch (e) {
    console.error("send invoice failed:", e);
    return { ok: false as const, error: "Could not create the invoice", status: 500 };
  }
}

/** Fire-and-forget: auto-send the 50% deposit invoice the moment a roster is
 *  submitted, so nobody waits on staff to click a button. Print-file QA
 *  happens AFTER - production doesn't start until the deposit is paid anyway.
 *  Skips quietly when the order already has an invoice, can't be priced, or
 *  Stripe is off; failures ping the project's Discord thread for a human. */
export async function autoInvoiceOnSubmit(teamOrderId: string): Promise<void> {
  try {
    const { stripeEnabled } = await import("@/lib/stripe");
    if (!stripeEnabled()) return;
    const db = getDb();
    const [o] = await db
      .select({ id: teamOrders.id, reference: teamOrders.reference, teamName: teamOrders.teamName, status: teamOrders.status, invoiceUrl: teamOrders.invoiceUrl, depositPaidAt: teamOrders.depositPaidAt })
      .from(teamOrders)
      .where(eq(teamOrders.id, teamOrderId))
      .limit(1);
    if (!o || o.status !== "submitted" || o.invoiceUrl || o.depositPaidAt) return;

    const result = await sendTeamOrderInvoice({ teamOrderId, stage: "deposit" });

    // Log the outcome in the same Design Requests thread as the roster.
    const threadId = await ensureTeamOrderDiscordThread(o.id);
    const { postDesignThreadUpdate } = await import("@/lib/discord");
    const money = (c: number) => `$${(c / 100).toFixed(2)}`;
    if (result.ok) {
      if (threadId) {
        await postDesignThreadUpdate({
          threadId,
          title: `🧾 Deposit invoice auto-sent - ${o.teamName} (${o.reference})`,
          description: `Roster submitted → ${money(result.totalCents)} total quoted, ${money(result.dueCents)} deposit invoice emailed${result.emailed ? "" : " (email failed - resend from admin)"} automatically. Production starts when it's paid.`,
        });
      }
      console.log(`auto-invoice sent for ${o.reference}: ${money(result.dueCents)} deposit`);
    } else {
      await postDesignThreadUpdate({
        threadId: threadId ?? undefined,
        title: `⚠️ Auto-invoice needs a human - ${o.teamName} (${o.reference})`,
        description: `Roster was submitted but the deposit invoice could not be sent automatically: ${result.error} Send it from the admin Team Orders page.`,
        mention: true,
      });
    }
  } catch (e) {
    console.error("autoInvoiceOnSubmit failed:", e);
  }
}
