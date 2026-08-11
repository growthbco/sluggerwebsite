import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

const b64url = (input: Buffer | string) =>
  (typeof input === "string" ? Buffer.from(input) : input).toString("base64url");

// Twilio Voice access token (hand-rolled JWT, HS256) for the admin browser
// softphone - grants outgoing calls through our TwiML app. 1-hour TTL; the
// dialer refreshes it on expiry.
export async function GET() {
  const session = await getAdminSession();
  if (!session || session.role === "designer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const acct = process.env.TWILIO_ACCOUNT_SID;
  const keySid = process.env.TWILIO_API_KEY_SID;
  const secret = process.env.TWILIO_API_KEY_SECRET;
  const appSid = process.env.TWILIO_TWIML_APP_SID;
  if (!acct || !keySid || !secret || !appSid) {
    return NextResponse.json({ error: "Softphone isn't configured." }, { status: 503 });
  }

  const now = Math.floor(Date.now() / 1000);
  // Shared identity: every staff browser registers as "slugger" so the
  // inbound <Client>slugger</Client> leg reaches whoever is online.
  const identity = "slugger";
  const header = { typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${keySid}-${now}`,
    iss: keySid,
    sub: acct,
    iat: now,
    exp: now + 3600,
    grants: { identity, voice: { outgoing: { application_sid: appSid }, incoming: { allow: true } } },
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = b64url(createHmac("sha256", secret).update(unsigned).digest());
  return NextResponse.json({ token: `${unsigned}.${sig}`, identity });
}
