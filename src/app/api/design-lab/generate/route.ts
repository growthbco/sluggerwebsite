import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { generateJson } from "@/lib/design-assistant";

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
    backNumber?: string;
    idea?: string;
    logo?: string; // data URL
    reference?: string; // data URL of a jersey the customer likes
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
  const backNumber = clean(body.backNumber, 4) || "12";

  const parts: Record<string, unknown>[] = [];
  const parseDataUrl = (u?: string) => {
    const m = u?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    return m ? { mime_type: m[1], data: m[2] } : null;
  };

  if (body.previousImage && refinement) {
    const prev = parseDataUrl(body.previousImage);
    if (!prev) return NextResponse.json({ error: "Bad previous image" }, { status: 400 });
    // Guardrail 1: have Claude turn the customer's loose wording into a precise
    // edit instruction scoped to design elements ("make it lighter" once faded
    // the entire product photo instead of the background pattern).
    let instruction = refinement;
    const interpreted = (await generateJson(
      [
        `A customer is refining an AI mockup of a custom ${sport} jersey (a product photo of the garment on a white background). Their request: "${refinement}"`,
        "Rewrite this as ONE precise image-edit instruction for an image model. Rules:",
        "- The request refers to the JERSEY'S DESIGN (patterns, lettering, graphics, trim, colors) unless it explicitly mentions the photo, lighting, or background.",
        "- Words like lighter/darker/softer/transparent mean the intensity of specific design elements, NOT the exposure of the photo or the whole garment.",
        "- Name the specific element(s) to change and state that everything else stays identical.",
        'Return ONLY JSON: { "instruction": string }',
      ].join("\n"),
      { type: "OBJECT", properties: { instruction: { type: "STRING" } }, required: ["instruction"] },
    )) as { instruction?: string } | null;
    if (interpreted?.instruction) instruction = interpreted.instruction.slice(0, 600);
    // Guardrail 2: hard rules appended to every refinement.
    parts.push({ text: `Edit this custom ${sport} jersey product mockup. ${instruction} STRICT RULES: the output must remain a crisp, full-contrast, professional product photo - floating ghost-mannequin, pure white background, normal exposure and saturation, keeping the same front-and-back side-by-side layout as the input image. NEVER fade, wash out, blur, or change the brightness of the whole photo or the whole garment. Change ONLY the specific design elements mentioned; keep the fabric base color, lettering, fit, framing, and photo quality exactly as they are unless explicitly asked.` });
    parts.push({ inline_data: prev });
  } else {
    const reference = parseDataUrl(body.reference);
    const logo = parseDataUrl(body.logo);
    const prompt = [
      `Professional e-commerce product mockup of a fully custom sublimated ${sport} jersey, ${style} cut, floating ghost-mannequin style, pure white background, studio lighting. Show TWO views side by side in one image: the FRONT of the jersey on the left and the BACK of the same jersey on the right. The back shows the same design language with a large player number ${backNumber} centered below the shoulders.`,
      reference
        ? `A REFERENCE JERSEY image is provided: recreate its overall design language - layout, paneling, stripe/graphic placement, and general vibe - as a NEW original design (do not copy logos or team names from the reference).`
        : "",
      `Primary color ${clean(body.primaryColor, 30) || "black"}, accent color ${clean(body.secondaryColor, 30) || "gold"}.`,
      teamName ? `The team name "${teamName}" appears across the chest in bold athletic lettering, spelled exactly: ${teamName}.` : "",
      idea ? `Design direction from the customer: ${idea}.` : "",
      logo ? "A TEAM LOGO image is also provided: incorporate that logo naturally into the design (chest or sleeve), keeping it recognizable." : "",
      "Make it look like a premium, print-ready team uniform design - tasteful, modern, athletic. No mannequin, no human, no watermark, no extra text besides the jersey design itself.",
    ].filter(Boolean).join(" ");
    parts.push({ text: prompt });
    if (reference) {
      parts.push({ text: "REFERENCE JERSEY (style inspiration):" });
      parts.push({ inline_data: reference });
    }
    if (logo) {
      parts.push({ text: "TEAM LOGO (incorporate this):" });
      parts.push({ inline_data: logo });
    }
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
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:3" } },
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
