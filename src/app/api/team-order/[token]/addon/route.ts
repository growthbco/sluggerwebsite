import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/team-orders";
import { priceAddonRows, createAddon, setAddonSession, type AddonRowInput } from "@/lib/team-order-addons";
import { getStripe, stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";

// Coach pays for extra pieces on an existing (already submitted) order.
// Authed by the private manage token; pieces join the roster only after
// Stripe confirms payment (webhook).
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled() || !stripeEnabled()) {
    return NextResponse.json({ error: "Checkout isn't configured yet." }, { status: 503 });
  }
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (order.status === "draft" || order.status === "collecting") {
    return NextResponse.json({ error: "The roster is still open - just add players normally." }, { status: 409 });
  }
  if (order.status === "cancelled") {
    return NextResponse.json({ error: "This order was cancelled." }, { status: 409 });
  }

  let inputs: AddonRowInput[] = [];
  try {
    ({ rows: inputs } = await req.json());
  } catch {}
  const { rows, totalCents } = priceAddonRows(order, Array.isArray(inputs) ? inputs : []);
  if (rows.length === 0 || totalCents <= 0) {
    return NextResponse.json({ error: "Nothing valid to add." }, { status: 400 });
  }

  try {
    const addon = await createAddon(order.id, rows, totalCents);
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: rows.map((r) => ({
        quantity: r.quantity,
        price_data: {
          currency: "usd",
          unit_amount: r.unitPriceCents,
          product_data: {
            name: `${r.label} - ${[r.size, r.name?.toUpperCase(), r.number ? `#${r.number}` : null].filter(Boolean).join(" - ")} (add-on ${order.reference})`,
          },
        },
      })),
      success_url: `${SITE}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/team-order/manage/${token}`,
      phone_number_collection: { enabled: false },
      metadata: { kind: "team_order_addon", addonId: addon.id, teamOrderId: order.id, teamName: order.teamName },
    });
    await setAddonSession(addon.id, session.id);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("addon checkout failed:", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
