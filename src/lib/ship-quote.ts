/** Charged shipping for a ZIP + weight: live Shippo quote when configured,
 *  weight-formula fallback otherwise. Used by the custom-invoice form to
 *  preview and by the send route to charge the same way. */
export async function quoteShippingCents(zip: string, weightOz: number): Promise<{ chargedCents: number; carrier?: string }> {
  const oz = Math.max(1, Math.min(1120, Math.round(weightOz)));
  try {
    const { quoteChargedShipping, shippoEnabled } = await import("@/lib/shippo");
    if (shippoEnabled() && /^\d{5}$/.test(zip)) {
      const q = await quoteChargedShipping(zip, oz);
      if (q) return { chargedCents: q.chargedCents, carrier: q.carrier };
    }
  } catch (e) {
    console.error("ship quote failed:", e);
  }
  const { shippingCentsFor } = await import("@/lib/team-stores");
  return { chargedCents: shippingCentsFor(oz) };
}
