import { createHmac } from "node:crypto";

/** Validate Twilio's X-Twilio-Signature on a form-encoded webhook: HMAC-SHA1
 *  of the full URL + params (sorted by key, name+value concatenated), keyed
 *  with the auth token, base64. Rejecting forgeries keeps the voice/SMS
 *  webhooks from being driven by anyone but Twilio. */
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  return expected === signature;
}

export async function formParams(req: Request): Promise<Record<string, string>> {
  const body = await req.text();
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) out[k] = v;
  return out;
}
