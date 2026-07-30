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
// gpt-image-2 at high quality routinely takes 60-150s. The old 75s cap made
// every call abort and silently fall back to Gemini - the "why does the app
// look worse than the playground" bug. Give it real time to finish.
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_IMAGE_TIMEOUT_MS) || 180000;
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
        signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      });
    } else {
      res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: OPENAI_MODEL, prompt, size, quality, n: 1 }),
        signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
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

// Gemini tier. When it's the PRIMARY vendor it tries Pro (best quality) then
// Flash; but as a mere FALLBACK (OpenAI is primary) it uses ONLY the cheap
// Flash model - the expensive Gemini-3-Pro image was quietly running up the
// bill every time OpenAI failed or moderation-blocked a design. flashOnly cuts
// that ~10x.
async function geminiImage(parts: ImagePart[], aspectRatio: string, flashOnly = false): Promise<{ data: string; mime: string; usedFlash: boolean } | null> {
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

  const plan: { model: string; tries: number }[] = flashOnly
    ? [{ model: FALLBACK, tries: 2 }]
    : [
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
    if (r) console.log(`image: OpenAI ${OPENAI_MODEL} (${quality})${isPrimary ? "" : " [fallback]"}`);
    return r ? { data: r.data, mime: r.mime, usedFallback: !isPrimary } : null;
  };
  const tryGemini = async (isPrimary: boolean): Promise<GenResult | null> => {
    // As a fallback, only use the cheap Flash model - never the pricey Pro.
    const r = await geminiImage(parts, aspectRatio, !isPrimary);
    if (r) console.log(`image: Gemini ${r.usedFlash ? FALLBACK : PRIMARY}${isPrimary ? "" : " [fallback]"}`);
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

// Flood-fill the near-white background inward from the image borders, so we
// know which pixels are the empty backdrop vs. the product. mask[i] === 1 means
// background. A small margin keeps the watermark off the product's edge/shadow.
function backgroundMask(rgba: Buffer, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const nearWhite = (i: number) => rgba[i * 4] >= 236 && rgba[i * 4 + 1] >= 236 && rgba[i * 4 + 2] >= 236;
  const stack: number[] = [];
  for (let x = 0; x < width; x++) { stack.push(x, (height - 1) * width + x); }
  for (let y = 0; y < height; y++) { stack.push(y * width, y * width + width - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    if (mask[i] || !nearWhite(i)) continue;
    mask[i] = 1;
    const x = i % width;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (i >= width) stack.push(i - width);
    if (i < width * (height - 1)) stack.push(i + width);
  }
  // Erode the background by a small margin so the watermark keeps clear of the
  // product's hem and soft shadow instead of butting right against it.
  const margin = Math.max(10, Math.round(width * 0.012));
  const eroded = mask.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      for (let dy = -margin; dy <= margin && eroded[i]; dy += margin) {
        for (let dx = -margin; dx <= margin; dx += margin) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) { eroded[i] = 0; break; }
        }
      }
    }
  }
  return eroded;
}

/** Bake a repeating diagonal Slugger-logo watermark BEHIND the mockup: the logo
 *  tiles across the frame but only shows in the empty background around the
 *  product (masked off the garment/chain itself), so the design stays clean and
 *  the branding still protects the artwork. Uses the logo image (renders
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
    const overlaySvg = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="p" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
            <image href="data:image/png;base64,${logo}" x="0" y="${Math.round(tileH * 0.2)}" width="${logoW}" opacity="0.18"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#p)"/>
      </svg>`,
    );
    // Render the tiled overlay to raw RGBA, then knock out its alpha wherever
    // the source is the product (mask === 0), leaving the logo in the backdrop.
    const overlayRaw = Buffer.from(await sharp(overlaySvg).resize(width, height).ensureAlpha().raw().toBuffer());
    const srcRaw = await sharp(srcBuf).ensureAlpha().raw().toBuffer();
    const mask = backgroundMask(srcRaw, width, height);
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) overlayRaw[i * 4 + 3] = 0; // product pixel -> hide watermark
    }
    const overlay = await sharp(overlayRaw, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const stamped = await sharp(srcBuf).composite([{ input: overlay }]).png().toBuffer();
    return stamped.toString("base64");
  } catch (e) {
    console.error("watermarkImage failed (returning unstamped):", e);
    return b64;
  }
}
