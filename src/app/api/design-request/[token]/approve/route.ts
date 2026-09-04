import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { dbEnabled } from "@/db";
import { getByStatusToken, approveDesign } from "@/lib/design-requests";
import { provisionTeamOrderForApprovedDesign } from "@/lib/team-orders";
import { generateAssetSheets, hasAssetSheets } from "@/lib/design-lab-assets";
import { postDesignThreadUpdate } from "@/lib/discord";
import { setThreadStageTag } from "@/lib/discord-bot";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;

  const request = await getByStatusToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const reviewProofs = request.proofReviewUrls?.length ? request.proofReviewUrls : request.proofImages ?? [];
  if (!reviewProofs.length) {
    return NextResponse.json({ error: "There's no proof to approve yet." }, { status: 400 });
  }
  const existingApproved = request.approvedDesignUrls ?? (request.approvedDesignUrl ? [request.approvedDesignUrl] : []);
  if ((request.status === "approved" || request.status === "ordered") && reviewProofs.every((url) => existingApproved.includes(url))) {
    return NextResponse.json({ ok: true, alreadyApproved: true });
  }

  let body: { approvedUrl?: string; approvedUrls?: string[] } = {};
  try {
    body = await req.json();
  } catch {}

  // Accept one or many selected proofs; keep only URLs that are real proofs.
  const requested = body.approvedUrls?.length ? body.approvedUrls : body.approvedUrl ? [body.approvedUrl] : [];
  const valid = requested.filter((u) => reviewProofs.includes(u));
  // Default to the most recent proof image if none specified/valid.
  const approvedUrls = valid.length ? valid : [reviewProofs[reviewProofs.length - 1]];

  try {
    await approveDesign(request.id, approvedUrls);

    // Individual trace-ready asset sheets (pattern / wordmark / emblem) from the
    // approved artwork, same as the AI lab produces. Guarded + backgrounded so a
    // design that already has them (e.g. an AI-lab submission) isn't redone.
    if (!hasAssetSheets(request.inspirationImages)) {
      waitUntil(
        generateAssetSheets({
          designId: request.id,
          reference: request.reference,
          teamName: request.teamName,
          sport: request.sport,
          style: request.jerseyStyle,
          threadId: request.discordThreadId,
          currentImages: request.inspirationImages ?? [],
          sourceImageUrl: approvedUrls[0],
        }).catch((e) => console.error("generateAssetSheets (approve) failed:", e)),
      );
    }

    // Provision the team order right here so the customer's SAME link
    // (/design/status) rolls straight into roster entry - no separate
    // team-order form or link to hand out. Idempotent: skip if one already
    // exists for this design. Defaults: recommended Mesh material, items from
    // the intake, SMS consent + rush carried over from the design.
    const provisionedOrder = await provisionTeamOrderForApprovedDesign(request);

    // Post into the same Discord thread so the team sees the approval inline.
    await postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: `✅ Approved - ${request.teamName} (${request.reference})`,
      description: `Client approved ${approvedUrls.length === 1 ? "the design" : `${approvedUrls.length} designs`}. Their order (${provisionedOrder?.reference ?? "team order"}) is set up and they're filling their roster on the same link.\n\n⚠️ DO NOT START PRODUCTION YET. Approval is not payment - production starts only after the customer pays ${provisionedOrder?.rushShipping ? "the Rush order in full" : "their 50% deposit"}.`,
      imageUrl: approvedUrls[0],
      username: "Slugger Design Requests",
    });
    await setThreadStageTag(request.discordThreadId, "✅ Approved");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("approveDesign failed:", e);
    return NextResponse.json({ error: "Could not approve" }, { status: 500 });
  }
}
