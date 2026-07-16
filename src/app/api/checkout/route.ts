import { NextResponse } from "next/server";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { getProduct, primaryImage } from "@/lib/catalog";
import { taxCents, SALES_TAX_LABEL } from "@/lib/pricing";

export const runtime = "nodejs";

type CheckoutLineItem = {
  quantity: number;
  price_data: {
    currency: string;
    unit_amount: number;
    product_data: { name: string; description?: string; images?: string[] };
  };
};

type IncomingItem = {
  slug: string;
  size?: string;
  customization?: Record<string, string>;
  quantity: number;
};

function describe(size?: string, custom?: Record<string, string>): string {
  const parts: string[] = [];
  if (size) parts.push(`Size: ${size}`);
  if (custom) {
    for (const [k, v] of Object.entries(custom)) if (v) parts.push(`${k}: ${v}`);
  }
  return parts.join(" · ");
}

export async function POST(req: Request) {
  if (!stripeEnabled()) {
    return NextResponse.json(
      { error: "Checkout isn't configured yet (missing STRIPE_SECRET_KEY)." },
      { status: 503 },
    );
  }

  let items: IncomingItem[];
  try {
    ({ items } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Build line items from the trusted catalog price, not the client-sent price.
  const lineItems: CheckoutLineItem[] = [];
  for (const item of items) {
    const product = getProduct(item.slug);
    if (!product) continue;
    const qty = Math.max(1, Math.min(999, Number(item.quantity) || 1));
    const desc = describe(item.size, item.customization);
    const img = primaryImage(product);
    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: product.priceCents,
        product_data: {
          name: product.name,
          ...(desc ? { description: desc } : {}),
          // Stripe needs publicly reachable URLs; skip for local dev hosts.
          ...(img.startsWith("http") ? { images: [img] } : {}),
        },
      },
    });
  }

  if (lineItems.length === 0) {
    return NextResponse.json({ error: "No valid items in cart" }, { status: 400 });
  }

  // Flat 7% FL sales tax on the goods, as its own line.
  const goodsCents = lineItems.reduce((s, li) => s + li.price_data.unit_amount * li.quantity, 0);
  const tax = taxCents(goodsCents);
  if (tax > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency: "usd", unit_amount: tax, product_data: { name: SALES_TAX_LABEL } },
    });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${SITE}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/cart`,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      phone_number_collection: { enabled: true },
      metadata: { orderType: "shop" },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe checkout error:", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
