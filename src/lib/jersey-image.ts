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

  let res: Response | null = null;
  let usedFallback = false;
  for (const model of [PRIMARY, FALLBACK]) {
    try {
      res = await call(model);
      if (res.ok) { usedFallback = model === FALLBACK; break; }
      const status = res.status;
      console.error(`jersey-image ${model} failed:`, status);
      if (!(status === 429 || status >= 500)) break;
    } catch {
      res = null;
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
