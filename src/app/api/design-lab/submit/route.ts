import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEST_KEY = process.env.DESIGN_LAB_KEY || "slugger26";

// Decompose the chosen concept into designer-usable pieces: the background
// pattern as a flat print swatch and the wordmark isolated on white (plus the
// emblem when the customer didn't supply a real logo file). Raster, not
// vector - but sublimation patterns print as raster anyway, and an isolated
// wordmark traces in minutes.
async function extractAsset(conceptB64: { mime: string; data: string }, prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const call = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: conceptB64.mime, data: conceptB64.data } }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      }),
      signal: AbortSignal.timeout(40000),
    });
  try {
    let res = await call();
    if (!res.ok) res = await call();
    if (!res.ok) return null;
    const data = await res.json();
    const img = data?.candidates?.[0]?.content?.parts?.find(
      (x: { inlineData?: { data: string }; inline_data?: { data: string } }) => x.inlineData || x.inline_data,
    );
    const payload = img?.inlineData ?? img?.inline_data;
    return payload?.data ?? null;
  } catch {
    return null;
  }
}
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

// "Proceed with this design": wraps the chosen AI concept + the customer's
// real assets into a normal design request, so the designer gets everything
// through the existing pipeline (Discord thread, emails, fee logic).
export async function POST(req: Request) {
  let body: {
    key?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    teamName?: string;
    sport?: string;
    style?: string;
    colorHexes?: string[];
    backNumber?: string;
    idea?: string;
    estimatedPieces?: string;
    notes?: string;
    concept?: string; // data URL - the chosen AI concept (front+back)
    logo?: string;
    reference?: string;
  } = {};
  try { body = await req.json(); } catch {}

  const keyed = (await isAdmin()) || body.key === TEST_KEY;
  if (!keyed && process.env.DESIGN_LAB_PUBLIC !== "true") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  if (!body.contactName?.trim() || !body.contactEmail?.trim() || !body.teamName?.trim()) {
    return NextResponse.json({ error: "Name, email, and team name are required." }, { status: 400 });
  }
  const concept = body.concept?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!concept) return NextResponse.json({ error: "No concept image attached." }, { status: 400 });

  // Upload the customer's chosen assets so the designer gets real files.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  async function upload(name: string, dataUrl: string | undefined): Promise<string | null> {
    const m = dataUrl?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!m) return null;
    try {
      const b = await put(`design-lab/submissions/${stamp}-${name}`, Buffer.from(m[2], "base64"), {
        access: "public", contentType: m[1], addRandomSuffix: true,
      });
      return b.url;
    } catch (e) {
      console.error("design-lab submit upload failed:", name, e);
      return null;
    }
  }
  const conceptB64 = { mime: concept[1], data: concept[2] };
  const [conceptUrl, logoUrl, referenceUrl, patternB64, wordmarkB64, emblemB64] = await Promise.all([
    upload("concept.png", body.concept),
    upload("logo.png", body.logo),
    upload("reference.png", body.reference),
    extractAsset(conceptB64, "From this jersey design, extract ONLY the background pattern/texture as a flat, full-bleed, seamless square print swatch: the complete pattern at full intensity edge to edge, straight-on view, no garment, no fabric folds, no lettering, no numbers, no logos, no shadows. Production artwork style. The source image contains a diagonal watermark - completely remove it; output clean artwork with no watermark text."),
    extractAsset(conceptB64, "From this jersey design, extract ONLY the team name wordmark/lettering exactly as styled (same font, colors, outlines, and any swoosh/underline), laid out flat and large, perfectly centered on a plain solid white background. No garment, no pattern, no other elements. Clean logo-sheet presentation. The source image contains a diagonal watermark - completely remove it; output clean artwork with no watermark text."),
    body.logo ? Promise.resolve(null) : extractAsset(conceptB64, "From this jersey design, extract ONLY the logo/emblem/mascot graphic (if one exists besides the team name lettering), isolated large and centered on a plain solid white background. If there is no distinct emblem, reproduce the most distinctive graphic element instead. No garment, no pattern. The source image contains a diagonal watermark - completely remove it; output clean artwork with no watermark text."),
  ]);
  if (!conceptUrl) return NextResponse.json({ error: "Could not save the concept image." }, { status: 500 });
  const [patternUrl, wordmarkUrl, emblemUrl] = await Promise.all([
    patternB64 ? upload("pattern-swatch.png", `data:image/png;base64,${patternB64}`) : null,
    wordmarkB64 ? upload("wordmark.png", `data:image/png;base64,${wordmarkB64}`) : null,
    emblemB64 ? upload("emblem.png", `data:image/png;base64,${emblemB64}`) : null,
  ]);

  const vision = [
    "AI DESIGN LAB CONCEPT - the customer designed this in our AI lab and wants THIS design produced.",
    "The FIRST inspiration image is their chosen concept (front and back views) - recreate it faithfully as the production design.",
    logoUrl ? "Their actual team logo file is attached as a separate image - use the real file, not the AI's rendering of it." : "",
    patternUrl ? `EXTRACTED PATTERN SWATCH (flat, print-style): ${patternUrl}` : "",
    wordmarkUrl ? `EXTRACTED WORDMARK on white (trace-ready): ${wordmarkUrl}` : "",
    emblemUrl ? `EXTRACTED EMBLEM on white (AI-invented - trace or redraw): ${emblemUrl}` : "",
    referenceUrl ? "They also supplied a reference jersey (style inspiration) - attached." : "",
    body.backNumber?.trim() ? `Back number shown in concept: ${body.backNumber.trim().slice(0, 4)}.` : "",
    body.idea?.trim() ? `Customer's own description: ${body.idea.trim().slice(0, 600)}` : "",
  ].filter(Boolean).join("\n");

  const res = await fetch(`${SITE}/api/design-request/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamName: body.teamName.trim().slice(0, 80),
      sport: (body.sport ?? "").trim().slice(0, 40),
      contactName: body.contactName.trim().slice(0, 80),
      contactEmail: body.contactEmail.trim().slice(0, 120),
      contactPhone: (body.contactPhone ?? "").trim().slice(0, 30) || undefined,
      vision,
      notes: (body.notes ?? "").trim().slice(0, 500) || undefined,
      colorHexes: (body.colorHexes ?? []).slice(0, 6),
      productTypes: ["Jerseys"],
      jerseyStyle: (body.style ?? "").trim().slice(0, 30) || undefined,
      inspirationImages: [conceptUrl, logoUrl, referenceUrl, patternUrl, wordmarkUrl, emblemUrl].filter(Boolean),
      estimatedPieces: (body.estimatedPieces ?? "").trim().slice(0, 20) || undefined,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    return NextResponse.json({ error: data?.error ?? "Could not create the design request." }, { status: 502 });
  }
  return NextResponse.json(data);
}
