import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// PRIVATE preview of the AI jersey designer (not linked from the site).
// Gated: admin session OR the shared test key. Each generation on
// gemini-3-pro-image costs ~$0.134, so a daily cap keeps testing bounded.
const TEST_KEY = process.env.DESIGN_LAB_KEY || "slugger26";
const DAILY_CAP = 60;
let dayStamp = "";
let used = 0;

function checkCap(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayStamp) { dayStamp = today; used = 0; }
  if (used >= DAILY_CAP) return false;
  used += 1;
  return true;
}

export async function POST(req: Request) {
  let body: {
    key?: string;
    sport?: string;
    style?: string;
    primaryColor?: string;
    secondaryColor?: string;
    teamName?: string;
    idea?: string;
    logo?: string; // data URL
    previousImage?: string; // data URL, for refinements
    refinement?: string;
  } = {};
  try { body = await req.json(); } catch {}

  const authed = (await isAdmin()) || body.key === TEST_KEY;
  if (!authed) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!checkCap()) return NextResponse.json({ error: "Daily generation cap reached - try tomorrow." }, { status: 429 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Image AI not configured" }, { status: 503 });

  const clean = (s: string | undefined, n: number) => (s ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
  const sport = clean(body.sport, 40) || "baseball";
  const style = clean(body.style, 40) || "crew neck";
  const teamName = clean(body.teamName, 40);
  const idea = clean(body.idea, 500);
  const refinement = clean(body.refinement, 500);

  const parts: Record<string, unknown>[] = [];
  const parseDataUrl = (u?: string) => {
    const m = u?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    return m ? { mime_type: m[1], data: m[2] } : null;
  };

  if (body.previousImage && refinement) {
    const prev = parseDataUrl(body.previousImage);
    if (!prev) return NextResponse.json({ error: "Bad previous image" }, { status: 400 });
    parts.push({ text: `Edit this custom ${sport} jersey mockup. Keep it a professional floating ghost-mannequin product shot on a pure white background, front view. Apply this change: ${refinement}` });
    parts.push({ inline_data: prev });
  } else {
    const prompt = [
      `Professional e-commerce product mockup of a fully custom sublimated ${sport} jersey, ${style} cut, floating ghost-mannequin style, front view, pure white background, studio lighting.`,
      `Primary color ${clean(body.primaryColor, 30) || "black"}, accent color ${clean(body.secondaryColor, 30) || "gold"}.`,
      teamName ? `The team name "${teamName}" appears across the chest in bold athletic lettering, spelled exactly: ${teamName}.` : "",
      idea ? `Design direction from the customer: ${idea}.` : "",
      body.logo ? "Incorporate the provided team logo naturally into the design (chest or sleeve)." : "",
      "Make it look like a premium, print-ready team uniform design - tasteful, modern, athletic. No mannequin, no human, no watermark, no extra text besides the jersey design itself.",
    ].filter(Boolean).join(" ");
    parts.push({ text: prompt });
    const logo = parseDataUrl(body.logo);
    if (logo) parts.push({ inline_data: logo });
  }

  try {
    const callGemini = () =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
          }),
          signal: AbortSignal.timeout(45000),
        },
      );
    let res = await callGemini();
    if (!res.ok) {
      console.error("design-lab attempt 1 failed:", res.status, await res.text().catch(() => ""));
      res = await callGemini(); // transient 5xx from the image model is common
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("design-lab generate failed:", res.status, detail.slice(0, 300));
      return NextResponse.json(
        { error: `Generation failed (${res.status}) - try rewording your idea or using a smaller image` },
        { status: 502 },
      );
    }
    const data = await res.json();
    const img = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data: string; mimeType: string }; inline_data?: { data: string; mime_type: string } }) => p.inlineData || p.inline_data,
    );
    const payload = img?.inlineData ?? img?.inline_data;
    if (!payload?.data) return NextResponse.json({ error: "No image came back - try rewording" }, { status: 502 });
    const mime = payload.mimeType ?? payload.mime_type ?? "image/png";
    console.log(`design-lab generation #${used} today (~$${(used * 0.134).toFixed(2)} spent)`);
    return NextResponse.json({ image: `data:${mime};base64,${payload.data}`, usedToday: used, capToday: DAILY_CAP });
  } catch (e) {
    console.error("design-lab error:", e);
    return NextResponse.json({ error: "Generation failed - try again" }, { status: 500 });
  }
}
