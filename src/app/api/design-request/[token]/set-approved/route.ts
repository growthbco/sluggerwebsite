import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests } from "@/db/schema";
import { getByManageToken, toggleApprovedDesign } from "@/lib/design-requests";
import { generateAssetSheets, hasAssetSheets } from "@/lib/design-lab-assets";
import { postDesignThreadUpdate } from "@/lib/discord";
import { setThreadStageTag } from "@/lib/discord-bot";

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

  let body: { url?: string; approved?: boolean; label?: string } = {};
  try { body = await req.json(); } catch {}

  const url = body.url ?? "";
  const approved = body.approved !== false;
  const reviewProofs = request.proofReviewUrls?.length ? request.proofReviewUrls : request.proofImages ?? [];
  if (!reviewProofs.includes(url)) {
    return NextResponse.json({ error: "Only the current proof version can be approved." }, { status: 400 });
  }

  // Approving requires a name so it's identifiable everywhere (store, roster).
  const label = (body.label ?? "").trim().slice(0, 60);
  if (approved && !label && !request.proofLabels?.[url]) {
    return NextResponse.json({ error: "Name this design before approving it." }, { status: 400 });
  }

  try {
    // Persist the name + mint a stable SKU on approval.
    if (approved) {
      const db = getDb();
      const proofLabels = { ...(request.proofLabels ?? {}), ...(label ? { [url]: label } : {}) };
      const designSkus = { ...(request.designSkus ?? {}) };
      if (!designSkus[url]) {
        const nums = Object.values(designSkus).map((s) => parseInt(String(s).split("-").pop() || "0", 10)).filter((n) => !Number.isNaN(n));
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        designSkus[url] = `${request.reference}-${String(next).padStart(2, "0")}`;
      }
      await db.update(designRequests).set({ proofLabels, designSkus }).where(eq(designRequests.id, request.id));
    }
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
    await setThreadStageTag(request.discordThreadId, "✅ Approved");

    // Parity with the AI lab: on approval, generate the individual trace-ready
    // asset sheets (pattern / wordmark / emblem) from the approved artwork and
    // drop them into the thread - so designs approved manually here get the same
    // files, not just the mockup. Backgrounded (image model is slow); guarded so
    // it only runs the first time a design gets an approved image.
    if (approved && !hasAssetSheets(request.inspirationImages)) {
      waitUntil(
        generateAssetSheets({
          designId: request.id,
          reference: request.reference,
          teamName: request.teamName,
          sport: request.sport,
          style: request.jerseyStyle,
          threadId: request.discordThreadId,
          currentImages: request.inspirationImages ?? [],
          sourceImageUrl: url,
        }).catch((e) => console.error("generateAssetSheets (set-approved) failed:", e)),
      );
    }
    return NextResponse.json({ ok: true, urls: result.urls });
  } catch (e) {
    console.error("toggleApprovedDesign failed:", e);
    return NextResponse.json({ error: "Could not update the approved designs" }, { status: 500 });
  }
}
