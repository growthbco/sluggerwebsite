import { validTwilioSignature, formParams } from "@/lib/twilio-webhook";

export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
// Where inbound calls to the Twilio number ring. Florida is a two-party
// consent state, so the caller ALWAYS hears the recording disclosure first.
const FORWARD_TO = process.env.TWILIO_VOICE_FORWARD_TO || "+12152816117";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Inbound call -> recorded-call disclosure -> forward to the shop phone.
export async function POST(req: Request) {
  const params = await formParams(req);
  if (!validTwilioSignature(`${SITE}/api/voice/inbound`, params, req.headers.get("x-twilio-signature"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thanks for calling Slugger Athletics. This call may be recorded for quality purposes.</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${esc(`${SITE}/api/voice/recording`)}" answerOnBridge="true" callerId="${esc(params.To ?? "")}">
    <Number>${esc(FORWARD_TO)}</Number>
  </Dial>
</Response>`;
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
