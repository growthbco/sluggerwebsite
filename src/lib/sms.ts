// Twilio SMS. Stays dormant until the env vars are set (post-A2P approval):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either
//   TWILIO_MESSAGING_SERVICE_SID (preferred - carries the A2P campaign) or
//   TWILIO_FROM (the raw number).
// STOP/HELP opt-outs are handled by Twilio's built-in Advanced Opt-Out on the
// Messaging Service, so we never text an opted-out number.

export const smsEnabled = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM),
  );

/** Normalize a US phone to E.164 (+1XXXXXXXXXX). Returns null if not a
 *  plausible 10-digit US number. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Send one SMS or WhatsApp message. Non-fatal by design: resolves with
 *  ok:false on any failure so order flows never break because a text didn't
 *  go out. Returns the Twilio message SID on success for logging. */
export async function sendSms(
  to: string,
  body: string,
  channel: "sms" | "whatsapp" = "sms",
): Promise<{ ok: boolean; sid?: string }> {
  if (!smsEnabled()) return { ok: false };
  const toNum = toE164(to);
  if (!toNum) return { ok: false };
  const acct = process.env.TWILIO_ACCOUNT_SID!;
  const params = new URLSearchParams({ Body: body.slice(0, 1500) });
  if (channel === "whatsapp") {
    params.set("To", `whatsapp:${toNum}`);
    params.set("From", `whatsapp:${process.env.TWILIO_FROM}`);
  } else {
    params.set("To", toNum);
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      params.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
    } else {
      params.set("From", process.env.TWILIO_FROM!);
    }
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acct}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${acct}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (!res.ok) {
      console.error("Twilio send failed:", res.status, await res.text());
      return { ok: false };
    }
    const data = await res.json();
    return { ok: true, sid: data.sid };
  } catch (e) {
    console.error("Twilio send error:", e);
    return { ok: false };
  }
}
