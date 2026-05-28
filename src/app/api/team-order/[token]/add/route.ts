import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getBySelfEntryToken, addRosterRow } from "@/lib/team-orders";

export const runtime = "nodejs";

// A player adds their own row via the public self-entry link.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;

  const order = await getBySelfEntryToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (!order.selfEntryOpen) {
    return NextResponse.json({ error: "This roster is closed - it's already been submitted." }, { status: 409 });
  }

  let body: { playerName?: string; playerNumber?: string; sizes?: Record<string, string>; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const hasSize = body.sizes && Object.values(body.sizes).some(Boolean);
  if (!body.playerName || !hasSize) {
    return NextResponse.json({ error: "Name and at least one size are required." }, { status: 400 });
  }

  try {
    await addRosterRow(order.id, {
      playerName: body.playerName,
      playerNumber: body.playerNumber,
      sizes: body.sizes,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("addRosterRow failed:", e);
    return NextResponse.json({ error: "Could not save your entry" }, { status: 500 });
  }
}
