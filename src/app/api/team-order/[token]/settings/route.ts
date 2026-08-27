import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, setRequiresNames } from "@/lib/team-orders";

export const runtime = "nodejs";

// Coach roster-form survey answers, saved from their manage link. Currently just
// the "names on the back?" question, which shows/hides the player-name field.
const LOCKED = new Set(["shipped", "cancelled"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (LOCKED.has(order.status)) {
    return NextResponse.json({ error: "This order has already shipped - text or email us and we'll help." }, { status: 409 });
  }

  let body: { requiresNames?: boolean } = {};
  try { body = await req.json(); } catch {}
  if (typeof body.requiresNames !== "boolean") {
    return NextResponse.json({ error: "Missing requiresNames" }, { status: 400 });
  }

  await setRequiresNames(order.id, body.requiresNames);
  return NextResponse.json({ ok: true });
}
