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
    phone: process.env.SHIP_FROM_PHONE || "3524147270",
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
  included_insurance_price?: string | null;
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
  insuranceCostCents: number;
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
    insuranceCostCents: Math.round(parseFloat(r.included_insurance_price ?? "0") * 100) || 0,
  };
}

/** Live USPS/UPS rates for a destination, cheapest first. `to` can be just a
 *  ZIP (rating) or a full address (label purchase). */
export async function getRates(
  to: { zip: string; street1?: string; street2?: string; city?: string; state?: string; name?: string },
  weightOz: number,
  insuranceValueCents = 0,
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
        // Apartment/unit/suite line - MUST reach the label or packages misdeliver.
        ...(to.street2 ? { street2: to.street2 } : {}),
        city: to.city || "City",
        state: to.state || "",
        zip: to.zip,
        country: "US",
      },
      parcels: [parcelFor(weightOz)],
      // Omitting provider tells Shippo to use its recommended XCover policy
      // rather than carrier-declared-value coverage.
      ...(insuranceValueCents > 0
        ? { extra: { insurance: { amount: (insuranceValueCents / 100).toFixed(2), currency: "USD" } } }
        : {}),
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
  insuranceValueCents = 0,
): Promise<QuotedRate[]> {
  if (!labelReady()) throw new Error("Set SHIP_FROM_STREET (your ship-from address) before buying labels.");
  return getRates(to, weightOz, insuranceValueCents);
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
export async function buyLabel(rateId: string): Promise<{ trackingNumber: string; labelUrl: string; costCents: number; insuranceCostCents: number; transactionId: string; provider: string; service: string }> {
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
    insuranceCostCents: Math.round(parseFloat(t.rate?.included_insurance_price ?? "0") * 100) || 0,
    transactionId: t.object_id,
    provider: t.rate?.provider ?? "",
    service: t.rate?.servicelevel?.name ?? "",
  };
}

/* ------------------------------------------------------------------ */
/* Carrier pickups (USPS is free; UPS charges)                         */
/* ------------------------------------------------------------------ */

/** The USPS carrier account object id, needed to schedule a USPS pickup. */
async function uspsCarrierAccount(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/carrier_accounts/?carrier=usps`, { headers: headers() });
    if (!res.ok) return null;
    const data = await res.json();
    const acct = (data.results ?? []).find((a: { active?: boolean; object_id: string }) => a.active) ?? (data.results ?? [])[0];
    return acct?.object_id ?? null;
  } catch {
    return null;
  }
}

/** Schedule a FREE USPS pickup at the ship-from address for the given label
 *  transactions on a date (all-day window). Returns a confirmation code or an
 *  error message. */
export async function scheduleUspsPickup(
  transactionIds: string[],
  dateIso: string, // YYYY-MM-DD (Eastern)
): Promise<{ ok: true; confirmation: string; alreadyScheduled?: boolean } | { ok: false; error: string }> {
  if (!shippoEnabled()) return { ok: false, error: "Shipping isn't configured." };
  if (transactionIds.length === 0) return { ok: false, error: "No USPS labels on this order to schedule a pickup for." };
  const carrierAccount = await uspsCarrierAccount();
  if (!carrierAccount) return { ok: false, error: "No USPS carrier account is connected in Shippo." };
  // USPS carrier pickup windows: 8am-5pm is a safe all-day request.
  const start = `${dateIso}T08:00:00-04:00`;
  const end = `${dateIso}T17:00:00-04:00`;
  const f = fromAddress();
  try {
    const res = await fetch(`${API}/pickups/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        carrier_account: carrierAccount,
        location: {
          building_location_type: "Front Door",
          building_type: "building", // Shippo enum; "office" is rejected as invalid.
          instructions: "Packages by the front door.",
          address: { ...f, object_id: undefined },
        },
        transactions: transactionIds,
        requested_start_time: start,
        requested_end_time: end,
        // Shippo requires a top-level contact email + phone for the pickup.
        email: f.email,
        phone: f.phone,
        is_test: false,
      }),
    });
    const data = await res.json();
    // Shippo `messages` entries can be plain strings OR {text} objects.
    const messages: string[] = (data.messages ?? [])
      .map((m: string | { text?: string }) => (typeof m === "string" ? m : m?.text))
      .filter(Boolean);
    if (!res.ok || data.status === "ERROR") {
      // USPS allows only ONE active pickup per address at a time. When one is
      // already booked, every outbound package there is collected anyway - so
      // treat this as success, not an error the user has to fight.
      if (messages.some((m) => /already\s+(requested|scheduled).*pickup/i.test(m))) {
        return { ok: true, confirmation: "already-scheduled", alreadyScheduled: true };
      }
      // Other errors arrive as `messages`, a `detail` string, or field-level
      // arrays ({email:["required"]}).
      const fieldMsgs = Object.entries(data)
        .filter(([k, v]) => Array.isArray(v) && k !== "messages" && k !== "transactions")
        .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`);
      const msg =
        messages.join("; ") ||
        (typeof data.detail === "string" ? data.detail : "") ||
        fieldMsgs.join("; ");
      console.error("Shippo pickup failed:", res.status, JSON.stringify(data).slice(0, 500));
      return { ok: false, error: msg || "USPS couldn't schedule that pickup - try another date." };
    }
    return { ok: true, confirmation: data.confirmation_code ?? data.object_id ?? "scheduled" };
  } catch (e) {
    console.error("Shippo pickup error:", e);
    return { ok: false, error: "Could not reach the carrier to schedule the pickup." };
  }
}

/* ------------------------------------------------------------------ */
/* Live tracking status                                                */
/* ------------------------------------------------------------------ */

function shippoTrackingCarrier(carrier: string | null | undefined): string | null {
  const normalized = (carrier ?? "").trim().toLowerCase();
  if (normalized.includes("fedex")) return "fedex";
  if (normalized.includes("ups")) return "ups";
  if (normalized.includes("usps") || normalized.includes("postal")) return "usps";
  if (normalized.includes("dhl")) return "dhl_express";
  return null;
}

export type LiveTracking = {
  status: string; // e.g. "In transit", "Delivered"
  detail?: string;
  location?: string; // "Memphis, TN"
  at?: string; // ISO date of the latest scan
};

// Dashboard loads shouldn't hammer Shippo: cache per tracking number for a
// few minutes (best-effort - serverless instances each keep their own).
const trackCache = new Map<string, { at: number; value: LiveTracking | null }>();
const TRACK_TTL_MS = 5 * 60 * 1000;

/** Latest scan status for a tracking number (works for shipments not bought
 *  through Shippo). Returns null when the carrier is unsupported, the number
 *  isn't in the carrier's system yet, or anything fails - callers just skip
 *  the status line. */
export async function getLiveTracking(carrier: string | null | undefined, trackingNumber: string): Promise<LiveTracking | null> {
  if (!shippoEnabled()) return null;
  const slug = shippoTrackingCarrier(carrier);
  if (!slug || !trackingNumber) return null;

  const key = `${slug}:${trackingNumber}`;
  const hit = trackCache.get(key);
  if (hit && Date.now() - hit.at < TRACK_TTL_MS) return hit.value;

  try {
    const res = await fetch(`${API}/tracks/${slug}/${encodeURIComponent(trackingNumber)}`, {
      headers: headers(),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      trackCache.set(key, { at: Date.now(), value: null });
      return null;
    }
    const data = (await res.json()) as {
      tracking_status?: {
        status?: string;
        status_details?: string;
        status_date?: string;
        location?: { city?: string; state?: string };
      } | null;
    };
    const ts = data.tracking_status;
    if (!ts?.status) {
      trackCache.set(key, { at: Date.now(), value: null });
      return null;
    }
    const STATUS_LABELS: Record<string, string> = {
      PRE_TRANSIT: "Label created",
      TRANSIT: "In transit",
      DELIVERED: "Delivered",
      RETURNED: "Returned",
      FAILURE: "Delivery problem",
      UNKNOWN: "Status unknown",
    };
    const value: LiveTracking = {
      status: STATUS_LABELS[ts.status] ?? ts.status,
      detail: ts.status_details || undefined,
      location: [ts.location?.city, ts.location?.state].filter(Boolean).join(", ") || undefined,
      at: ts.status_date || undefined,
    };
    trackCache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    console.error("Shippo tracking lookup failed:", e);
    return null;
  }
}
