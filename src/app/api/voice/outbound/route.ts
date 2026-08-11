import { NextResponse } from "next/server";
import { validTwilioSignature, formParams } from "@/lib/twilio-webhook";

export const runtime = "nodejs";

const xml = (body: string) =>
  new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });

// TwiML for OUTBOUND browser softphone calls (the admin Dialer). Twilio hits
// this via the TwiML app when staff hit Call; we dial the target showing the
// shop number as caller ID. Not recorded - FL two-party consent makes
// recording outbound calls without a disclosure risky.
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/voice/outbound`
    : "https://sluggerathletics.com/api/voice/outbound";
  const params = await formParams(req);
  if (!validTwilioSignature(url, params, req.headers.get("x-twilio-signature"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const to = (params.To ?? "").replace(/[^\d+]/g, "");
  if (!/^\+1\d{10}$/.test(to)) {
    return xml(`<Say voice="Polly.Matthew">Invalid number.</Say>`);
  }
  const callerId = process.env.TWILIO_FROM || "+13524147270";
  return xml(`<Dial callerId="${callerId}" answerOnBridge="true"><Number>${to}</Number></Dial>`);
}
