import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { generateJson } from "@/lib/design-assistant";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { getDb, dbEnabled } from "@/db";
import { designLabVisitors } from "@/db/schema";
import { getOrCreateVisitor, tierFor, LAB_COOKIE, encryptCleanUrl } from "@/lib/design-lab";

export const runtime = "nodejs";
export const maxDuration = 120;

// PRIVATE preview of the AI jersey designer (not linked from the site).
// Gated: admin session OR the shared test key. Each generation on
// gemini-3-pro-image costs ~$0.134, so a daily cap keeps testing bounded.
const TEST_KEY = process.env.DESIGN_LAB_KEY || "slugger26";
const DAILY_CAP = 150;
let dayStamp = "";
let used = 0;

// Full-color Slugger logo for the background watermark; fetched once per
// instance from the site's own public asset.
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

// Background mask via flood fill from the image borders: marks near-white
// pixels connected to the edge, so the watermark lands BEHIND the jersey
// (background only) and never covers the garment or its soft shadow.
function backgroundMask(rgba: Buffer, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const nearWhite = (i: number) => rgba[i * 4] >= 240 && rgba[i * 4 + 1] >= 240 && rgba[i * 4 + 2] >= 240;
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
  // Chamfer distance transform from the garment (non-background) region, so
  // the watermark keeps a clean margin away from the jersey and its shadow
  // instead of butting right against the hem.
  const margin = Math.max(24, Math.round(width * 0.03)) * 3; // orthogonal step = 3
  const INF = 1 << 29;
  const dist = new Int32Array(width * height);
  for (let i = 0; i < dist.length; i++) dist[i] = mask[i] ? INF : 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!dist[i]) continue;
      let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + 3);
      if (y > 0) d = Math.min(d, dist[i - width] + 3);
      if (x > 0 && y > 0) d = Math.min(d, dist[i - width - 1] + 4);
      if (x < width - 1 && y > 0) d = Math.min(d, dist[i - width + 1] + 4);
      dist[i] = d;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (!dist[i]) continue;
      let d = dist[i];
      if (x < width - 1) d = Math.min(d, dist[i + 1] + 3);
      if (y < height - 1) d = Math.min(d, dist[i + width] + 3);
      if (x < width - 1 && y < height - 1) d = Math.min(d, dist[i + width + 1] + 4);
      if (x > 0 && y < height - 1) d = Math.min(d, dist[i + width - 1] + 4);
      dist[i] = d;
    }
  }
  for (let i = 0; i < mask.length; i++) {
    if (dist[i] < margin) mask[i] = 0;
  }
  return mask;
}

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
    ladder?: boolean;
    sport?: string;
    style?: string;
    primaryColor?: string;
    secondaryColor?: string;
    teamName?: string;
    backNumber?: string;
    extraColors?: string[];
    idea?: string;
    logo?: string; // data URL
    reference?: string; // data URL of a jersey the customer likes
    previousImage?: string; // data URL, for refinements
    refinement?: string;
  } = {};
  try { body = await req.json(); } catch {}

  const keyed = (await isAdmin()) || body.key === TEST_KEY;
  const isPublic = process.env.DESIGN_LAB_PUBLIC === "true";
  if (!keyed && !isPublic) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  // Ladder applies to public visitors, and to key holders who ask for it (testing).
  const ladderActive = (isPublic && !keyed) || body.ladder === true;
  let visitorCtx: Awaited<ReturnType<typeof getOrCreateVisitor>> = null;
  if (ladderActive) {
    if (!dbEnabled()) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
    visitorCtx = await getOrCreateVisitor();
    if (!visitorCtx) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
    const tier = tierFor(visitorCtx.visitor);
    if (!tier.allowed) {
      const res = NextResponse.json({ need: tier.need, used: visitorCtx.visitor.generations }, { status: 403 });
      if (visitorCtx.setCookie) res.cookies.set(LAB_COOKIE, visitorCtx.setCookie, { httpOnly: true, maxAge: 31536000, path: "/" });
      return res;
    }
  }
  if (!checkCap()) return NextResponse.json({ error: "Daily generation cap reached - try tomorrow." }, { status: 429 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Image AI not configured" }, { status: 503 });

  const clean = (s: string | undefined, n: number) => (s ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
  const sport = clean(body.sport, 40) || "baseball";
  const style = clean(body.style, 40) || "crew neck";
  const STYLE_SPECS: Record<string, string> = {
    "crew neck": "a round crew-neck collar; NO buttons, NO placket, NO zipper",
    "two-button": "a short two-button placket at the neckline with EXACTLY TWO visible buttons and a sport collar; the placket ends at mid-chest",
    "full-button": "a full button-down front: a placket running the ENTIRE length of the jersey with a visible row of buttons top to bottom, classic baseball collar",
    "quarter-zip": "a stand-up quarter-zip collar with a visible ZIPPER from the neck ending at mid-chest; NO buttons",
    "sleeveless / tank": "a sleeveless tank cut with finished armholes; NO sleeves, NO buttons, NO zipper",
    "reversible": "a sleeveless reversible basketball cut with finished armholes and contrasting trim; NO buttons, NO zipper",
  };
  const styleSpec = STYLE_SPECS[style.toLowerCase()] ?? "";
  const teamName = clean(body.teamName, 40);
  const idea = clean(body.idea, 500);
  const refinement = clean(body.refinement, 500);
  const backNumber = clean(body.backNumber, 4) || "12";
  const extraColors = (body.extraColors ?? []).map((x) => clean(String(x), 20)).filter(Boolean).slice(0, 3);

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
        "- COLOR CHANGES: if they ask for a different color (of the jersey, a panel, lettering, or the whole scheme), the instruction must say to RECOLOR those parts while keeping every pattern, graphic, texture, stripe, logo, and layout element exactly where and how it is - a recolor never removes or simplifies the design.",
        "- Name the specific element(s) to change and state that everything else stays identical.",
        'Return ONLY JSON: { "instruction": string }',
      ].join("\n"),
      { type: "OBJECT", properties: { instruction: { type: "STRING" } }, required: ["instruction"] },
    )) as { instruction?: string } | null;
    if (interpreted?.instruction) instruction = interpreted.instruction.slice(0, 600);
    // Guardrail 2: hard rules appended to every refinement.
    parts.push({ text: `Edit this custom ${sport} jersey product mockup. ${instruction} STRICT RULES: the output must remain a crisp, full-contrast, professional product photo - floating ghost-mannequin, pure white background, normal exposure and saturation, keeping the same front-and-back side-by-side layout as the input image. NEVER fade, wash out, blur, or change the brightness of the whole photo or the whole garment. Change ONLY the specific design elements mentioned; keep the lettering, fit, framing, and photo quality exactly as they are unless explicitly asked. If the change is a COLOR change, recolor while preserving every existing pattern, graphic, and design detail in place - do not remove, simplify, or redraw them.` });
    parts.push({ inline_data: prev });
  } else {
    const reference = parseDataUrl(body.reference);
    const logo = parseDataUrl(body.logo);
    const prompt = [
      `Professional e-commerce product mockup of a fully custom sublimated ${sport} jersey, ${style} cut, floating ghost-mannequin style, pure white background, studio lighting. Show TWO views side by side in one image: the FRONT of the jersey on the left and the BACK of the same jersey on the right. The back shows the same design language with a large player number ${backNumber} centered below the shoulders.${styleSpec ? ` GARMENT CONSTRUCTION (must match exactly): ${styleSpec}.` : ""}`,
      reference
        ? `A REFERENCE JERSEY image is provided: recreate its overall design language - layout, paneling, stripe/graphic placement, and general vibe - as a NEW original design (do not copy logos or team names from the reference).`
        : "",
      `Primary color ${clean(body.primaryColor, 30) || "black"}, accent color ${clean(body.secondaryColor, 30) || "gold"}${extraColors.length ? `, additional colors: ${extraColors.join(", ")}` : ""}.`,
      teamName ? `The team name "${teamName}" appears across the chest in bold athletic lettering, spelled exactly: ${teamName}.` : "",
      idea ? `Design direction from the customer: ${idea}.` : "",
      logo ? "A TEAM LOGO image is also provided: incorporate that logo naturally into the design (chest or sleeve), keeping it recognizable." : "",
      "Make it look like a premium, print-ready team uniform design - tasteful, modern, athletic. No mannequin, no human, no watermark, no extra text besides the jersey design itself. Do NOT add any MLB/NBA/NFL or other league logos, pro-team marks, or brand swooshes - only the team's own name and provided logo.",
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
    // Primary: gemini-3-pro-image (crisp lettering). Fallback: a Flash image
    // model when Pro is overloaded (Google returns 503 "high demand"), so the
    // tool keeps working through Pro outages instead of dying.
    const PRIMARY = "gemini-3-pro-image";
    const FALLBACK = process.env.DESIGN_LAB_FALLBACK_MODEL || "gemini-2.5-flash-image";
    const callModel = (model: string) =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:3" } },
          }),
          signal: AbortSignal.timeout(40000),
        },
      );
    // Try primary once; if it's overloaded/unavailable/timeout, fall back to Flash.
    let usedFallback = false;
    let res: Response | null = null;
    for (const model of [PRIMARY, FALLBACK]) {
      try {
        res = await callModel(model);
        if (res.ok) { usedFallback = model === FALLBACK; break; }
        const status = res.status;
        console.error(`design-lab ${model} failed:`, status, (await res.text().catch(() => "")).slice(0, 150));
        // Only fall back on capacity/5xx; a 400 won't improve on Flash.
        if (!(status === 429 || status >= 500)) break;
      } catch (e) {
        console.error(`design-lab ${model} threw:`, String(e).slice(0, 120));
        res = null; // timeout/abort -> try fallback
      }
    }
    if (!res || !res.ok) {
      return NextResponse.json(
        { error: "Our image AI is briefly overloaded (Google-side). Give it a minute and try again." },
        { status: 503 },
      );
    }
    if (usedFallback) console.log("design-lab used Flash fallback (Pro overloaded)");
    const data = await res.json();
    const img = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data: string; mimeType: string }; inline_data?: { data: string; mime_type: string } }) => p.inlineData || p.inline_data,
    );
    const payload = img?.inlineData ?? img?.inline_data;
    if (!payload?.data) return NextResponse.json({ error: "No image came back - try rewording" }, { status: 502 });
    // Save the CLEAN master first - the designer handoff uses this; the
    // customer only ever receives the watermarked copy below.
    let cleanToken: string | undefined;
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const cleanBlob = await put(`design-lab/clean/${stamp}.png`, Buffer.from(payload.data, "base64"), {
        access: "public", contentType: payload.mimeType ?? payload.mime_type ?? "image/png", addRandomSuffix: true,
      });
      cleanToken = encryptCleanUrl(cleanBlob.url);
    } catch (e) {
      console.error("clean master save failed:", e);
    }

    // Bake a diagonal SLUGGER ATHLETICS watermark into every concept so the
    // artwork can't be shopped to another printer; the clean version only
    // ever exists as the designer's real proof.
    let outB64 = payload.data as string;
    let mime = payload.mimeType ?? payload.mime_type ?? "image/png";
    try {
      const srcBuf = Buffer.from(outB64, "base64");
      const srcSharp = sharp(srcBuf);
      const { width = 1200, height = 900 } = await srcSharp.metadata();
      const logo = await getLogo();
      let overlay: Buffer;
      if (logo) {
        // Colored logo tiled across the whole frame...
        const wmSvg = Buffer.from(
          `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="p" width="400" height="320" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
                <image href="data:image/png;base64,${logo}" x="20" y="40" width="280" opacity="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#p)"/>
          </svg>`,
        );
        const wmRaw = Buffer.from(await sharp(wmSvg).ensureAlpha().raw().toBuffer());
        // ...then masked to the background only, so it sits BEHIND the jersey.
        const srcRaw = await sharp(srcBuf).ensureAlpha().raw().toBuffer();
        const mask = backgroundMask(srcRaw, width, height);
        for (let i = 0; i < mask.length; i++) {
          if (!mask[i]) wmRaw[i * 4 + 3] = 0;
        }
        overlay = await sharp(wmRaw, { raw: { width, height, channels: 4 } }).png().toBuffer();
      } else {
        overlay = Buffer.from(
          `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="p" width="420" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)">
                <text x="0" y="90" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="bold" fill="#555555" fill-opacity="0.14">SLUGGER ATHLETICS · CONCEPT</text>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#p)"/>
          </svg>`,
        );
      }
      const stamped = await sharp(srcBuf).composite([{ input: overlay }]).png().toBuffer();
      outB64 = stamped.toString("base64");
      mime = "image/png";
    } catch (e) {
      console.error("watermark failed (returning unstamped):", e);
    }
    payload.data = outB64;
    console.log(`design-lab generation #${used} today (~$${(used * 0.134).toFixed(2)} spent)`);
    // Persist every render (fire-and-forget) so there's a reviewable history.
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const note = [sport, style, teamName, refinement ? `refine: ${refinement}` : idea].filter(Boolean).join(" | ").slice(0, 180);
      void put(`design-lab/${stamp}.png`, Buffer.from(payload.data, "base64"), {
        access: "public", contentType: mime, addRandomSuffix: true,
      }).then((b) => console.log(`design-lab saved: ${b.url} :: ${note}`)).catch(() => {});
    } catch {}
    let ladderState: { used: number; free: number } | undefined;
    if (ladderActive && visitorCtx) {
      const [updated] = await getDb()
        .update(designLabVisitors)
        .set({ generations: sql`${designLabVisitors.generations} + 1` })
        .where(eq(designLabVisitors.id, visitorCtx.visitor.id))
        .returning();
      ladderState = { used: updated.generations, free: 3 };
    }
    const out = NextResponse.json({ image: `data:${mime};base64,${payload.data}`, cleanToken, usedToday: used, capToday: DAILY_CAP, ladder: ladderState });
    if (visitorCtx?.setCookie) out.cookies.set(LAB_COOKIE, visitorCtx.setCookie, { httpOnly: true, maxAge: 31536000, path: "/" });
    return out;
  } catch (e) {
    console.error("design-lab error:", e);
    return NextResponse.json({ error: "Generation failed - try again" }, { status: 500 });
  }
}
