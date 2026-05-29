import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByStatusToken, requestChanges } from "@/lib/design-requests";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;

  const request = await getByStatusToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { note?: string } = {};
  try {
    body = await req.json();
  } catch {}

  try {
    await requestChanges(request.id, body.note);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("requestChanges failed:", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
