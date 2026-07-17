import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/team-orders";
import { priceAddonRows, createAddon, setAddonSession, addonWeightOz, type AddonRowInput } from "@/lib/team-order-addons";
import { shippingCentsFor } from "@/lib/team-stores";
import { taxCents, SALES_TAX_LABEL } from "@/lib/pricing";
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

    // Shipping rules for add-ons:
    //  - A small add-on (under 10 pieces) on an order that HASN'T shipped yet
    //    rides with the main batch for free.
    //  - A large add-on (10+ pieces) is its own production run, so it ships
    //    separately even if the main order hasn't gone out.
    //  - Once the main order has shipped, ANY add-on needs its own delivery.
    const ADDON_SEPARATE_SHIP_MIN = 10;
    const pieceCount = rows.reduce((s, r) => s + r.quantity, 0);
    const shipsSeparately = order.status === "shipped" || pieceCount >= ADDON_SEPARATE_SHIP_MIN;
    const goodsLineItems = rows.map((r) => ({
      quantity: r.quantity,
      price_data: {
        currency: "usd" as const,
        unit_amount: r.unitPriceCents,
        product_data: {
          name: `${r.label} - ${[r.size, r.name?.toUpperCase(), r.number ? `#${r.number}` : null].filter(Boolean).join(" - ")} (add-on ${order.reference})`,
        },
      },
    }));
    const addonTax = taxCents(goodsLineItems.reduce((s, li) => s + li.price_data.unit_amount * li.quantity, 0));
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: addonTax > 0
        ? [...goodsLineItems, { quantity: 1, price_data: { currency: "usd" as const, unit_amount: addonTax, product_data: { name: SALES_TAX_LABEL } } }]
        : goodsLineItems,
      success_url: `${SITE}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/team-order/manage/${token}`,
      phone_number_collection: { enabled: false },
      ...(shipsSeparately
        ? {
            shipping_address_collection: { allowed_countries: ["US"] as const },
            shipping_options: [
              {
                shipping_rate_data: {
                  display_name: "Shipping (by weight)",
                  type: "fixed_amount" as const,
                  fixed_amount: { amount: shippingCentsFor(addonWeightOz(rows)), currency: "usd" },
                },
              },
              {
                shipping_rate_data: {
                  display_name: "Free local pickup (Ocala, FL)",
                  type: "fixed_amount" as const,
                  fixed_amount: { amount: 0, currency: "usd" },
                },
              },
            ],
          }
        : {}),
      metadata: { kind: "team_order_addon", addonId: addon.id, teamOrderId: order.id, teamName: order.teamName },
    });
    await setAddonSession(addon.id, session.id);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("addon checkout failed:", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
