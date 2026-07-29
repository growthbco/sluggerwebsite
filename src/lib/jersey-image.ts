import sharp from "sharp";

// Shared jersey-image generation with Pro -> Flash fallback, so both the
// public Jersey Maker and the staff design studio survive Gemini Pro outages.
const PRIMARY = "gemini-3-pro-image";
const FALLBACK = process.env.DESIGN_LAB_FALLBACK_MODEL || "gemini-2.5-flash-image";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type ImagePart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type GenResult = { data: string; mime: string; usedFallback: boolean } | { error: string; status: number };

/** Generate/edit an image from parts. Tries Pro once; on 429/5xx/timeout,
 *  falls back to Flash. Returns base64 data + mime, or an error. */
export async function generateJerseyImage(parts: ImagePart[], aspectRatio = "4:3"): Promise<GenResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "Image AI not configured", status: 503 };
  const call = (model: string) =>
    fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
      }),
      signal: AbortSignal.timeout(40000),
    });

  // Try Pro once; then Flash with a retry, since Flash is fast and a single
  // transient 503 shouldn't sink the whole request.
  const plan: { model: string; tries: number }[] = [
    { model: PRIMARY, tries: 1 },
    { model: FALLBACK, tries: 2 },
  ];
  let res: Response | null = null;
  let usedFallback = false;
  outer: for (const { model, tries } of plan) {
    for (let t = 0; t < tries; t++) {
      try {
        res = await call(model);
        if (res.ok) { usedFallback = model === FALLBACK; break outer; }
        const status = res.status;
        console.error(`jersey-image ${model} attempt ${t + 1} failed:`, status);
        if (!(status === 429 || status >= 500)) break outer; // 400 won't improve
      } catch {
        res = null; // timeout/abort -> retry or fall through
      }
    }
  }
  if (!res || !res.ok) return { error: "Image AI is briefly overloaded - try again in a minute.", status: 503 };

  const data = await res.json();
  const img = data?.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string; mimeType: string }; inline_data?: { data: string; mime_type: string } }) => p.inlineData || p.inline_data,
  );
  const payload = img?.inlineData ?? img?.inline_data;
  if (!payload?.data) return { error: "No image came back - try rewording.", status: 502 };
  return { data: payload.data, mime: payload.mimeType ?? payload.mime_type ?? "image/png", usedFallback };
}

export function parseDataUrl(u?: string | null): { mime_type: string; data: string } | null {
  const m = u?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  return m ? { mime_type: m[1], data: m[2] } : null;
}

/** Bake a repeating diagonal "SLUGGER ATHLETICS" watermark across the WHOLE
 *  frame - over the jerseys included - so the wording flows continuously and
 *  never gets cut off behind the mockup, while still protecting the artwork
 *  from being shopped to another printer. Returns base64 PNG (falls back to
 *  the input on error). */
export async function watermarkImage(b64: string): Promise<string> {
  try {
    const srcBuf = Buffer.from(b64, "base64");
    const { width = 1200, height = 900 } = await sharp(srcBuf).metadata();
    const tileW = Math.round(width * 0.36);
    const tileH = Math.round(height * 0.2);
    const fontSize = Math.max(22, Math.round(width * 0.03));
    const overlay = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="p" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
            <text x="0" y="${Math.round(tileH * 0.55)}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" letter-spacing="3" fill="#5b6470" fill-opacity="0.17">SLUGGER ATHLETICS</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#p)"/>
      </svg>`,
    );
    const stamped = await sharp(srcBuf).composite([{ input: overlay }]).png().toBuffer();
    return stamped.toString("base64");
  } catch (e) {
    console.error("watermarkImage failed (returning unstamped):", e);
    return b64;
  }
}
