import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { customerRosterLockMessage, getByManageToken, setJerseyMaterial, setRequiresNames } from "@/lib/team-orders";
import { JERSEY_MATERIALS } from "@/lib/order-items";

export const runtime = "nodejs";

// Coach roster-form survey answers, saved from their manage link. Currently just
// the "names on the back?" question, which shows/hides the player-name field.
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const lockMessage = customerRosterLockMessage(order);
  if (lockMessage) return NextResponse.json({ error: lockMessage, code: "ROSTER_LOCKED" }, { status: 409 });

  let body: { requiresNames?: boolean; jerseyMaterial?: string } = {};
  try { body = await req.json(); } catch {}
  if (typeof body.requiresNames === "boolean") {
    await setRequiresNames(order.id, body.requiresNames);
    return NextResponse.json({ ok: true });
  }
  if (body.jerseyMaterial && JERSEY_MATERIALS.some((material) => material.key === body.jerseyMaterial)) {
    await setJerseyMaterial(order.id, body.jerseyMaterial);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Choose a valid setting." }, { status: 400 });
}
