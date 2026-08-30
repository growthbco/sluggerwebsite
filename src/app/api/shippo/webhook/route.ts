import { NextResponse } from "next/server";
import { syncOutstandingDeliveries } from "@/lib/delivery-recording";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Shippo does not currently document a signed webhook header. Treat the
 * payload only as a hint, then independently fetch the carrier status through
 * Shippo before recording delivery. */
export async function POST(req: Request) {
  let payload: { event?: string; data?: { tracking_number?: string } };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (payload.event !== "track_updated" || !payload.data?.tracking_number) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const results = await syncOutstandingDeliveries({ trackingNumber: payload.data.tracking_number });
  return NextResponse.json({ ok: true, matched: results.length });
}
