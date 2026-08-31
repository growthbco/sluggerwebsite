import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { dbEnabled, getDb } from "@/db";
import { designRequests } from "@/db/schema";
import { getByManageToken } from "@/lib/design-requests";
import { generateJerseyImage, parseDataUrl, watermarkImage, type ImagePart } from "@/lib/jersey-image";
import { buildProductPrompt, buildRefinePrompt, buildReferencePrompt, hatReferenceAsset, productAspect, colorName, PRODUCTS, type ProductType } from "@/lib/product-mockups";

export const runtime = "nodejs";
export const maxDuration = 300;

// Standard Slugger branding baked into every jersey mockup (matches the real
// garment): the size-tag strip (front hem) and the SA script (top back).
const BRAND_TAG_STRIP_URL =
  "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/branding/sa-size-tag-strip-2F0JyKbHLiQ9CIDTH1Jtc2bZxm44IT.png";
const BRAND_SA_SCRIPT_URL =
  "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/branding/sa-script-logo-vSeKOsS5bPnSqEk6n0QFFBuPAjLFqQ.png";

// Staff-only AI design studio for a specific design request. "generate" starts
// a fresh mockup from the brief; "refine" edits the current version with a
// change instruction (e.g. from the customer's change request). Every result
// is saved as a new version on the request so anyone can pick up where we left
// off - the persistent memory the owner asked for.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: {
    action?: "generate" | "refine";
    instruction?: string;
    baseUrl?: string;
    style?: string;
    colors?: string[];
    refImage?: string; // staff-uploaded reference, as a data URL
    product?: string;  // jersey | polo | cheer | hat | hype-chain | hoodie | pants | shorts | socks
    sport?: string;    // selected in the studio's Sport -> Item -> Style picker
  } = {};
  try { body = await req.json(); } catch {}
  // Sport the studio picked (baseball, basketball, cheer, flag football) drives
  // the prompt; falls back to the design request's own sport.
  const sport = (body.sport ?? "").trim() || undefined;
  const action = body.action === "refine" ? "refine" : "generate";
  const instruction = (body.instruction ?? "").trim().slice(0, 800);
  // Colors the staff typed in override the customer's on-file colors.
  const staffColors = (body.colors ?? []).map((c) => (c || "").trim()).filter(Boolean).slice(0, 4);
  const refImage = parseDataUrl(body.refImage);
  const product: ProductType = PRODUCTS.some((p) => p.id === body.product)
    ? (body.product as ProductType)
    : "jersey";

  const state = request.aiDesignState ?? { versions: [] as { url: string; note: string; at: string }[] };
  const parts: ImagePart[] = [];

  if (action === "refine") {
    if (!instruction) return NextResponse.json({ error: "Describe the change you want." }, { status: 400 });
    // Base = the current mockup (keep it). The explicitly chosen version, else latest.
    const baseUrl = body.baseUrl || state.versions[state.versions.length - 1]?.url;
    if (!baseUrl) return NextResponse.json({ error: "Nothing to revise yet - generate a mockup first." }, { status: 400 });
    // The team's real palette (staff override, else the customer's on-file
    // colors), named so the model can recolor when the change is about color.
    const refineColorList = (staffColors.length ? staffColors : (request.colorHexes ?? [])).map(colorName);
    const refineColors = refineColorList.length ? refineColorList.join(", ") : (request.colors || "");
    try {
      const buf = Buffer.from(await (await fetch(baseUrl)).arrayBuffer());
      parts.push({ text: buildRefinePrompt(product, request.sport, instruction, !!refImage, refineColors) });
      parts.push({ inline_data: { mime_type: "image/png", data: buf.toString("base64") } });
    } catch {
      return NextResponse.json({ error: "Could not load the base image." }, { status: 502 });
    }
    // An uploaded reference on a revision is a LOGO/GRAPHIC to incorporate per
    // the instruction (e.g. "add this snake logo to the sleeves"), NOT a new
    // base to redraw. Keep the current mockup; use this only as directed.
    if (refImage) {
      parts.push({ text: "SECOND image - a logo/graphic to use ONLY as directed in the change above (e.g. add it where asked). Do not redesign the mockup from it:" });
      parts.push({ inline_data: refImage });
    }
  } else {
    // Map hex codes to human color NAMES - image models ignore raw hex.
    const colorList = (staffColors.length ? staffColors : (request.colorHexes ?? [])).map(colorName);
    const colors = colorList.length ? colorList.join(", ") : (request.colors || "team colors");
    const style = (body.style ?? request.jerseyStyle ?? "").trim();
    const fetchImage = async (url: string, mime = "image/png") => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const buf = Buffer.from(await response.arrayBuffer());
        return { mime_type: mime, data: buf.toString("base64") };
      } catch { return null; }
    };

    if (product === "hype-chain") {
      // Two LABELED references so the model can't confuse them: our real chain
      // (construction only) and the pendant logo (what the bottom piece is).
      const site = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
      const chainRef = await fetchImage(`${site}/products/chains/big-baller.jpg`, "image/jpeg");
      // Pendant logo = staff upload, else the customer's first uploaded logo.
      const pendantLogo = refImage ?? (await fetchImage((request.inspirationImages ?? [])[0] ?? ""));
      parts.push({ text: buildProductPrompt(product, {
        sport: sport ?? request.sport, style, colors, teamName: request.teamName,
        vision: request.vision, instruction,
        hasRef: !!(chainRef || pendantLogo), hasPendantLogo: !!pendantLogo,
      }) });
      if (chainRef) {
        parts.push({ text: "REFERENCE CHAIN (match this chain's style/construction, not its colors or pendant):" });
        parts.push({ inline_data: chainRef });
      }
      if (pendantLogo) {
        parts.push({ text: "PENDANT LOGO (the bottom pendant is this logo):" });
        parts.push({ inline_data: pendantLogo });
      }
    } else if (product === "hat") {
      const asset = hatReferenceAsset(style);
      const hatBlank = await fetchImage(`${new URL(req.url).origin}${asset.src}`, asset.mime);
      const seeds: { mime_type: string; data: string }[] = [];
      if (refImage) {
        seeds.push(refImage);
      } else {
        for (const url of (request.inspirationImages ?? []).slice(0, 2)) {
          const seed = await fetchImage(url);
          if (seed) seeds.push(seed);
        }
      }
      parts.push({ text: buildProductPrompt(product, {
        sport: sport ?? request.sport,
        style,
        colors,
        teamName: request.teamName,
        vision: request.vision,
        instruction,
        hasRef: seeds.length > 0,
      }) });
      if (hatBlank) {
        parts.push({ text: `HAT BLANK CONSTRUCTION REFERENCE (${asset.label}): match ONLY this cap's silhouette, panel construction, brim, fit, and closure. Completely remove and ignore its existing embroidery, logo, lettering, colors, retail sticker, and background. Apply the customer's new colors and artwork instead:` });
        parts.push({ inline_data: hatBlank });
      }
      for (const seed of seeds) {
        parts.push({ text: "CUSTOMER LOGO OR HAT STYLE REFERENCE: use its artwork or design direction on the new hat; do not copy any unrelated brand marks:" });
        parts.push({ inline_data: seed });
      }
    } else if (refImage) {
      // Reference-driven: lean on the staff's uploaded image with a minimal
      // prompt. Do NOT inject the design request's team name / vision (that's
      // what forced "Orlando Avengers" and the wrong colors onto everything).
      const refColors = staffColors.length ? staffColors.map(colorName).join(", ") : "";
      // An explicitly picked jersey cut still applies in reference mode.
      const styleLine = product === "jersey" && (body.style ?? "").trim() ? `Make it a ${(body.style ?? "").trim()} jersey cut. ` : "";
      parts.push({ text: buildReferencePrompt(product, { instruction: `${styleLine}${instruction}`.trim(), colors: refColors }) });
      parts.push({ inline_data: refImage });
    } else {
      // Brief-driven: no reference uploaded, so build from the design request
      // (team name, colors, vision) and seed with the customer's logo/reference.
      const seeds: { mime_type: string; data: string }[] = [];
      for (const url of (request.inspirationImages ?? []).slice(0, 2)) {
        const s = await fetchImage(url);
        if (s) seeds.push(s);
      }
      parts.push({ text: buildProductPrompt(product, {
        sport: sport ?? request.sport, style, colors, teamName: request.teamName,
        vision: request.vision, instruction, hasRef: seeds.length > 0,
      }) });
      for (const s of seeds.slice(0, 3)) parts.push({ inline_data: s });
    }

    // Standard Slugger branding on every jersey mockup: the size-tag strip at
    // the bottom-center front hem, and the SA script at the top-center back
    // above the player name (matches what production actually prints).
    if (product === "jersey") {
      const [tagStrip, saScript] = await Promise.all([
        fetchImage(BRAND_TAG_STRIP_URL),
        fetchImage(BRAND_SA_SCRIPT_URL),
      ]);
      if (tagStrip && saScript) {
        parts.push({
          text:
            "BRANDING (both marks are REQUIRED and appear on every real Slugger jersey - do not omit either one): the next two images are brand marks to reproduce exactly. " +
            "Mark 1 (white size-tag strip with barcode): place SMALL at the bottom-center of the FRONT, just above the hem, subtle like a real garment tag. " +
            "Mark 2 ('SA' script logo): this MUST appear on the BACK of the jersey, centered in the upper-back yoke area just below the collar - above the player name AND/OR number (place it there even when there is only a number and no name). Prominent and clearly readable, roughly half the height of the back number. Never leave the upper back blank. " +
            "The SA mark may be recolored to match the design's palette so it blends with the overall style.",
        });
        parts.push({ inline_data: tagStrip });
        parts.push({ inline_data: saScript });
      }
    }
  }

  // High quality here - staff studio output goes to clients as proofs.
  const result = await generateJerseyImage(parts, productAspect(product), {
    quality: "high",
    operation: action === "generate" ? "staff_design_generation" : "staff_design_refinement",
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  // Save the CLEAN master first (the designer works from this and refines edit
  // from it), then a Slugger-watermarked copy that's what the customer sees.
  const cleanBlob = await put(`design-studio/${request.reference}-${stamp}-clean.png`, Buffer.from(result.data, "base64"), {
    access: "public", contentType: result.mime, addRandomSuffix: true,
  });
  const watermarked = await watermarkImage(result.data);
  const blob = await put(`design-studio/${request.reference}-${stamp}.png`, Buffer.from(watermarked, "base64"), {
    access: "public", contentType: "image/png", addRandomSuffix: true,
  });
  const productLabel = product === "hat"
    ? (/snap|trucker/i.test(body.style ?? "") ? "Snapback Hat" : "Fitted Hat")
    : PRODUCTS.find((p) => p.id === product)?.label ?? "Jersey";
  const version = {
    url: blob.url,
    cleanUrl: cleanBlob.url,
    product,
    note: (instruction || (action === "generate" ? `${productLabel} mockup` : "revision")).slice(0, 200),
    at: new Date().toISOString(),
  };
  const nextState = {
    sport: sport ?? request.sport ?? undefined,
    style: (body.style ?? request.jerseyStyle) ?? undefined,
    primaryColor: request.colorHexes?.[0],
    secondaryColor: request.colorHexes?.[1],
    teamName: request.teamName,
    versions: [...state.versions, version].slice(-20),
  };
  await getDb().update(designRequests).set({ aiDesignState: nextState }).where(eq(designRequests.id, request.id));
  return NextResponse.json({ ok: true, version, usedFallback: result.usedFallback });
}
