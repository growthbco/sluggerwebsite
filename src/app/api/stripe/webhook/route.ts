import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { eq } from "drizzle-orm";
import { postOrderToDiscord, postStoreOrderToDiscord, postDesignRequestToDiscord, postTeamOrderPaidToDiscord, postAddonToDesignerDiscord, postDesignThreadUpdate } from "@/lib/discord";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, teams } from "@/db/schema";
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

    // Free-form custom invoice paid: flip status + tell the orders channel.
    if (session.metadata?.kind === "design_lab" && session.metadata?.visitorId && dbEnabled()) {
      const { designLabVisitors } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      const [v] = await getDb()
        .update(designLabVisitors)
        .set({ paidAt: new Date(), stripeRef: session.id })
        .where(eq(designLabVisitors.id, session.metadata.visitorId))
        .returning();
      console.log("design lab session paid:", session.metadata.visitorId);
      // Paid = hottest lead we have. Ping the design channel with a link to
      // their concept gallery (best effort).
      const hook = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
      if (hook && v) {
        const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
        void fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "Slugger AI Design Lab",
            content: `💰 **Jersey Maker $10 session PAID**: ${v.firstName ?? ""} ${v.lastName ?? ""} · ${v.email ?? "no email"} · ${v.phone ?? "no phone"} (${v.generations} concepts so far)\nGallery: ${SITE}/admin/design-lab`,
          }),
        }).catch(() => {});
      }
      return NextResponse.json({ received: true });
    }

    if (session.metadata?.kind === "custom_invoice" && session.metadata?.customInvoiceId && dbEnabled()) {
      try {
        const { customInvoices } = await import("@/db/schema");
        const db = getDb();
        const [inv] = await db
          .update(customInvoices)
          .set({ status: "paid", paidAt: new Date() })
          .where(eq(customInvoices.id, session.metadata.customInvoiceId))
          .returning();
        if (inv) {
          // Settle referrals + burn any credit that was applied to this
          // invoice - it only leaves their balance once the money is real.
          try {
            const { settleReferral, redeemCredit } = await import("@/lib/customers");
            await settleReferral(inv.customerEmail);
            if (inv.creditCents > 0) await redeemCredit(inv.customerEmail, inv.creditCents);
          } catch (e) { console.error("referral settle (custom invoice) failed:", e); }
          await postOrderToDiscord({
            reference: inv.reference,
            orderType: "Custom Invoice",
            customerName: inv.customerName,
            customerEmail: inv.customerEmail,
            lines: inv.lines.map((l) => ({ name: l.name, quantity: l.quantity, amountCents: l.unitPriceCents * l.quantity })),
            totalCents: session.amount_total ?? inv.totalCents,
          });
        }
      } catch (e) {
        console.error("custom invoice webhook failed:", e);
      }
      return NextResponse.json({ received: true });
    }

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
            source: request.source,
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
                  ...(isFull
                    ? { depositPaidAt: now, ...(session.metadata.shipCents ? { shippingChargedCents: Number(session.metadata.shipCents) || 0 } : {}) }
                    : {}),
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
            contactEmail: teamOrders.contactEmail,
          });
        if (row) {
          // Settle any referral: this coach may have been attributed when they
          // first landed via a referral link. Reward fires once, on real order.
          // Also redeem any referral credit that was applied to this link (full
          // or balance stage only - the deposit carries none). The payment link
          // can complete once, so this decrements exactly once.
          try {
            const { settleReferral, redeemCredit } = await import("@/lib/customers");
            await settleReferral(row.contactEmail);
            const applied = Number(session.metadata.creditAppliedCents) || 0;
            if (applied > 0 && !isDeposit && row.contactEmail) {
              await redeemCredit(row.contactEmail, applied);
            }
          } catch (e) { console.error("referral settle (team invoice) failed:", e); }
          const { getById } = await import("@/lib/design-requests");
          const design = row.designRequestId ? await getById(row.designRequestId) : null;
          await postTeamOrderPaidToDiscord({
            reference: row.reference,
            teamName: row.teamName,
            totalCents: session.amount_total ?? 0,
            stage: isDeposit ? "deposit" : "balance",
            designThreadId: design?.discordThreadId,
          });
          const { setThreadStageTag } = await import("@/lib/discord-bot");
          await setThreadStageTag(design?.discordThreadId, isDeposit ? "💰 Deposit Paid" : "💸 Paid in Full");
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

      // Self-serve "add to my order" top-up: merge the new items into the
      // existing store order instead of creating a brand-new order.
      if (session.metadata?.orderType === "store_order_add" && dbEnabled()) {
        try {
          const { mergeStoreOrderAdd } = await import("@/lib/orders");
          const garment = lineItems.data.filter((li) => !/tax|shipping/i.test(li.description ?? ""));
          const mergeLines = garment.map((li) => ({
            name: li.description ?? "Item",
            quantity: li.quantity ?? 1,
            unitPriceCents: li.price?.unit_amount ?? Math.round((li.amount_total ?? 0) / (li.quantity ?? 1)),
          }));
          const res = await mergeStoreOrderAdd({
            orderId: session.metadata.addToOrderId,
            sessionId: session.id,
            newShippingCents: Number(session.metadata.newShippingCents) || 0,
            paidTotalCents: session.amount_total ?? 0,
            fundraiseCents: Number(session.metadata.fundraiseCents) || 0,
            lines: mergeLines,
          });
          if (res.merged && res.teamId) {
            // Note the add in the BUYER's own thread and re-open print-file QA
            // for any affected design groups (the file now needs the new piece).
            const [team] = await getDb().select({ name: teams.name, thread: teams.storeThreadId, custThreads: teams.storeCustomerThreads, qa: teams.storePrintFileQa }).from(teams).where(eq(teams.id, res.teamId)).limit(1);
            const { parseStoreLine } = await import("@/lib/store-print-file");
            // Route into the buyer's per-customer thread; fall back to the store thread.
            const addEmailKey = (session.customer_details?.email ?? "").trim().toLowerCase();
            const buyerThread = (addEmailKey && team?.custThreads?.[addEmailKey]) || team?.thread;
            if (buyerThread) {
              await postDesignThreadUpdate({
                threadId: buyerThread,
                title: `➕ Items added to ${res.reference} - ${team?.name ?? "store"}`,
                description: res.addedLines.map((l) => `${l.quantity}× ${l.name}`).join("\n").slice(0, 1800),
                username: "Slugger Design Requests",
              });
            }
            if (team?.qa) {
              const next = { ...team.qa };
              let changed = false;
              for (const l of res.addedLines) {
                const parsed = parseStoreLine(l.name);
                if (parsed && next[parsed.groupKey]) { delete next[parsed.groupKey]; changed = true; }
              }
              if (changed) await getDb().update(teams).set({ storePrintFileQa: next }).where(eq(teams.id, res.teamId));
            }
          }
        } catch (e) {
          console.error("store_order_add merge failed:", e);
        }
        return NextResponse.json({ received: true });
      }

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
            customerNote: session.metadata?.orderNote || undefined,
            fundraiseCents: Number(session.metadata?.fundraiseCents) || 0,
            source: session.metadata?.attributionSource || undefined,
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
        const isStore = orderTypeKey === "team_store";
        const teamId = session.metadata?.teamId || undefined;

        if (isStore && teamId && dbEnabled()) {
          // Team-store orders post into a per-CUSTOMER thread (keyed by email)
          // so each buyer's orders + later add-ons stay together, instead of
          // every buyer piling into one store thread.
          try {
            const [team] = await getDb()
              .select({ name: teams.name, slug: teams.slug, token: teams.storeToken, design: teams.approvedDesignUrl, custThreads: teams.storeCustomerThreads })
              .from(teams).where(eq(teams.id, teamId)).limit(1);
            const garmentLines = lines.filter((l) => !/tax/i.test(l.name));
            const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
            const buyerEmailKey = (session.customer_details?.email ?? "").trim().toLowerCase();
            const custThreads = team?.custThreads ?? {};
            const existingThread = buyerEmailKey ? custThreads[buyerEmailKey] : undefined;
            const buyerName = session.customer_details?.name ?? buyerEmailKey ?? "Customer";
            const posted = await postStoreOrderToDiscord({
              reference,
              teamName: team?.name ?? session.metadata?.teamName ?? "Team",
              approvedDesignUrl: team?.design ?? undefined,
              customerName: session.customer_details?.name ?? undefined,
              customerEmail: session.customer_details?.email ?? undefined,
              shipping,
              note: session.metadata?.orderNote || undefined,
              items: garmentLines.map((l) => ({ quantity: l.quantity, label: l.name })),
              storeUrl: team?.slug ? `${SITE}/store/${team.slug}` : undefined,
              verifyUrl: team?.token ? `${SITE}/store/${team.token}/verify` : undefined,
              existingThreadId: existingThread ?? null,
              threadName: `🛒 ${buyerName} - ${team?.name ?? "Store"}`,
            });
            // First order from this buyer: remember their thread for next time.
            if (!existingThread && posted.threadId && buyerEmailKey) {
              await getDb().update(teams).set({ storeCustomerThreads: { ...custThreads, [buyerEmailKey]: posted.threadId } }).where(eq(teams.id, teamId));
            }

            // A new order for a design invalidates that design's prior print-file
            // QA - the file now needs the new jersey, so the ✅ must be re-earned.
            const { parseStoreLine } = await import("@/lib/store-print-file");
            const [full] = await getDb().select({ qa: teams.storePrintFileQa, thread: teams.storeThreadId }).from(teams).where(eq(teams.id, teamId)).limit(1);
            const qa = full?.qa;
            if (qa) {
              const affected = new Set<string>();
              for (const l of garmentLines) {
                const parsed = parseStoreLine(l.name);
                if (parsed && qa[parsed.groupKey]) affected.add(parsed.groupKey);
              }
              if (affected.size > 0) {
                const next = { ...qa };
                const labels: string[] = [];
                for (const key of affected) { labels.push(next[key]?.summary ? key : key); delete next[key]; }
                await getDb().update(teams).set({ storePrintFileQa: next }).where(eq(teams.id, teamId));
                const groupLabels = garmentLines.map((l) => parseStoreLine(l.name)).filter((x): x is NonNullable<typeof x> => Boolean(x) && affected.has(x!.groupKey)).map((x) => x!.groupLabel);
                const uniqLabels = [...new Set(groupLabels)];
                if (full?.thread && uniqLabels.length) {
                  await postDesignThreadUpdate({
                    threadId: full.thread,
                    title: `⚠️ Re-verify needed - ${team?.name ?? "store"}`,
                    description: `This new order adds jerseys to a design that was already print-file verified (${uniqLabels.join(", ")}). The print file must include the new piece - re-run QA before producing that design.`,
                    username: "Slugger Print QA",
                  });
                }
              }
            }
          } catch (e) { console.error("store order Discord post failed:", e); }
        } else {
          // Shop / buy-in orders: general orders channel, grouped by drop name.
          await postOrderToDiscord({
            reference,
            orderType: typeMap[orderTypeKey] ?? "Shop",
            customerName: session.customer_details?.name ?? undefined,
            customerEmail: session.customer_details?.email ?? undefined,
            shipping,
            lines,
            subtotalCents: session.amount_subtotal ?? undefined,
            shippingCents: session.total_details?.amount_shipping ?? 0,
            totalCents: session.amount_total ?? 0,
            threadName: session.metadata?.teamName || lines[0]?.name,
          });
        }

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
          // Settle referral: attribute this buyer to the /r/<code> cookie code
          // (if any) and grant the one-time reward on this real gear order.
          if (dbEnabled()) {
            try {
              const { settleReferral } = await import("@/lib/customers");
              await settleReferral(buyerEmail, session.metadata?.referralCode);
            } catch (e) { console.error("referral settle (shop/store) failed:", e); }
          }
        }
      }
    } catch (e) {
      console.error("Failed to process completed checkout:", e);
      // Return 200 so Stripe doesn't retry forever on our internal errors.
    }
  }

  return NextResponse.json({ received: true });
}
