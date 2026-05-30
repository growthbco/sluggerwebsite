import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByStatusToken, requestChanges, MAX_REVISIONS, type Annotation } from "@/lib/design-requests";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;

  const request = await getByStatusToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { generalNote?: string; proofImageUrl?: string; annotations?: Annotation[] } = {};
  try {
    body = await req.json();
  } catch {}

  const hasNote = (body.generalNote ?? "").trim().length > 0;
  const hasPins = (body.annotations ?? []).some((a) => (a.note ?? "").trim().length > 0);
  if (!hasNote && !hasPins) {
    return NextResponse.json({ error: "Add at least one note or annotation pin." }, { status: 400 });
  }

  try {
    const result = await requestChanges(request.id, {
      generalNote: body.generalNote,
      proofImageUrl: body.proofImageUrl,
      annotations: body.annotations,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: `You've used all ${result.max} free revisions. Email apparel@sluggerathletics.com to continue.`, used: result.used, max: result.max },
        { status: 409 },
      );
    }

    // Post a follow-up INTO the existing Discord thread (forum) so the back-
    // and-forth lives in one place. Falls back gracefully if thread id wasn't
    // captured (older requests).
    const pinFields = (body.annotations ?? [])
      .filter((a) => (a.note ?? "").trim().length > 0)
      .map((a) => ({ name: `Pin ${a.n}`, value: a.note.slice(0, 1000), inline: false }));
    const fields = [...pinFields];
    if (body.generalNote?.trim()) {
      fields.push({ name: "General note", value: body.generalNote.trim().slice(0, 1024), inline: false });
    }
    fields.push({
      name: "Round",
      value: `${result.used} of ${MAX_REVISIONS} revisions used`,
      inline: false,
    });
    await postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: `✏️ Changes requested — ${request.teamName} (${request.reference})`,
      description: pinFields.length
        ? "Pins are tied to specific spots on the proof. See the manage view for the visual overlay."
        : undefined,
      fields,
      imageUrl: body.proofImageUrl,
      username: "Slugger Design Requests",
    });

    return NextResponse.json({ ok: true, used: result.used, max: result.max });
  } catch (e) {
    console.error("requestChanges failed:", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
