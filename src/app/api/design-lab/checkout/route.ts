import { NextResponse } from "next/server";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { getOrCreateVisitor, LAB_COOKIE } from "@/lib/design-lab";

export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

// $10 "design session": unlimited lab generations for this project, fully
// credited toward the customer's order. Sold as reserving the designer.
export async function POST(req: Request) {
  if (!stripeEnabled()) return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  const ctx = await getOrCreateVisitor();
  if (!ctx) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  let body: { returnTo?: string } = {};
  try { body = await req.json(); } catch {}
  const returnTo = typeof body.returnTo === "string" && body.returnTo.startsWith("/") ? body.returnTo : "/design-lab";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: 1000,
        product_data: {
          name: "Design Session - $10, credited to your order",
          description: "Unlimited AI concepts for your project + priority proof from our designer. The $10 comes off your order.",
        },
      },
      quantity: 1,
    }],
    metadata: { kind: "design_lab", visitorId: ctx.visitor.id },
    customer_email: ctx.visitor.email ?? undefined,
    success_url: `${SITE}${returnTo}${returnTo.includes("?") ? "&" : "?"}paid=1`,
    cancel_url: `${SITE}${returnTo}`,
  });

  const res = NextResponse.json({ url: session.url });
  if (ctx.setCookie) res.cookies.set(LAB_COOKIE, ctx.setCookie, { httpOnly: true, maxAge: 60 * 60 * 24 * 365, path: "/" });
  return res;
}
