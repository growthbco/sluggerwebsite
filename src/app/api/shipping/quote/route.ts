import { NextResponse } from "next/server";
import { quoteChargedShipping, shippoEnabled } from "@/lib/shippo";
import { shippingCentsFor } from "@/lib/team-stores";

export const runtime = "nodejs";

// Public: quote the shipping CHARGE (carrier rate + margin) for a weight and
// destination ZIP. Falls back to the weight formula if Shippo is down.
export async function POST(req: Request) {
  let body: { zip?: string; weightOz?: number; parcelsOz?: number[] } = {};
  try {
    body = await req.json();
  } catch {}
  const zip = (body.zip ?? "").trim().slice(0, 10);
  // Hats ship in their own box, so mixed carts quote as multiple parcels
  // (summed). A plain weightOz stays a single parcel.
  const clamp = (n: number) => Math.max(1, Math.min(1120, Math.round(n)));
  const parcels = (Array.isArray(body.parcelsOz) ? body.parcelsOz.filter((w) => Number(w) > 0).map((w) => clamp(Number(w))) : []).slice(0, 4);
  if (parcels.length === 0) parcels.push(clamp(Number(body.weightOz) || 16));
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return NextResponse.json({ error: "Enter a 5-digit ZIP code." }, { status: 400 });
  }

  // City/state for the ZIP so the buyer sees "Bronx, NY" and catches typos.
  let place: string | undefined;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip.slice(0, 5)}`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const d = await res.json();
      const p = d?.places?.[0];
      if (p) place = `${p["place name"]}, ${p["state abbreviation"]}`;
    }
  } catch {}

  if (shippoEnabled()) {
    try {
      let total = 0;
      let carrier: string | undefined;
      let service: string | undefined;
      let allLive = true;
      for (const oz of parcels) {
        const best = await quoteChargedShipping(zip, oz);
        if (!best) { allLive = false; break; }
        total += best.chargedCents;
        carrier = best.carrier;
        service = best.service;
      }
      if (allLive) {
        return NextResponse.json({ ok: true, live: true, amountCents: total, carrier, service, boxes: parcels.length, place });
      }
    } catch (e) {
      console.error("live rate failed, falling back:", e);
    }
  }
  return NextResponse.json({ ok: true, live: false, amountCents: parcels.reduce((s, w) => s + shippingCentsFor(w), 0), boxes: parcels.length, place });
}
