import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByStatusToken, approveDesign } from "@/lib/design-requests";
import { postDesignThreadUpdate } from "@/lib/discord";
import { setThreadStageTag } from "@/lib/discord-bot";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;

  const request = await getByStatusToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (request.status === "approved" || request.status === "ordered") {
    return NextResponse.json({ ok: true, alreadyApproved: true });
  }
  if (!request.proofImages?.length) {
    return NextResponse.json({ error: "There's no proof to approve yet." }, { status: 400 });
  }

  let body: { approvedUrl?: string; approvedUrls?: string[] } = {};
  try {
    body = await req.json();
  } catch {}

  // Accept one or many selected proofs; keep only URLs that are real proofs.
  const requested = body.approvedUrls?.length ? body.approvedUrls : body.approvedUrl ? [body.approvedUrl] : [];
  const valid = requested.filter((u) => request.proofImages!.includes(u));
  // Default to the most recent proof image if none specified/valid.
  const approvedUrls = valid.length ? valid : [request.proofImages[request.proofImages.length - 1]];

  try {
    await approveDesign(request.id, approvedUrls);
    // Post into the same Discord thread so the team sees the approval inline.
    await postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: `✅ Approved - ${request.teamName} (${request.reference})`,
      description: `Client approved ${approvedUrls.length === 1 ? "the design" : `${approvedUrls.length} designs`}. The customer is being routed into the Team Order form (their team + contact pre-filled, design auto-attached).`,
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
