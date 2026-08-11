import { validTwilioSignature, formParams } from "@/lib/twilio-webhook";
import { rehostTwilioMedia } from "@/lib/sms";
import { sendEmail, CONTACT_INBOX } from "@/lib/email";

export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

// Customer texts the Slugger number -> Discord ping + email to the inbox so
// nothing sits unread. (Twilio's Advanced Opt-Out already intercepts
// STOP/HELP before this webhook fires.)
export async function POST(req: Request) {
  const params = await formParams(req);
  if (!validTwilioSignature(`${SITE}/api/sms/inbound`, params, req.headers.get("x-twilio-signature"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const rawFrom = params.From ?? "unknown";
  const channel = rawFrom.startsWith("whatsapp:") ? "whatsapp" : "sms";
  const from = rawFrom.replace(/^whatsapp:/, "");
  const body = (params.Body ?? "").slice(0, 1200);
  const numMedia = Number(params.NumMedia ?? 0) || 0;
  const mediaUrls: string[] = [];
  for (let i = 0; i < Math.min(numMedia, 10); i++) {
    const u = params[`MediaUrl${i}`];
    if (u) mediaUrls.push(u);
  }
  const media = numMedia > 0 ? ` (+${numMedia} attachment${numMedia === 1 ? "" : "s"})` : "";

  // Twilio media URLs need auth - re-host to public Blob so the inbox can show
  // the images. Falls back to none if the fetch fails.
  const publicMedia = mediaUrls.length ? await rehostTwilioMedia(mediaUrls) : [];

  // Log to the admin texts inbox (non-fatal).
  try {
    const { dbEnabled, getDb } = await import("@/db");
    const { smsMessages } = await import("@/db/schema");
    if (dbEnabled()) {
      await getDb().insert(smsMessages).values({
        phone: from,
        direction: "in",
        channel,
        body,
        mediaCount: numMedia,
        mediaUrls: publicMedia.length ? publicMedia : null,
        twilioSid: params.MessageSid ?? params.SmsMessageSid ?? null,
      });
    }
  } catch (e) { console.error("sms inbox log failed:", e); }

  const hook = process.env.DISCORD_ORDERS_WEBHOOK_URL || process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (hook) {
    void fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Slugger SMS", content: `💬 ${channel === "whatsapp" ? "WhatsApp" : "Text"} from ${from}${media}:\n> ${body}\nReply: https://sluggerathletics.com/admin/texts` }),
    }).catch(() => {});
  }
  void sendEmail({
    to: CONTACT_INBOX,
    subject: `New text from ${from}`,
    html: `<p><strong>${from}</strong> texted the shop number${media}:</p><blockquote>${body.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</blockquote><p>Reply by texting them back from your phone or the Twilio console.</p>`,
  }).catch(() => {});

  // Empty TwiML = no auto-reply; humans answer.
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, { headers: { "Content-Type": "text/xml" } });
}
