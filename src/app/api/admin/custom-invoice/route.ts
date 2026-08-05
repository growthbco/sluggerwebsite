import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { dbEnabled, getDb } from "@/db";
import { customInvoices } from "@/db/schema";
import { taxCents as calcTax, SALES_TAX_LABEL } from "@/lib/pricing";
import { emailCustomInvoice } from "@/lib/email";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

type LineIn = { name?: string; description?: string; quantity?: number; unitPriceCents?: number };

// Admin-only: build a free-form invoice from scratch (name items, price
// them), create a one-time Stripe payment link, email it to the customer.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled() || !stripeEnabled()) {
    return NextResponse.json({ error: "Database or Stripe not configured" }, { status: 503 });
  }

  let body: {
    customerName?: string;
    customerEmail?: string;
    lines?: LineIn[];
    notes?: string;
    taxExempt?: boolean;
    ship?: { zip?: string; weightOz?: number } | null;
  } = {};
  try { body = await req.json(); } catch {}

  const customerName = (body.customerName ?? "").trim().slice(0, 80);
  const customerEmail = (body.customerEmail ?? "").trim().slice(0, 120);
  if (!customerName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    return NextResponse.json({ error: "Customer name and a valid email are required." }, { status: 400 });
  }
  const lines = (body.lines ?? [])
    .map((l) => ({
      name: (l.name ?? "").trim().slice(0, 120),
      description: (l.description ?? "").trim().slice(0, 500) || undefined,
      quantity: Math.max(1, Math.min(999, Math.round(Number(l.quantity) || 1))),
      unitPriceCents: Math.round(Number(l.unitPriceCents) || 0),
    }))
    .filter((l) => l.name && l.unitPriceCents > 0)
    .slice(0, 20);
  if (lines.length === 0) {
    return NextResponse.json({ error: "Add at least one item with a name and a price." }, { status: 400 });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  // Banked referral credit auto-applies (same rules as team invoices): capped
  // so at least $1 is still charged, deducted from the goods and the tax base.
  // Redeemed from their balance in the webhook only when the invoice is paid.
  let creditCents = 0;
  try {
    const { getCustomer } = await import("@/lib/customers");
    const banked = (await getCustomer(customerEmail))?.referralCreditCents ?? 0;
    if (banked > 0) creditCents = Math.max(0, Math.min(banked, subtotalCents - 100));
  } catch (e) { console.error("credit lookup failed:", e); }
  const netGoodsCents = subtotalCents - creditCents;
  const taxCents = body.taxExempt ? 0 : calcTax(netGoodsCents);
  // Shipping: quoted server-side from the ZIP + weight the form sent, so the
  // charge always matches a real quote (never a client-supplied number).
  let shippingCents = 0;
  const shipZip = (body.ship?.zip ?? "").trim();
  if (/^\d{5}$/.test(shipZip)) {
    const { quoteShippingCents } = await import("@/lib/ship-quote");
    shippingCents = (await quoteShippingCents(shipZip, Number(body.ship?.weightOz) || 16)).chargedCents;
  }
  const totalCents = netGoodsCents + taxCents + shippingCents;
  const notes = (body.notes ?? "").trim().slice(0, 4000) || null;
  const reference = "INV-" + randomBytes(4).toString("hex").toUpperCase().slice(0, 6);

  try {
    const db = getDb();
    const [row] = await db
      .insert(customInvoices)
      .values({ reference, customerName, customerEmail, lines, notes, taxExempt: Boolean(body.taxExempt), subtotalCents, creditCents, shippingCents, taxCents, totalCents })
      .returning();

    // One-time Stripe payment link: one line item per invoice line + tax.
    const stripe = getStripe();
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
    const items: { price: string; quantity: number }[] = [];
    if (creditCents > 0) {
      // Stripe line items can't be negative, so with a credit the goods
      // collapse into one discounted line. The emailed invoice still itemizes.
      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: netGoodsCents,
        product_data: { name: `Invoice ${reference} (incl. $${(creditCents / 100).toFixed(2)} referral credit)` },
      });
      items.push({ price: price.id, quantity: 1 });
    } else {
      for (const l of lines) {
        const price = await stripe.prices.create({
          currency: "usd",
          unit_amount: l.unitPriceCents,
          product_data: { name: l.name },
        });
        items.push({ price: price.id, quantity: l.quantity });
      }
    }
    if (taxCents > 0) {
      const taxPrice = await stripe.prices.create({
        currency: "usd",
        unit_amount: taxCents,
        product_data: { name: SALES_TAX_LABEL },
      });
      items.push({ price: taxPrice.id, quantity: 1 });
    }
    if (shippingCents > 0) {
      const shipPrice = await stripe.prices.create({
        currency: "usd",
        unit_amount: shippingCents,
        product_data: { name: "Shipping" },
      });
      items.push({ price: shipPrice.id, quantity: 1 });
    }
    const link = await stripe.paymentLinks.create({
      line_items: items,
      restrictions: { completed_sessions: { limit: 1 } },
      // Shipping charged -> collect the delivery address on the pay page.
      ...(shippingCents > 0 ? { shipping_address_collection: { allowed_countries: ["US" as const] } } : {}),
      metadata: { kind: "custom_invoice", customInvoiceId: row.id, reference, customerName },
      after_completion: { type: "redirect", redirect: { url: `${SITE}/checkout/success` } },
    });
    await db.update(customInvoices).set({ payUrl: link.url }).where(eqId(row.id));

    // Grow the item library from what was just invoiced (non-fatal).
    try {
      const { learnInvoiceItems } = await import("@/lib/invoice-items");
      await learnInvoiceItems(lines);
    } catch (e) { console.error("invoice item learn failed:", e); }

    const emailed = await emailCustomInvoice({
      to: customerEmail,
      customerName,
      reference,
      lines,
      subtotalCents,
      creditCents,
      shippingCents,
      taxCents,
      totalCents,
      notes,
      payUrl: link.url,
    });

    return NextResponse.json({ ok: true, reference, totalCents, creditCents, shippingCents, payUrl: link.url, emailed });
  } catch (e) {
    console.error("custom invoice failed:", e);
    return NextResponse.json({ error: "Could not create the invoice" }, { status: 500 });
  }
}

import { eq } from "drizzle-orm";
function eqId(id: string) {
  return eq(customInvoices.id, id);
}
