import { validTwilioSignature, formParams } from "@/lib/twilio-webhook";
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
  const from = params.From ?? "unknown";
  const body = (params.Body ?? "").slice(0, 1200);
  const media = Number(params.NumMedia ?? 0) > 0 ? ` (+${params.NumMedia} attachment${params.NumMedia === "1" ? "" : "s"})` : "";

  const hook = process.env.DISCORD_ORDERS_WEBHOOK_URL || process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (hook) {
    void fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Slugger SMS", content: `💬 Text from ${from}${media}:\n> ${body}` }),
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
