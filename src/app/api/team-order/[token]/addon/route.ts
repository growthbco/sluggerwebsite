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

    // A single-use Payment Link, not a Checkout Session: sessions expire after
    // 24h (a coach who pays the next evening hits a dead link), payment links
    // never do. The link's metadata is copied onto the session it creates, so
    // the webhook's addon handling is unchanged.
    const makePrice = async (name: string, unitAmount: number) =>
      (await stripe.prices.create({ currency: "usd", unit_amount: unitAmount, product_data: { name } })).id;
    const lineItems: { price: string; quantity: number }[] = [];
    for (const r of rows) {
      lineItems.push({
        quantity: r.quantity,
        price: await makePrice(
          `${r.label} - ${[r.design, r.size, r.name?.toUpperCase(), r.number ? `#${r.number}` : null].filter(Boolean).join(" - ")} (add-on ${order.reference})`,
          r.unitPriceCents,
        ),
      });
    }
    const addonTax = taxCents(totalCents);
    if (addonTax > 0) lineItems.push({ quantity: 1, price: await makePrice(SALES_TAX_LABEL, addonTax) });

    // Payment links only accept saved shipping rates (no inline rate data).
    let shippingOptions: { shipping_rate: string }[] = [];
    if (shipsSeparately) {
      const [byWeight, pickup] = await Promise.all([
        stripe.shippingRates.create({
          display_name: "Shipping (by weight)",
          type: "fixed_amount",
          fixed_amount: { amount: shippingCentsFor(addonWeightOz(rows)), currency: "usd" },
        }),
        stripe.shippingRates.create({
          display_name: "Free local pickup (Ocala, FL)",
          type: "fixed_amount",
          fixed_amount: { amount: 0, currency: "usd" },
        }),
      ]);
      shippingOptions = [{ shipping_rate: byWeight.id }, { shipping_rate: pickup.id }];
    }

    const link = await stripe.paymentLinks.create({
      line_items: lineItems,
      restrictions: { completed_sessions: { limit: 1 } },
      ...(shipsSeparately
        ? { shipping_address_collection: { allowed_countries: ["US"] }, shipping_options: shippingOptions }
        : {}),
      metadata: { kind: "team_order_addon", addonId: addon.id, teamOrderId: order.id, teamName: order.teamName },
      after_completion: { type: "redirect", redirect: { url: `${SITE}/checkout/success` } },
    });
    await setAddonSession(addon.id, link.id);
    return NextResponse.json({ url: link.url });
  } catch (e) {
    console.error("addon checkout failed:", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
