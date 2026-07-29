import { NextResponse } from "next/server";
import { generateJerseyImage } from "@/lib/jersey-image";

export const runtime = "nodejs";
export const maxDuration = 120;

// Key-gated diagnostic: force the OpenAI image tier (skip Gemini) so we can
// confirm the cross-vendor backstop works end-to-end on the deployed site.
// Returns the raw PNG on success, or JSON with the error. Not linked anywhere.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key !== (process.env.DESIGN_LAB_KEY || "slugger26")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const prompt =
    'Professional e-commerce product mockup of a fully custom sublimated baseball jersey, floating ghost-mannequin style, pure white background, studio lighting. Show FRONT (left) and BACK (right) side by side. Frame the two jerseys large and close-up. Colors: royal blue and red. Team name "AVENGERS" across the chest in bold athletic lettering, number 25 on the back. Premium, print-ready, tasteful. No mannequin, no human.';
  const t0 = Date.now();
  const r = await generateJerseyImage([{ text: prompt }], "4:3", { forceOpenai: true });
  const ms = Date.now() - t0;
  if ("error" in r) {
    return NextResponse.json({ ok: false, ms, error: r.error, status: r.status }, { status: r.status });
  }
  return new NextResponse(Buffer.from(r.data, "base64"), {
    headers: { "Content-Type": r.mime, "X-Gen-Ms": String(ms), "Cache-Control": "no-store" },
  });
}
