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
    // Dedicated WhatsApp sender if set, else the same number as SMS.
    const waFrom = process.env.WHATSAPP_FROM || process.env.TWILIO_FROM;
    params.set("To", `whatsapp:${toNum}`);
    params.set("From", `whatsapp:${waFrom}`);
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

/** Record an outbound automated text in smsMessages so it shows in the Texts
 *  inbox thread (manual sends via /api/admin/sms already log themselves; the
 *  automated senders below did not, which left follow-ups invisible). Best-
 *  effort: a logging failure never affects the send. `staff` labels who/what
 *  sent it so auto texts are distinguishable from staff replies. */
async function logOutboundSms(phone: string, body: string, sid: string | undefined, staff = "System") {
  try {
    const to = toE164(phone);
    if (!to) return;
    const { getDb } = await import("@/db");
    const { smsMessages } = await import("@/db/schema");
    await getDb().insert(smsMessages).values({
      phone: to,
      direction: "out",
      channel: "sms",
      body: body.slice(0, 1500),
      staff,
      twilioSid: sid,
    });
  } catch (e) {
    console.error("logOutboundSms failed:", e);
  }
}

/** True if we already texted this phone something containing `needle` within
 *  the last `minutes`. Used to DEBOUNCE the "new reply" nudge so a burst of
 *  replies (e.g. the AI answering two questions in a row) sends one text, not
 *  one per message. Best-effort: on any error, returns false (send proceeds). */
export async function textedRecently(phone: string | null | undefined, needle: string, minutes: number): Promise<boolean> {
  try {
    const to = toE164(phone);
    if (!to) return false;
    const { getDb } = await import("@/db");
    const { smsMessages } = await import("@/db/schema");
    const { and, eq, gt, ilike } = await import("drizzle-orm");
    const since = new Date(Date.now() - minutes * 60_000);
    const rows = await getDb()
      .select({ id: smsMessages.id })
      .from(smsMessages)
      .where(and(eq(smsMessages.phone, to), eq(smsMessages.direction, "out"), gt(smsMessages.createdAt, since), ilike(smsMessages.body, `%${needle}%`)))
      .limit(1);
    return rows.length > 0;
  } catch (e) {
    console.error("textedRecently check failed:", e);
    return false;
  }
}

/** Text a customer an order update ONLY if they actively opted in on a form
 *  (smsOptInAt) and left a phone. Fire-and-forget: failures just log, they
 *  never break the flow that triggered them. */
export async function smsIfConsented(opts: { phone?: string | null; optInAt?: Date | null; body: string }): Promise<boolean> {
  if (!opts.optInAt || !opts.phone) return false;
  if (!withinTextingHours()) return false; // automated texts stay within 8am-7pm ET
  const r = await sendSms(opts.phone, opts.body);
  if (r.ok) await logOutboundSms(opts.phone, opts.body, r.sid);
  return r.ok;
}

/** Re-engagement / follow-up text to anyone who gave us a phone (AI leads,
 *  design-request clients, unpaid invoices) - no explicit opt-in required.
 *  Twilio's Advanced Opt-Out on the Messaging Service refuses to deliver to a
 *  number that texted STOP, so opt-outs are honored automatically. Bodies
 *  should still end with "Reply STOP to opt out." Fire-and-forget. */
// Quiet hours for AUTOMATED texting: never send outside 8am-7pm Eastern, so
// follow-ups/reminders don't land on customers late at night. Manual staff
// replies from the inbox are not gated by this.
export function withinTextingHours(now = new Date()): boolean {
  const hour = Number(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }));
  return hour >= 8 && hour < 19; // [8:00, 19:00) ET
}

export async function sendFollowUpSms(opts: { phone?: string | null; body: string }): Promise<boolean> {
  if (!opts.phone) return false;
  if (!withinTextingHours()) return false; // hold automated texts until daytime
  const r = await sendSms(opts.phone, opts.body);
  if (r.ok) await logOutboundSms(opts.phone, opts.body, r.sid, "Auto follow-up");
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
      // Twilio sometimes fires the inbound webhook before the media has
      // finished processing, so a fetch right away 404s. Retry a couple of
      // times with a short backoff before giving up.
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(12000) });
        if (res.ok) break;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
      }
      if (!res || !res.ok) { console.error("twilio media fetch failed:", res?.status, url); continue; }
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
