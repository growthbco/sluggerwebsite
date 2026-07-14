import { NextResponse } from "next/server";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { dbEnabled } from "@/db";
import { getStoreByHandle, shippingCentsFor } from "@/lib/team-stores";

export const runtime = "nodejs";

type IncomingItem = {
  key: string;
  size?: string;
  playerName?: string;
  playerNumber?: string;
  quantity: number;
};

// Shipping choices for the Stripe page: standard ground (live rate + margin
// when a ZIP was given, formula otherwise), an expedited option when live
// rates are available, and free local pickup.
async function shipOptions(totalOz: number, zip?: string): Promise<{ label: string; amountCents: number }[]> {
  const options: { label: string; amountCents: number }[] = [];
  if (zip && /^\d{5}$/.test(zip)) {
    try {
      const { getRates, shippoEnabled } = await import("@/lib/shippo");
      if (shippoEnabled()) {
        const rates = await getRates({ zip }, totalOz);
        if (rates.length > 0) {
          options.push({ label: `Standard shipping to ${zip}`, amountCents: rates[0].chargedCents });
          const priority = rates.find(
            (r) => r.provider === "USPS" && /priority mail(?! express)/i.test(r.service),
          );
          if (priority && priority.chargedCents > rates[0].chargedCents) {
            options.push({ label: "Faster shipping (USPS Priority, 1-3 days)", amountCents: priority.chargedCents });
          }
        }
      }
    } catch (e) {
      console.error("live rate failed, using formula:", e);
    }
  }
  if (options.length === 0) {
    options.push({ label: "Shipping (by weight)", amountCents: shippingCentsFor(totalOz) });
  }
  options.push({ label: "Free local pickup (Ocala, FL)", amountCents: 0 });
  return options;
}

const RUSH_FEE_CENTS = 500; // per piece, matches the site-wide rush policy

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!stripeEnabled() || !dbEnabled()) {
    return NextResponse.json({ error: "Checkout isn't configured yet." }, { status: 503 });
  }
  const { token } = await params;
  const store = await getStoreByHandle(token);
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  if (!store.storeActive) return NextResponse.json({ error: "This store is currently closed." }, { status: 409 });

  let items: IncomingItem[];
  let shipZip: string | undefined;
  let rush = false;
  try {
    const body = await req.json();
    items = body.items;
    shipZip = typeof body.shipZip === "string" ? body.shipZip.trim() : undefined;
    rush = body.rush === true;
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

  // Rush production: $5/piece, shows as its own line so Discord/email flag it.
  if (rush) {
    const pieces = lineItems.reduce((s, l) => s + l.quantity, 0);
    lineItems.push({
      quantity: pieces,
      price_data: {
        currency: "usd",
        unit_amount: RUSH_FEE_CENTS,
        product_data: { name: "🚨 RUSH production (~1 week)" },
      },
    });
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
      // Buyer picks: standard ground, expedited (when live-rated), or pickup.
      shipping_options: (await shipOptions(totalOz, shipZip)).map((o) => ({
        shipping_rate_data: {
          display_name: o.label,
          type: "fixed_amount" as const,
          fixed_amount: { amount: o.amountCents, currency: "usd" },
        },
      })),
      metadata: { orderType: "team_store", teamId: store.id, teamName: store.name, ...(rush ? { rush: "true" } : {}) },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Store checkout error:", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
