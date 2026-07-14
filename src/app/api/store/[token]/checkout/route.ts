import { NextResponse } from "next/server";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { dbEnabled } from "@/db";
import { getByStoreToken, shippingCentsFor } from "@/lib/team-stores";

export const runtime = "nodejs";

type IncomingItem = {
  key: string;
  size?: string;
  playerName?: string;
  playerNumber?: string;
  quantity: number;
};

// Live Shippo rate (+margin) when the buyer gave us a ZIP; formula otherwise.
async function shippingChargeCents(totalOz: number, zip?: string): Promise<number> {
  if (zip && /^\d{5}$/.test(zip)) {
    try {
      const { getRates, shippoEnabled } = await import("@/lib/shippo");
      if (shippoEnabled()) {
        const rates = await getRates({ zip }, totalOz);
        if (rates.length > 0) return rates[0].chargedCents;
      }
    } catch (e) {
      console.error("live rate failed, using formula:", e);
    }
  }
  return shippingCentsFor(totalOz);
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!stripeEnabled() || !dbEnabled()) {
    return NextResponse.json({ error: "Checkout isn't configured yet." }, { status: 503 });
  }
  const { token } = await params;
  const store = await getByStoreToken(token);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  if (!store.storeActive) return NextResponse.json({ error: "This store is currently closed." }, { status: 409 });

  let items: IncomingItem[];
  let shipZip: string | undefined;
  try {
    const body = await req.json();
    items = body.items;
    shipZip = typeof body.shipZip === "string" ? body.shipZip.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Nothing selected" }, { status: 400 });
  }

  const catalog = new Map((store.storeItems ?? []).map((i) => [i.key, i]));
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Prices and weights come from the store snapshot, never the client. Player
  // details go IN the line-item name so they survive to the webhook, Discord,
  // and the confirmation email (Stripe drops product_data.description there).
  let totalOz = 0;
  const lineItems = [];
  for (const item of items) {
    const def = catalog.get(item.key);
    if (!def) continue;
    const qty = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    const size = def.sizes.includes(item.size ?? "") ? item.size : def.sizes[0];
    const details = [size];
    if (def.nameNumber) {
      const nm = (item.playerName ?? "").trim().slice(0, 30);
      const num = (item.playerNumber ?? "").trim().slice(0, 4);
      if (nm) details.push(nm.toUpperCase());
      if (num) details.push(`#${num}`);
    }
    totalOz += def.weightOz * qty;
    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: def.priceCents,
        product_data: { name: `${def.label} - ${details.join(" - ")}` },
      },
    });
  }
  if (lineItems.length === 0) {
    return NextResponse.json({ error: "No valid items selected" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${SITE}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/store/${token}`,
      shipping_address_collection: { allowed_countries: ["US"] },
      phone_number_collection: { enabled: true },
      // Buyer picks: shipping (live carrier rate when they gave a ZIP) or
      // free local pickup in Ocala.
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: shipZip ? `Shipping to ${shipZip}` : "Shipping (by weight)",
            type: "fixed_amount",
            fixed_amount: { amount: await shippingChargeCents(totalOz, shipZip), currency: "usd" },
          },
        },
        {
          shipping_rate_data: {
            display_name: "Free local pickup (Ocala, FL)",
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "usd" },
          },
        },
      ],
      metadata: { orderType: "team_store", teamId: store.id, teamName: store.name },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Store checkout error:", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
