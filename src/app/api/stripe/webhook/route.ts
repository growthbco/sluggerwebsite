import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { eq } from "drizzle-orm";
import { postOrderToDiscord, postDesignRequestToDiscord, postTeamOrderPaidToDiscord, postAddonToDesignerDiscord } from "@/lib/discord";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getById, markDesignFeePaid, setDiscordThreadId, formatProducts } from "@/lib/design-requests";
import { emailDesignRequestToDesigner, emailDesignRequestConfirmation, emailOrderConfirmation } from "@/lib/email";
import { persistPaidOrder } from "@/lib/orders";

export const runtime = "nodejs";

// Stripe is the source of truth: even if the browser closes mid-flow, this
// fires on payment and pushes the order to Discord.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const raw = await req.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error("Webhook signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Design fee checkout: payment confirms the intake. Mark paid + fire the
    // designer notifications now (we held them until payment so the designer
    // queue doesn't fill with unpaid leads).
    if (session.metadata?.kind === "design_fee" && session.metadata?.designRequestId && dbEnabled()) {
      try {
        const designRequestId = session.metadata.designRequestId;
        await markDesignFeePaid(designRequestId, session.id);
        const request = await getById(designRequestId);
        if (request) {
          const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
          const statusUrl = `${SITE}/design/status/${request.statusToken}`;
          const manageUrl = `${SITE}/design/manage/${request.manageToken}`;
          const products = formatProducts(request.productTypes, request.jerseyStyle);
          const colorsForDesigner =
            [(request.colorHexes ?? []).join(", "), request.colors?.trim()].filter(Boolean).join(" · ") || undefined;
          const discordResult = await postDesignRequestToDiscord({
            reference: request.reference,
            teamName: request.teamName,
            sport: request.sport ?? undefined,
            products,
            vision: request.vision ?? undefined,
            colors: colorsForDesigner,
            inspirationImages: request.inspirationImages ?? [],
            manageUrl,
            neededBy: request.neededBy ?? undefined,
            rush: request.rush,
            estimatedPieces: request.estimatedPieces,
          });
          if (discordResult.threadId) {
            try { await setDiscordThreadId(designRequestId, discordResult.threadId); } catch (e) { console.error("setDiscordThreadId failed:", e); }
          }
          await Promise.allSettled([
            emailDesignRequestToDesigner({
              reference: request.reference,
              teamName: request.teamName,
              sport: request.sport ?? undefined,
              contactName: request.contactName,
              contactEmail: request.contactEmail,
              contactPhone: request.contactPhone ?? undefined,
              products,
              vision: request.vision ?? undefined,
              colors: colorsForDesigner,
              inspirationImages: request.inspirationImages ?? [],
              manageUrl,
              neededBy: request.neededBy ?? undefined,
              rush: request.rush,
            }),
            emailDesignRequestConfirmation({
              to: request.contactEmail,
              teamName: request.teamName,
              reference: request.reference,
              statusUrl,
            }),
          ]);
        }
      } catch (e) {
        console.error("Design fee webhook failed:", e);
      }
      return NextResponse.json({ received: true });
    }

    // Post-submission add-on paid: append the pieces to the roster, tell the
    // team channel, and email the coach a receipt.
    if (session.metadata?.kind === "team_order_addon" && session.metadata?.addonId && dbEnabled()) {
      try {
        const { markAddonPaid } = await import("@/lib/team-order-addons");
        const paidTotal = session.amount_total ?? 0;
        const result = await markAddonPaid(session.metadata.addonId, session.id, paidTotal);
        if (result) {
          const { getById } = await import("@/lib/design-requests");
          const { taxCents } = await import("@/lib/pricing");
          const design = result.order.designRequestId ? await getById(result.order.designRequestId) : null;
          // Itemized breakdown so the ping is self-explanatory: who was added,
          // and exactly why the total is what it is (goods + tax + shipping).
          const money = (c: number) => `$${(c / 100).toFixed(2)}`;
          const goods = result.addon.rows.reduce((s, r) => s + r.unitPriceCents * r.quantity, 0);
          const tax = taxCents(goods);
          const shipping = Math.max(0, paidTotal - goods - tax);
          const playerLines = result.addon.rows
            .map((r) => `• ${[r.name?.trim(), r.number ? `#${r.number}` : null].filter(Boolean).join(" ") || "(no name)"} - ${r.label} (${r.size}) - ${money(r.unitPriceCents)}`)
            .join("\n");
          const details =
            `**Added pieces:**\n${playerLines}\n\n` +
            `Goods ${money(goods)} + tax ${money(tax)}` +
            (shipping > 0 ? ` + shipping ${money(shipping)} (ships separately)` : "") +
            ` = **${money(paidTotal)}**`;
          await postTeamOrderPaidToDiscord({
            reference: `${result.order.reference} ADD-ON`,
            teamName: `➕ ${result.order.teamName}`,
            totalCents: paidTotal,
            stage: "balance",
            designThreadId: design?.discordThreadId,
            details,
          });
          // Tell the designer to add these pieces to the print file (posts in
          // the project's design thread when there is one).
          await postAddonToDesignerDiscord({
            reference: result.order.reference,
            teamName: result.order.teamName,
            rows: result.addon.rows,
            designThreadId: design?.discordThreadId,
          });
          const buyerEmail = session.customer_details?.email ?? result.order.contactEmail;
          if (buyerEmail) {
            await emailOrderConfirmation({
              to: buyerEmail,
              customerName: session.customer_details?.name ?? result.order.contactName,
              reference: `${result.order.reference} (add-on)`,
              lines: result.addon.rows.map((r) => ({
                name: `${r.label} - ${[r.size, r.name, r.number ? `#${r.number}` : null].filter(Boolean).join(" - ")}`,
                quantity: r.quantity,
                amountCents: r.unitPriceCents * r.quantity,
              })),
              totalCents: session.amount_total ?? 0,
            });
          }
        }
      } catch (e) {
        console.error("team order addon webhook failed:", e);
      }
      return NextResponse.json({ received: true });
    }

    // Team-order invoice paid (Stripe Payment Link created from the admin
    // dashboard): flip the order to paid and tell the team channel.
    if (session.metadata?.kind === "team_order_invoice" && session.metadata?.teamOrderId && dbEnabled()) {
      try {
        const db = getDb();
        const now = new Date();
        // Deposit (50%) flips the order into production; "full" or "balance"
        // (or a legacy invoice with no stage) marks it fully paid.
        const isDeposit = session.metadata.stage === "deposit";
        const isFull = session.metadata.stage === "full";
        // Save the delivery address collected on the payment page (needed for
        // label buying). Newer API versions expose it via collected_information.
        const shipTo =
          (session as { shipping_details?: { address?: Stripe.Address } }).shipping_details?.address ??
          (session as { collected_information?: { shipping_details?: { address?: Stripe.Address } } })
            .collected_information?.shipping_details?.address ??
          session.customer_details?.address;
        const addressPatch = shipTo?.line1
          ? {
              shippingAddress: {
                line1: shipTo.line1 ?? undefined,
                line2: shipTo.line2 ?? undefined,
                city: shipTo.city ?? undefined,
                state: shipTo.state ?? undefined,
                postalCode: shipTo.postal_code ?? undefined,
                country: shipTo.country ?? undefined,
              },
            }
          : {};
        const [row] = await db
          .update(teamOrders)
          .set(
            isDeposit
              ? { status: "in_production", depositPaidAt: now, invoiceRemindersSent: 0, updatedAt: now, ...addressPatch }
              : {
                  status: "paid",
                  invoicePaidAt: now,
                  ...(isFull ? { depositPaidAt: now } : {}),
                  invoiceRemindersSent: 0,
                  updatedAt: now,
                  ...addressPatch,
                },
          )
          .where(eq(teamOrders.id, session.metadata.teamOrderId))
          .returning({
            reference: teamOrders.reference,
            teamName: teamOrders.teamName,
            designRequestId: teamOrders.designRequestId,
          });
        if (row) {
          const { getById } = await import("@/lib/design-requests");
          const design = row.designRequestId ? await getById(row.designRequestId) : null;
          await postTeamOrderPaidToDiscord({
            reference: row.reference,
            teamName: row.teamName,
            totalCents: session.amount_total ?? 0,
            stage: isDeposit ? "deposit" : "balance",
            designThreadId: design?.discordThreadId,
          });
        }
        // The deposit and pay-in-full links are siblings: paying one kills the
        // other so nobody can double-pay.
        if (session.metadata.siblingLinkId) {
          try {
            await getStripe().paymentLinks.update(session.metadata.siblingLinkId, { active: false });
          } catch (e) {
            console.error("sibling link deactivation failed:", e);
          }
        }
      } catch (e) {
        console.error("team order invoice webhook failed:", e);
      }
      return NextResponse.json({ received: true });
    }

    try {
      const stripe = getStripe();
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

      const addr = session.customer_details?.address;
      const shipping = addr
        ? [addr.line1, addr.line2, `${addr.city ?? ""}, ${addr.state ?? ""} ${addr.postal_code ?? ""}`, addr.country]
            .filter(Boolean)
            .join("\n")
        : undefined;

      const typeMap: Record<string, "Shop" | "Buy-In" | "Team Store"> = {
        shop: "Shop",
        buy_in: "Buy-In",
        team_store: "Team Store",
      };

      const lines = lineItems.data.map((li) => ({
        name: li.description ?? "Item",
        description: undefined,
        quantity: li.quantity ?? 1,
        amountCents: li.amount_total ?? 0,
      }));

      const reference = `SA-${session.id.slice(-8).toUpperCase()}`;
      const orderTypeKey = (session.metadata?.orderType ?? "shop") as "shop" | "buy_in" | "team_store";

      // Persist first: the unique index on the session id makes this the
      // dedupe gate, so a Stripe retry skips Discord + email too.
      let isNewOrder = true;
      if (dbEnabled()) {
        try {
          const { inserted } = await persistPaidOrder({
            reference,
            type: orderTypeKey in typeMap ? orderTypeKey : "shop",
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
            customerName: session.customer_details?.name ?? undefined,
            customerEmail: session.customer_details?.email ?? undefined,
            shippingAddress: addr
              ? {
                  line1: addr.line1 ?? undefined,
                  line2: addr.line2 ?? undefined,
                  city: addr.city ?? undefined,
                  state: addr.state ?? undefined,
                  postalCode: addr.postal_code ?? undefined,
                  country: addr.country ?? undefined,
                }
              : undefined,
            subtotalCents: session.amount_subtotal ?? 0,
            shippingCents: session.total_details?.amount_shipping ?? 0,
            totalCents: session.amount_total ?? 0,
            teamId: session.metadata?.teamId || undefined,
            lines: lineItems.data.map((li) => ({
              name: li.description ?? "Item",
              quantity: li.quantity ?? 1,
              unitPriceCents: li.price?.unit_amount ?? Math.round((li.amount_total ?? 0) / (li.quantity || 1)),
            })),
          });
          isNewOrder = inserted;
        } catch (e) {
          console.error("Failed to persist order:", e);
        }
      }

      if (isNewOrder) {
        // Thread grouping: team stores group by team name; drops group by the
        // primary product (drop) name.
        const threadName = session.metadata?.teamName || lines[0]?.name;

        await postOrderToDiscord({
          reference,
          orderType: typeMap[orderTypeKey] ?? "Shop",
          customerName: session.customer_details?.name ?? undefined,
          customerEmail: session.customer_details?.email ?? undefined,
          shipping,
          lines,
          totalCents: session.amount_total ?? 0,
          threadName,
        });

        const buyerEmail = session.customer_details?.email;
        if (buyerEmail) {
          await emailOrderConfirmation({
            to: buyerEmail,
            customerName: session.customer_details?.name ?? undefined,
            reference,
            lines,
            totalCents: session.amount_total ?? 0,
            shipping,
          });
        }
      }
    } catch (e) {
      console.error("Failed to process completed checkout:", e);
      // Return 200 so Stripe doesn't retry forever on our internal errors.
    }
  }

  return NextResponse.json({ received: true });
}
