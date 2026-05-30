import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByStatusToken, requestChanges, type Annotation } from "@/lib/design-requests";

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

  // Need something to say.
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
    return NextResponse.json({ ok: true, used: result.used, max: result.max });
  } catch (e) {
    console.error("requestChanges failed:", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
