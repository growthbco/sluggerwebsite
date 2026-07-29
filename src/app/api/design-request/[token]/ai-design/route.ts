import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { dbEnabled, getDb } from "@/db";
import { designRequests } from "@/db/schema";
import { getByManageToken } from "@/lib/design-requests";
import { generateJerseyImage, parseDataUrl, watermarkImage, type ImagePart } from "@/lib/jersey-image";
import { buildProductPrompt, buildRefinePrompt, productAspect, PRODUCTS, type ProductType } from "@/lib/product-mockups";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    product?: string;  // jersey | hat | hype-chain | hoodie | pants | socks
  } = {};
  try { body = await req.json(); } catch {}
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
    // Base = the explicitly chosen version, else the latest.
    const baseUrl = body.baseUrl || state.versions[state.versions.length - 1]?.url;
    if (!baseUrl) return NextResponse.json({ error: "Nothing to refine yet - generate a mockup first." }, { status: 400 });
    if (!instruction) return NextResponse.json({ error: "Describe the change you want." }, { status: 400 });
    try {
      const buf = Buffer.from(await (await fetch(baseUrl)).arrayBuffer());
      parts.push({ text: buildRefinePrompt(product, request.sport, instruction) });
      parts.push({ inline_data: { mime_type: "image/png", data: buf.toString("base64") } });
    } catch {
      return NextResponse.json({ error: "Could not load the base image." }, { status: 502 });
    }
  } else {
    const colors = staffColors.length
      ? staffColors.join(", ")
      : (request.colorHexes ?? []).join(", ") || request.colors || "team colors";
    const style = (body.style ?? request.jerseyStyle ?? "").trim();
    const fetchImage = async (url: string, mime = "image/png") => {
      try {
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
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
        sport: request.sport, style, colors, teamName: request.teamName,
        vision: request.vision, instruction,
        hasRef: !!(chainRef || pendantLogo), hasPendantLogo: !!pendantLogo,
      }) });
      if (chainRef) {
        parts.push({ text: "REFERENCE CHAIN - match this exact 3D-printed chain construction (link shape, thickness, matte printed finish). Do NOT copy its colors, and do NOT copy its pendant:" });
        parts.push({ inline_data: chainRef });
      }
      if (pendantLogo) {
        parts.push({ text: "PENDANT LOGO - print THIS exact logo onto the face of the flat pendant plate (like a logo printed on a jersey), keeping ALL of its shapes and colors (the outer circle/ring, the arrow, the letterforms). Do not reduce it to a plain letter, do not die-cut the plate into the logo shape, do not make it out of chain links:" });
        parts.push({ inline_data: pendantLogo });
      }
    } else {
      // Seed images: staff reference first, then the customer's logo/reference.
      const seeds: { mime_type: string; data: string }[] = [];
      if (refImage) seeds.push(refImage);
      for (const url of (request.inspirationImages ?? []).slice(0, 2)) {
        const s = await fetchImage(url);
        if (s) seeds.push(s);
      }
      parts.push({ text: buildProductPrompt(product, {
        sport: request.sport, style, colors, teamName: request.teamName,
        vision: request.vision, instruction, hasRef: seeds.length > 0,
      }) });
      for (const s of seeds.slice(0, 3)) parts.push({ inline_data: s });
    }
  }

  // High quality here - staff studio output goes to clients as proofs.
  const result = await generateJerseyImage(parts, productAspect(product), { quality: "high" });
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
  const productLabel = PRODUCTS.find((p) => p.id === product)?.label ?? "Jersey";
  const version = {
    url: blob.url,
    cleanUrl: cleanBlob.url,
    product,
    note: (instruction || (action === "generate" ? `${productLabel} mockup` : "revision")).slice(0, 200),
    at: new Date().toISOString(),
  };
  const nextState = {
    sport: request.sport ?? undefined,
    style: (body.style ?? request.jerseyStyle) ?? undefined,
    primaryColor: request.colorHexes?.[0],
    secondaryColor: request.colorHexes?.[1],
    teamName: request.teamName,
    versions: [...state.versions, version].slice(-20),
  };
  await getDb().update(designRequests).set({ aiDesignState: nextState }).where(eq(designRequests.id, request.id));
  return NextResponse.json({ ok: true, version, usedFallback: result.usedFallback });
}
