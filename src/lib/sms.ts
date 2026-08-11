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
  mediaUrls: string[] = [],
): Promise<{ ok: boolean; sid?: string }> {
  if (!smsEnabled()) return { ok: false };
  const toNum = toE164(to);
  if (!toNum) return { ok: false };
  const acct = process.env.TWILIO_ACCOUNT_SID!;
  const params = new URLSearchParams({ Body: body.slice(0, 1500) });
  // MMS: attach up to 10 public image URLs (our Vercel Blob links). Twilio
  // fetches and forwards them; larger sends are capped by the carrier.
  for (const u of mediaUrls.slice(0, 10)) params.append("MediaUrl", u);
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

/** Text a customer an order update ONLY if they actively opted in on a form
 *  (smsOptInAt) and left a phone. Fire-and-forget: failures just log, they
 *  never break the flow that triggered them. */
export async function smsIfConsented(opts: { phone?: string | null; optInAt?: Date | null; body: string }): Promise<boolean> {
  if (!opts.optInAt || !opts.phone) return false;
  const r = await sendSms(opts.phone, opts.body);
  return r.ok;
}

/** Re-engagement / follow-up text to anyone who gave us a phone (AI leads,
 *  design-request clients, unpaid invoices) - no explicit opt-in required.
 *  Twilio's Advanced Opt-Out on the Messaging Service refuses to deliver to a
 *  number that texted STOP, so opt-outs are honored automatically. Bodies
 *  should still end with "Reply STOP to opt out." Fire-and-forget. */
export async function sendFollowUpSms(opts: { phone?: string | null; body: string }): Promise<boolean> {
  if (!opts.phone) return false;
  const r = await sendSms(opts.phone, opts.body);
  return r.ok;
}


/** Twilio MMS media URLs require account auth, so a browser <img> can't load
 *  them. Download each with auth and re-host to public Vercel Blob; return the
 *  public URLs (skips any that fail). Used on inbound to make customer images
 *  viewable in the Texts inbox. */
export async function rehostTwilioMedia(urls: string[]): Promise<string[]> {
  const acct = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!acct || !token || urls.length === 0) return [];
  const { put } = await import("@vercel/blob");
  const auth = "Basic " + Buffer.from(`${acct}:${token}`).toString("base64");
  const out: string[] = [];
  for (const url of urls.slice(0, 10)) {
    try {
      const res = await fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) { console.error("twilio media fetch failed:", res.status, url); continue; }
      const type = res.headers.get("content-type") || "image/jpeg";
      const ext = type.includes("png") ? "png" : type.includes("gif") ? "gif" : type.includes("webp") ? "webp" : "jpg";
      const bytes = Buffer.from(await res.arrayBuffer());
      const blob = await put(`sms-inbound/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, bytes, { access: "public", contentType: type });
      out.push(blob.url);
    } catch (e) {
      console.error("rehostTwilioMedia error:", e);
    }
  }
  return out;
}
