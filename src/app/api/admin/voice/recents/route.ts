import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { namesByPhone } from "@/lib/sms-crm";

export const runtime = "nodejs";

// Recent calls on the shop line for the Dialer's Recents tab, straight from
// Twilio's call log (both directions), with customer names attached.
export async function GET() {
  const session = await getAdminSession();
  if (!session || session.role === "designer") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const acct = process.env.TWILIO_ACCOUNT_SID;
  const ourNumber = process.env.TWILIO_FROM || "+13524147270";
  if (!acct || !process.env.TWILIO_AUTH_TOKEN) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const auth = "Basic " + Buffer.from(`${acct}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");

  try {
    const [outRes, inRes, names] = await Promise.all([
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${acct}/Calls.json?From=${encodeURIComponent(ourNumber)}&PageSize=20`, { headers: { Authorization: auth } }),
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${acct}/Calls.json?To=${encodeURIComponent(ourNumber)}&PageSize=20`, { headers: { Authorization: auth } }),
      namesByPhone(),
    ]);
    const out = outRes.ok ? (await outRes.json()).calls ?? [] : [];
    const inc = inRes.ok ? (await inRes.json()).calls ?? [] : [];
    type TwilioCall = { sid: string; to: string; from: string; start_time: string; duration: string; status: string; parent_call_sid: string | null };
    const key = (p: string) => p.replace(/\D/g, "").slice(-10);
    const calls = [...(out as TwilioCall[]).map((c) => ({ c, direction: "out" as const, other: c.to })), ...(inc as TwilioCall[]).map((c) => ({ c, direction: "in" as const, other: c.from }))]
      // Child legs (our forward-to-cell dial, browser client legs) duplicate
      // the parent call - keep parents and real numbers only.
      .filter(({ c, other }) => !c.parent_call_sid && /^\+?1?\d{10}$/.test(other.replace(/\D/g, "")))
      .sort((a, b) => +new Date(b.c.start_time) - +new Date(a.c.start_time))
      .slice(0, 20)
      .map(({ c, direction, other }) => ({
        direction,
        number: other,
        name: names.get(key(other)) ?? null,
        at: c.start_time,
        durationSec: Number(c.duration) || 0,
        status: c.status,
      }));
    return NextResponse.json({ calls });
  } catch (e) {
    console.error("voice recents failed:", e);
    return NextResponse.json({ error: "Could not load call history" }, { status: 502 });
  }
}
