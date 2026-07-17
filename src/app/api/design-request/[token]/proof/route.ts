import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, addProofImages } from "@/lib/design-requests";
import { emailProofReady } from "@/lib/email";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

// Designer uploads one or more proof image URLs (already uploaded to Blob).
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { urls?: string[] };
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
    await addProofImages(request.id, urls);
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
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("addProofImages failed:", e);
    return NextResponse.json({ error: "Could not save proof" }, { status: 500 });
  }
}
