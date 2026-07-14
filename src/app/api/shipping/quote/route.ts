import { NextResponse } from "next/server";
import { getRates, shippoEnabled } from "@/lib/shippo";
import { shippingCentsFor } from "@/lib/team-stores";

export const runtime = "nodejs";

// Public: quote the shipping CHARGE (carrier rate + margin) for a weight and
// destination ZIP. Falls back to the weight formula if Shippo is down.
export async function POST(req: Request) {
  let body: { zip?: string; weightOz?: number } = {};
  try {
    body = await req.json();
  } catch {}
  const zip = (body.zip ?? "").trim().slice(0, 10);
  const weightOz = Math.max(1, Math.min(1120, Number(body.weightOz) || 16));
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
      const rates = await getRates({ zip }, weightOz);
      if (rates.length > 0) {
        const best = rates[0];
        return NextResponse.json({
          ok: true,
          live: true,
          amountCents: best.chargedCents,
          carrier: best.provider,
          service: best.service,
          place,
        });
      }
    } catch (e) {
      console.error("live rate failed, falling back:", e);
    }
  }
  return NextResponse.json({ ok: true, live: false, amountCents: shippingCentsFor(weightOz), place });
}
