import sharp from "sharp";

// Shared jersey-image generation with a Pro -> Flash -> OpenAI fallback chain,
// so both the public Jersey Maker and the staff design studio survive Gemini
// outages. The first two tiers are Google (single-vendor), so a Google-side
// capacity blip takes out both; OpenAI's gpt-image-1 is the cross-vendor
// backstop that keeps generation working when Google is down. It only runs
// when OPENAI_API_KEY is set, so it stays dormant until the key is added.
const PRIMARY = "gemini-3-pro-image";
const FALLBACK = process.env.DESIGN_LAB_FALLBACK_MODEL || "gemini-2.5-flash-image";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2-2026-04-21";
const OPENAI_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "high";
// Which vendor leads. Default OpenAI (image-2) - it renders embroidery,
// logos, and lettering more crisply; Gemini is the fallback. Set
// IMAGE_PRIMARY_VENDOR=gemini to flip back without a code change.
const PRIMARY_VENDOR = (process.env.IMAGE_PRIMARY_VENDOR || "openai").toLowerCase();

export type ImagePart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type GenResult = { data: string; mime: string; usedFallback: boolean } | { error: string; status: number };

// gpt-image-1 only supports square / 3:2 landscape / 2:3 portrait sizes; map
// our requested aspect ratio to the nearest one.
function openaiSize(aspectRatio: string): string {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (w && h) {
    if (w / h > 1.15) return "1536x1024";
    if (h / w > 1.15) return "1024x1536";
  }
  return "1024x1024";
}

/** Cross-vendor backstop: generate/edit on OpenAI's gpt-image-1. Uses the
 *  edits endpoint when seed/reference images are present (logo, base mockup),
 *  otherwise plain generation. Returns base64 PNG or null (never throws). */
async function openaiImage(parts: ImagePart[], aspectRatio: string, quality: string): Promise<{ data: string; mime: string } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const prompt = parts
    .filter((p): p is { text: string } => "text" in p)
    .map((p) => p.text)
    .join(" ")
    .slice(0, 30000);
  if (!prompt) return null;
  const images = parts.filter((p): p is { inline_data: { mime_type: string; data: string } } => "inline_data" in p);
  const size = openaiSize(aspectRatio);
  try {
    let res: Response;
    if (images.length) {
      const form = new FormData();
      form.append("model", OPENAI_MODEL);
      form.append("prompt", prompt);
      form.append("size", size);
      form.append("quality", quality);
      images.slice(0, 4).forEach((im, i) => {
        const buf = Buffer.from(im.inline_data.data, "base64");
        form.append("image[]", new Blob([new Uint8Array(buf)], { type: im.inline_data.mime_type || "image/png" }), `ref${i}.png`);
      });
      res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(75000),
      });
    } else {
      res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: OPENAI_MODEL, prompt, size, quality, n: 1 }),
        signal: AbortSignal.timeout(75000),
      });
    }
    if (!res.ok) {
      console.error("openai image fallback failed:", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const j = await res.json();
    const b64 = j?.data?.[0]?.b64_json;
    return b64 ? { data: b64, mime: "image/png" } : null;
  } catch (e) {
    console.error("openai image fallback error:", e);
    return null;
  }
}

// Gemini tier (Pro once, then Flash with a retry). Returns the image, or null
// if Gemini is unconfigured / down / returned no image.
async function geminiImage(parts: ImagePart[], aspectRatio: string): Promise<{ data: string; mime: string; usedFlash: boolean } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
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

  const plan: { model: string; tries: number }[] = [
    { model: PRIMARY, tries: 1 },
    { model: FALLBACK, tries: 2 },
  ];
  let res: Response | null = null;
  let usedFlash = false;
  outer: for (const { model, tries } of plan) {
    for (let t = 0; t < tries; t++) {
      try {
        res = await call(model);
        if (res.ok) { usedFlash = model === FALLBACK; break outer; }
        console.error(`jersey-image ${model} attempt ${t + 1} failed:`, res.status);
        if (!(res.status === 429 || res.status >= 500)) break outer; // 400 won't improve
      } catch {
        res = null; // timeout/abort -> retry or fall through
      }
    }
  }
  if (!res || !res.ok) return null;
  const data = await res.json();
  const img = data?.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string; mimeType: string }; inline_data?: { data: string; mime_type: string } }) => p.inlineData || p.inline_data,
  );
  const payload = img?.inlineData ?? img?.inline_data;
  if (!payload?.data) return null;
  return { data: payload.data, mime: payload.mimeType ?? payload.mime_type ?? "image/png", usedFlash };
}

/** Generate/edit an image from parts across two vendors for reliability.
 *  Default order is OpenAI (image-2) first, then Gemini as the fallback
 *  (flip with IMAGE_PRIMARY_VENDOR=gemini). `usedFallback` is true whenever
 *  the non-primary vendor (or Gemini's Flash tier) produced the image. Pass
 *  { forceOpenai: true } to use only the OpenAI tier. */
export async function generateJerseyImage(
  parts: ImagePart[],
  aspectRatio = "4:3",
  opts: { forceOpenai?: boolean; quality?: string } = {},
): Promise<GenResult> {
  const openaiFirst = opts.forceOpenai || PRIMARY_VENDOR === "openai";
  const quality = opts.quality || OPENAI_QUALITY;

  const tryOpenai = async (isPrimary: boolean): Promise<GenResult | null> => {
    const r = await openaiImage(parts, aspectRatio, quality);
    return r ? { data: r.data, mime: r.mime, usedFallback: !isPrimary } : null;
  };
  const tryGemini = async (isPrimary: boolean): Promise<GenResult | null> => {
    const r = await geminiImage(parts, aspectRatio);
    return r ? { data: r.data, mime: r.mime, usedFallback: !isPrimary || r.usedFlash } : null;
  };

  const tiers = opts.forceOpenai
    ? [() => tryOpenai(true)]
    : openaiFirst
      ? [() => tryOpenai(true), () => tryGemini(false)]
      : [() => tryGemini(true), () => tryOpenai(false)];

  for (const tier of tiers) {
    const out = await tier();
    if (out) return out;
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return { error: "Image AI not configured", status: 503 };
  }
  return { error: "Image AI is briefly overloaded - try again in a minute.", status: 503 };
}

export function parseDataUrl(u?: string | null): { mime_type: string; data: string } | null {
  const m = u?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  return m ? { mime_type: m[1], data: m[2] } : null;
}

// The Slugger logo, fetched once per instance from the site's public asset.
// We watermark with the logo IMAGE (not SVG text) because the serverless
// runtime's librsvg has no fonts - SVG <text> renders blank there, which is
// why the old text watermark silently disappeared.
let logoB64: string | null = null;
async function getLogo(): Promise<string | null> {
  if (logoB64) return logoB64;
  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
    const res = await fetch(`${site}/slugger-logo.png`);
    if (!res.ok) return null;
    logoB64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return logoB64;
  } catch {
    return null;
  }
}

/** Bake a repeating diagonal Slugger-logo watermark across the WHOLE frame so
 *  the branding flows continuously (never cut off behind the mockup) and the
 *  artwork can't be shopped to another printer. Uses the logo image (renders
 *  reliably in serverless, unlike SVG text). Returns base64 PNG (falls back to
 *  the input on error). */
export async function watermarkImage(b64: string): Promise<string> {
  try {
    const srcBuf = Buffer.from(b64, "base64");
    const { width = 1200, height = 900 } = await sharp(srcBuf).metadata();
    const logo = await getLogo();
    if (!logo) return b64; // no logo asset -> leave unstamped rather than blank
    const tileW = Math.round(width * 0.34);
    const tileH = Math.round(width * 0.28);
    const logoW = Math.round(width * 0.22);
    const overlay = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="p" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
            <image href="data:image/png;base64,${logo}" x="0" y="${Math.round(tileH * 0.2)}" width="${logoW}" opacity="0.16"/>
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
