import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { dbEnabled, getDb } from "@/db";
import { designRequests } from "@/db/schema";
import { getByManageToken } from "@/lib/design-requests";
import { generateJerseyImage, parseDataUrl, type ImagePart } from "@/lib/jersey-image";

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

  let body: { action?: "generate" | "refine"; instruction?: string; baseUrl?: string; style?: string } = {};
  try { body = await req.json(); } catch {}
  const action = body.action === "refine" ? "refine" : "generate";
  const instruction = (body.instruction ?? "").trim().slice(0, 800);

  const state = request.aiDesignState ?? { versions: [] as { url: string; note: string; at: string }[] };
  const parts: ImagePart[] = [];

  if (action === "refine") {
    // Base = the explicitly chosen version, else the latest.
    const baseUrl = body.baseUrl || state.versions[state.versions.length - 1]?.url;
    if (!baseUrl) return NextResponse.json({ error: "Nothing to refine yet - generate a mockup first." }, { status: 400 });
    if (!instruction) return NextResponse.json({ error: "Describe the change you want." }, { status: 400 });
    try {
      const buf = Buffer.from(await (await fetch(baseUrl)).arrayBuffer());
      parts.push({ text: `Edit this custom ${request.sport ?? "team"} jersey mockup. Keep it a professional front-and-back ghost-mannequin product shot on a pure white background. Apply this change: ${instruction}. Change only what's asked; keep everything else identical.` });
      parts.push({ inline_data: { mime_type: "image/png", data: buf.toString("base64") } });
    } catch {
      return NextResponse.json({ error: "Could not load the base image." }, { status: 502 });
    }
  } else {
    const colors = (request.colorHexes ?? []).join(", ") || request.colors || "team colors";
    const style = (body.style ?? request.jerseyStyle ?? "").trim();
    parts.push({ text: [
      `Professional e-commerce product mockup of a fully custom sublimated ${request.sport ?? "baseball"} jersey${style ? `, ${style} cut` : ""}, floating ghost-mannequin style, pure white background, studio lighting. Show FRONT (left) and BACK (right) side by side.`,
      `Colors: ${colors}.`,
      request.teamName ? `Team name "${request.teamName}" across the chest in bold athletic lettering.` : "",
      request.vision ? `Design direction: ${request.vision.slice(0, 500)}.` : "",
      instruction ? `Additional direction: ${instruction}.` : "",
      "Premium, print-ready, tasteful. No mannequin, no human, no watermark.",
    ].filter(Boolean).join(" ") });
    // Seed with the customer's logo/reference if they supplied any.
    for (const url of (request.inspirationImages ?? []).slice(0, 2)) {
      try {
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
        parts.push({ inline_data: { mime_type: "image/png", data: buf.toString("base64") } });
      } catch { /* skip */ }
    }
  }

  const result = await generateJerseyImage(parts);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = await put(`design-studio/${request.reference}-${stamp}.png`, Buffer.from(result.data, "base64"), {
    access: "public", contentType: result.mime, addRandomSuffix: true,
  });
  const version = { url: blob.url, note: (instruction || (action === "generate" ? "initial mockup" : "revision")).slice(0, 200), at: new Date().toISOString() };
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
