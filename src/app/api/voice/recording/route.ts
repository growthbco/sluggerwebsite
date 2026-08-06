import { validTwilioSignature, formParams } from "@/lib/twilio-webhook";

export const runtime = "nodejs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

// Twilio tells us a call recording is ready -> drop the link in Discord so
// the call log lives with everything else.
export async function POST(req: Request) {
  const params = await formParams(req);
  if (!validTwilioSignature(`${SITE}/api/voice/recording`, params, req.headers.get("x-twilio-signature"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const hook = process.env.DISCORD_ORDERS_WEBHOOK_URL || process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (hook && params.RecordingUrl) {
    const dur = params.RecordingDuration ? `${params.RecordingDuration}s` : "";
    void fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Slugger Phone",
        content: `📞 Call recording ready (${dur}) from ${params.From ?? "unknown"}\n${params.RecordingUrl}.mp3`,
      }),
    }).catch(() => {});
  }
  return new Response("ok");
}
