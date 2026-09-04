import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, addProofImages, removeProofImage } from "@/lib/design-requests";
import { customerRosterLockMessage, getByDesignRequestId } from "@/lib/team-orders";
import { emailProofReady } from "@/lib/email";
import { smsIfConsented } from "@/lib/sms";
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
  const linkedOrder = await getByDesignRequestId(request.id);
  const productionLock = linkedOrder ? customerRosterLockMessage(linkedOrder) : null;
  if (productionLock) {
    return NextResponse.json({ error: `A new proof cannot be sent after production is funded. ${productionLock}` }, { status: 409 });
  }

  let body: { urls?: string[]; labels?: Record<string, string>; replaceCurrentReview?: boolean };
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
    await addProofImages(request.id, urls, body.labels, { replaceCurrentReview: body.replaceCurrentReview === true });
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const statusUrl = `${SITE}/design/status/${request.statusToken}`;

    // VERIFY the client was actually reached. Email is the only channel unless
    // they opted into texts, so a silent email failure = they got nothing.
    // Retry the email once, then surface the true outcome (a "proof_sent" flag
    // that isn't backed by a delivered notification is how clients slip through).
    let emailed = await emailProofReady({ to: request.contactEmail, teamName: request.teamName, reference: request.reference, statusUrl });
    if (!emailed) emailed = await emailProofReady({ to: request.contactEmail, teamName: request.teamName, reference: request.reference, statusUrl });
    const texted = await smsIfConsented({
      phone: request.contactPhone,
      optInAt: request.smsOptInAt,
      body: `Slugger Athletics: your ${request.teamName} design proof is ready! 🎨 Review + approve: ${statusUrl}`,
    });

    // Human-readable delivery outcome, shown to the staffer who sent it AND
    // logged in the Discord thread so nothing goes out unnoticed.
    const undelivered = !emailed && !texted;
    const notice = emailed
      ? texted
        ? "Emailed and texted the client."
        : "Emailed the client. No text backup - they are not opted into SMS, so follow up if you do not hear back."
      : texted
        ? "Email FAILED - reached the client by text only. Double-check the email address on file."
        : "NOT DELIVERED - the email failed and the client has no SMS opt-in. Send them the link manually.";

    // Log into the Discord thread so the team has a single timeline.
    await postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: `${undelivered ? "⚠️" : "📤"} Proof sent - ${request.teamName} (${request.reference})`,
      description: `${urls.length} proof${urls.length === 1 ? "" : "s"} sent for review. ${notice}${undelivered ? `\nClient link: ${statusUrl}` : ""}`,
      imageUrl: urls[urls.length - 1],
      username: "Slugger Design Requests",
    });
    await setThreadStageTag(request.discordThreadId, "🎨 Designing");
    return NextResponse.json({ ok: true, emailed, texted, notice });
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
