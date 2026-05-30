import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { postOrderToDiscord, postDesignRequestToDiscord } from "@/lib/discord";
import { dbEnabled } from "@/db";
import { getById, markDesignFeePaid, setDiscordThreadId } from "@/lib/design-requests";
import { emailDesignRequestToDesigner, emailDesignRequestConfirmation } from "@/lib/email";

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

      // Group orders by drop: thread title = primary product (drop) name.
      const threadName = lines[0]?.name;

      await postOrderToDiscord({
        reference: `SA-${session.id.slice(-8).toUpperCase()}`,
        orderType: typeMap[session.metadata?.orderType ?? "shop"] ?? "Shop",
        customerName: session.customer_details?.name ?? undefined,
        customerEmail: session.customer_details?.email ?? undefined,
        shipping,
        lines,
        totalCents: session.amount_total ?? 0,
        threadName,
      });
      // TODO: persist order to Neon once DATABASE_URL is configured (dedupe via session.id).
    } catch (e) {
      console.error("Failed to process completed checkout:", e);
      // Return 200 so Stripe doesn't retry forever on our internal errors.
    }
  }

  return NextResponse.json({ received: true });
}
