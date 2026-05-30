import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import {
  createDesignRequest,
  setDiscordThreadId,
  findReturningCustomerRef,
  DESIGN_FEE_CENTS,
} from "@/lib/design-requests";
import { postDesignRequestToDiscord } from "@/lib/discord";
import { emailDesignRequestToDesigner, emailDesignRequestConfirmation } from "@/lib/email";
import { getStripe, stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "Design requests need the database configured (DATABASE_URL)." },
      { status: 503 },
    );
  }

  let body: {
    teamName?: string;
    sport?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    vision?: string;
    colors?: string;
    notes?: string;
    inspirationImages?: string[];
    neededBy?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.teamName || !body.contactName || !body.contactEmail) {
    return NextResponse.json({ error: "Team name, your name, and email are required." }, { status: 400 });
  }
  if (!body.vision && !(body.inspirationImages?.length)) {
    return NextResponse.json(
      { error: "Add a description of your vision, or upload at least one inspiration image." },
      { status: 400 },
    );
  }

  // Auto-bypass the $35 fee for returning customers (matched by email against
  // any prior approved design or submitted team order).
  const priorRef = await findReturningCustomerRef(body.contactEmail);
  const feeWaivedReason = priorRef ? "returning_customer" : null;
  const feeWaivedRef = priorRef ?? null;

  try {
    const { id: requestId, reference, statusToken, manageToken, rush, neededBy, waived } = await createDesignRequest({
      teamName: body.teamName,
      sport: body.sport,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      vision: body.vision,
      colors: body.colors,
      notes: body.notes,
      inspirationImages: body.inspirationImages ?? [],
      neededBy: body.neededBy,
      feeWaivedReason,
      feeWaivedRef,
    });

    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const statusUrl = `${SITE}/design/status/${statusToken}`;
    const manageUrl = `${SITE}/design/manage/${manageToken}`;

    // ─── PATH A: fee waived → notify designer + client immediately ────────
    if (waived) {
      const discordResult = await postDesignRequestToDiscord({
        reference,
        teamName: body.teamName,
        sport: body.sport,
        vision: body.vision,
        colors: body.colors,
        inspirationImages: body.inspirationImages ?? [],
        manageUrl,
        neededBy,
        rush,
      });
      if (discordResult.threadId) {
        try { await setDiscordThreadId(requestId, discordResult.threadId); } catch (e) { console.error("setDiscordThreadId failed:", e); }
      }
      await Promise.allSettled([
        emailDesignRequestToDesigner({
          reference,
          teamName: body.teamName,
          sport: body.sport,
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          vision: body.vision,
          colors: body.colors,
          inspirationImages: body.inspirationImages ?? [],
          manageUrl,
          neededBy,
          rush,
        }),
        emailDesignRequestConfirmation({
          to: body.contactEmail,
          teamName: body.teamName,
          reference,
          statusUrl,
        }),
      ]);
      return NextResponse.json({
        ok: true,
        reference,
        statusUrl,
        waived: true,
        waivedReason: "returning_customer",
        priorRef,
      });
    }

    // ─── PATH B: needs to pay → create Stripe Checkout, hold notifications ─
    if (!stripeEnabled()) {
      // Without Stripe configured, fail safe by treating like a waiver but
      // logging the unbilled state. Should never hit in production.
      console.error("Stripe not configured but fee required for", reference);
      return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
    }
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: body.contactEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Custom Design — Slugger Athletics",
              description: `Design brief for ${body.teamName}. Fully credited to your final team order.`,
            },
            unit_amount: DESIGN_FEE_CENTS,
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true, // staff-created codes (REPEAT, VIP, etc.)
      metadata: {
        designRequestId: requestId,
        designReference: reference,
        kind: "design_fee",
      },
      success_url: `${statusUrl}?paid=true`,
      cancel_url: `${SITE}/design?cancelled=${reference}`,
    });

    return NextResponse.json({
      ok: true,
      reference,
      statusUrl,
      checkoutUrl: session.url,
      waived: false,
    });
  } catch (e) {
    console.error("createDesignRequest failed:", e);
    return NextResponse.json({ error: "Could not save your design request" }, { status: 500 });
  }
}
