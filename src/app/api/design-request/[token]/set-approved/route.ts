import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, toggleApprovedDesign } from "@/lib/design-requests";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

// Staff/designer toggles a proof in/out of the APPROVED set (manage token =
// staff-only, same as proof upload). A project can have several approved
// designs at once - jersey, hat, hoodie, pants each have their own final
// mockup. Every change posts the exact image into the Discord thread so the
// designer always builds from the right versions.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { url?: string; approved?: boolean } = {};
  try { body = await req.json(); } catch {}

  const url = body.url ?? "";
  const approved = body.approved !== false;
  if (!request.proofImages?.includes(url)) {
    return NextResponse.json({ error: "Pick one of the sent proofs." }, { status: 400 });
  }

  try {
    const result = await toggleApprovedDesign(request.id, url, approved);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const n = result.urls.length;
    await postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: approved
        ? `✅ Approved design - ${request.teamName} (${request.reference})`
        : `↩️ Removed from approved - ${request.teamName} (${request.reference})`,
      description: approved
        ? `This image is confirmed as an approved design (${n} approved in total). Build the print files from the approved versions only.`
        : `This image is NO LONGER approved - do not build from it. ${n} approved design${n === 1 ? "" : "s"} remain${n === 1 ? "s" : ""}.`,
      imageUrl: url,
      username: "Slugger Design Requests",
      mention: approved,
    });
    return NextResponse.json({ ok: true, urls: result.urls });
  } catch (e) {
    console.error("toggleApprovedDesign failed:", e);
    return NextResponse.json({ error: "Could not update the approved designs" }, { status: 500 });
  }
}
