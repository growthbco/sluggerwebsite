import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { postOrderToDiscord, postDesignRequestToDiscord } from "@/lib/discord";
import { dbEnabled } from "@/db";
import { getById, markDesignFeePaid, setDiscordThreadId } from "@/lib/design-requests";
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
          const discordResult = await postDesignRequestToDiscord({
            reference: request.reference,
            teamName: request.teamName,
            sport: request.sport ?? undefined,
            vision: request.vision ?? undefined,
            colors: request.colors ?? undefined,
            inspirationImages: request.inspirationImages ?? [],
            manageUrl,
            neededBy: request.neededBy ?? undefined,
            rush: request.rush,
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
              vision: request.vision ?? undefined,
              colors: request.colors ?? undefined,
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
        // Group orders by drop: thread title = primary product (drop) name.
        const threadName = lines[0]?.name;

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
