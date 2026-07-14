// Shippo integration: live USPS/UPS rates and label purchase.
// Customers are charged rate + SHIPPING_MARGIN (see team-stores.ts); labels
// are bought at actual cost from the admin dashboard.

import { SHIPPING_MARGIN } from "@/lib/team-stores";

const API = "https://api.goshippo.com";

export function shippoEnabled(): boolean {
  return Boolean(process.env.SHIPPO_API_KEY);
}

function headers() {
  return {
    Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// Ship-from address. ZIP drives rate accuracy; the full street address is
// only required to PRINT labels (env-configured so it never lives in code).
function fromAddress() {
  return {
    name: process.env.SHIP_FROM_NAME || "Slugger Athletics",
    street1: process.env.SHIP_FROM_STREET || "",
    city: process.env.SHIP_FROM_CITY || "Ocala",
    state: process.env.SHIP_FROM_STATE || "FL",
    zip: process.env.SHIP_FROM_ZIP || "34470",
    country: "US",
    phone: process.env.SHIP_FROM_PHONE || "3526601232",
    email: "apparel@sluggerathletics.com",
  };
}

export function labelReady(): boolean {
  return shippoEnabled() && Boolean(process.env.SHIP_FROM_STREET);
}

type ShippoRate = {
  object_id: string;
  amount: string;
  currency: string;
  provider: string;
  servicelevel: { name: string };
  estimated_days: number | null;
};

function parcelFor(weightOz: number) {
  // One box class up to 10 lb (16x12x8 is just over the USPS "cubic" volume
  // threshold, so everything prices by weight): keeps quotes monotonic -
  // adding an item can never make shipping cheaper, which buyers read as a
  // bug. Above 10 lb, a large box (dim-weight applies, real for big hauls).
  const dims =
    weightOz <= 160
      ? { length: "16", width: "12", height: "8" }
      : { length: "18", width: "16", height: "12" };
  return {
    ...dims,
    distance_unit: "in",
    weight: String(Math.max(1, Math.round(weightOz))),
    mass_unit: "oz",
  };
}

export type QuotedRate = {
  rateId: string;
  provider: string;
  service: string;
  costCents: number;
  chargedCents: number;
  estimatedDays: number | null;
};

function toQuoted(r: ShippoRate): QuotedRate {
  const costCents = Math.round(parseFloat(r.amount) * 100);
  return {
    rateId: r.object_id,
    provider: r.provider,
    service: r.servicelevel.name,
    costCents,
    chargedCents: Math.ceil((costCents * (1 + SHIPPING_MARGIN)) / 25) * 25,
    estimatedDays: r.estimated_days,
  };
}

/** Live USPS/UPS rates for a destination, cheapest first. `to` can be just a
 *  ZIP (rating) or a full address (label purchase). */
export async function getRates(
  to: { zip: string; street1?: string; city?: string; state?: string; name?: string },
  weightOz: number,
): Promise<QuotedRate[]> {
  if (!shippoEnabled()) throw new Error("SHIPPO_API_KEY not configured");
  const res = await fetch(`${API}/shipments/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      address_from: fromAddress(),
      address_to: {
        name: to.name || "Customer",
        street1: to.street1 || "1 Main St", // placeholder is fine for rating; rates key off ZIP
        city: to.city || "City",
        state: to.state || "",
        zip: to.zip,
        country: "US",
      },
      parcels: [parcelFor(weightOz)],
      async: false,
    }),
  });
  if (!res.ok) {
    console.error("Shippo shipment failed:", res.status, await res.text());
    throw new Error("Could not get live rates");
  }
  const data = await res.json();
  const rates: ShippoRate[] = (data.rates ?? []).filter(
    (r: ShippoRate) => ["USPS", "UPS"].includes(r.provider) && r.currency === "USD",
  );
  return rates.map(toQuoted).sort((a, b) => a.costCents - b.costCents);
}

/** Full-address rates for buying a label (returns shipment rates keyed to a
 *  real destination so the purchased label is valid). */
export async function getLabelRates(
  to: { name: string; street1: string; street2?: string; city: string; state: string; zip: string },
  weightOz: number,
): Promise<QuotedRate[]> {
  if (!labelReady()) throw new Error("Set SHIP_FROM_STREET (your ship-from address) before buying labels.");
  return getRates(to, weightOz);
}

/** Cheapest ground charge for a ZIP + weight, with a monotonicity guard:
 *  carrier tables sometimes price a heavier package LOWER (USPS quirks),
 *  which buyers read as a bug when adding items drops the price. We floor
 *  the charge at the 1.5 lb quote so it never decreases as the cart grows. */
export async function quoteChargedShipping(
  zip: string,
  weightOz: number,
): Promise<{ chargedCents: number; carrier: string; service: string } | null> {
  const rates = await getRates({ zip }, weightOz);
  if (rates.length === 0) return null;
  let best = rates[0];
  if (weightOz > 24) {
    try {
      const light = await getRates({ zip }, 24);
      if (light.length > 0 && light[0].chargedCents > best.chargedCents) {
        best = { ...best, chargedCents: light[0].chargedCents };
      }
    } catch {}
  }
  return { chargedCents: best.chargedCents, carrier: best.provider, service: best.service };
}

/** Buy the label for a previously quoted rate. Returns tracking + label PDF. */
export async function buyLabel(rateId: string): Promise<{ trackingNumber: string; labelUrl: string; costCents: number }> {
  if (!labelReady()) throw new Error("Set SHIP_FROM_STREET (your ship-from address) before buying labels.");
  const res = await fetch(`${API}/transactions/`, {
    method: "POST",
    headers: headers(),
    // 4x6 PDF prints natively on thermal label printers (and fine on paper).
    body: JSON.stringify({ rate: rateId, label_file_type: "PDF_4x6", async: false }),
  });
  if (!res.ok) {
    console.error("Shippo transaction failed:", res.status, await res.text());
    throw new Error("Label purchase failed");
  }
  const t = await res.json();
  if (t.status !== "SUCCESS") {
    const msg = (t.messages ?? []).map((m: { text: string }) => m.text).join("; ");
    throw new Error(`Label purchase failed: ${msg || t.status}`);
  }
  return {
    trackingNumber: t.tracking_number,
    labelUrl: t.label_url,
    costCents: Math.round(parseFloat(t.rate?.amount ?? "0") * 100),
  };
}
