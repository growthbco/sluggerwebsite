import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, addProofImages, removeProofImage } from "@/lib/design-requests";
import { emailProofReady } from "@/lib/email";
import { postDesignThreadUpdate } from "@/lib/discord";
import { setThreadStageTag } from "@/lib/discord-bot";

export const runtime = "nodejs";

// Designer uploads one or more proof image URLs (already uploaded to Blob).
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { urls?: string[]; labels?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const urls = (body.urls ?? []).filter(Boolean);
  if (urls.length === 0) {
    return NextResponse.json({ error: "No proof URLs provided." }, { status: 400 });
  }

  try {
    await addProofImages(request.id, urls, body.labels);
    // Notify client their proof is ready.
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    await emailProofReady({
      to: request.contactEmail,
      teamName: request.teamName,
      reference: request.reference,
      statusUrl: `${SITE}/design/status/${request.statusToken}`,
    });
    // Log into the Discord thread so the team has a single timeline.
    await postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: `📤 Proof sent - ${request.teamName} (${request.reference})`,
      description: `${urls.length} proof${urls.length === 1 ? "" : "s"} sent to the client for review.`,
      imageUrl: urls[urls.length - 1],
      username: "Slugger Design Requests",
    });
    await setThreadStageTag(request.discordThreadId, "🎨 Designing");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("addProofImages failed:", e);
    return NextResponse.json({ error: "Could not save proof" }, { status: 500 });
  }
}

// Designer removes a single proof they'd previously sent (e.g. stale old ones).
export async function DELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  let body: { url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const url = (body.url ?? "").trim();
  if (!url) return NextResponse.json({ error: "No proof specified." }, { status: 400 });
  try {
    await removeProofImage(request.id, url);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("removeProofImage failed:", e);
    return NextResponse.json({ error: "Could not remove proof" }, { status: 500 });
  }
}
