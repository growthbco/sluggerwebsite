import type Stripe from "stripe";

export const SHIPPING_PROTECTION_NAME = "Package Protection (XCover)";
export const DOMESTIC_PROTECTION_BPS = 125; // Shippo/XCover: 1.25%

/** Customer-facing pass-through price. The merchandise value is exact; the
 * postage portion uses the estimated carrier cost (not Slugger's marked-up
 * shipping charge), so protection itself is never a profit center. */
export function shippingProtectionCents(merchandiseCents: number, estimatedPostageCents = 0): number {
  const protectedCents = Math.max(0, Math.round(merchandiseCents)) + Math.max(0, Math.round(estimatedPostageCents));
  return Math.max(1, Math.round((protectedCents * DOMESTIC_PROTECTION_BPS) / 10_000));
}

/** Shipping charged to customers includes a 25% handling margin and is rounded
 * up to a quarter. Reverse that only for the protection estimate; XCover will
 * calculate its final charge from the actual label selected later. */
export function estimatedPostageFromChargedShipping(chargedCents: number): number {
  return Math.max(0, Math.floor(Math.max(0, chargedCents) / 1.25));
}

export function isShippingProtectionLine(name: string | null | undefined): boolean {
  return Boolean(name && /^package protection\b/i.test(name.trim()));
}

export async function createShippingProtectionPrice(
  stripe: Stripe,
  chargeCents: number,
  merchandiseValueCents: number,
): Promise<string> {
  const coverage = `$${(Math.max(0, merchandiseValueCents) / 100).toFixed(2)}`;
  const product = await stripe.products.create({
    name: SHIPPING_PROTECTION_NAME,
    description: `Optional protection for eligible loss, theft, or transit damage on up to ${coverage} of merchandise. Subject to XCover terms and claim requirements.`,
    metadata: { kind: "shipping_protection", merchandiseValueCents: String(Math.max(0, merchandiseValueCents)) },
  });
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: Math.max(1, Math.round(chargeCents)),
    product: product.id,
  });
  return price.id;
}
