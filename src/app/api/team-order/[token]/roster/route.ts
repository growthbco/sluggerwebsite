import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, updateRosterRow, deleteRosterRow, ensureTeamOrderDiscordThread } from "@/lib/team-orders";
import { postDesignThreadUpdate } from "@/lib/discord";
import { missingCheerSizeLabels } from "@/lib/order-items";

export const runtime = "nodejs";

// The coach can correct/remove a roster row from their manage link, even after
// submission - but only until payment funds production. Pre-deposit edits stay
// quiet in Discord; the payment event posts one final locked roster snapshot.

export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const lockMessage = customerRosterLockMessage(order);
  if (lockMessage) return NextResponse.json({ error: lockMessage, code: "ROSTER_LOCKED" }, { status: 409 });

  let body: { rowId?: string; playerName?: string; playerNumber?: string; sizes?: Record<string, string>; notes?: string; design?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.rowId) return NextResponse.json({ error: "Missing row" }, { status: 400 });
  if (body.sizes && missingCheerSizeLabels(order.items ?? ["jersey"], body.sizes).length) {
    return NextResponse.json({ error: "Choose both a cheer top size and skirt size." }, { status: 400 });
  }

  const patch = {
    ...(body.playerName !== undefined ? { playerName: String(body.playerName).trim().slice(0, 60) } : {}),
    ...(body.playerNumber !== undefined ? { playerNumber: String(body.playerNumber).trim().slice(0, 4) } : {}),
    ...(body.notes !== undefined ? { notes: String(body.notes).trim().slice(0, 200) } : {}),
    ...(body.design !== undefined ? { design: String(body.design).trim().slice(0, 60) } : {}),
    ...(body.sizes
      ? {
          sizes: Object.fromEntries(
            Object.entries(body.sizes)
              .filter(([, v]) => String(v ?? "").trim())
              .slice(0, 10)
              .map(([k, v]) => [String(k).slice(0, 64), String(v).trim().slice(0, 30)]),
          ),
        }
      : {}),
  };

  const ok = await updateRosterRow(order.id, body.rowId, patch);
  if (!ok) return NextResponse.json({ error: "Player not found on this order" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const lockMessage = customerRosterLockMessage(order);
  if (lockMessage) return NextResponse.json({ error: lockMessage, code: "ROSTER_LOCKED" }, { status: 409 });

  let body: { rowId?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.rowId) return NextResponse.json({ error: "Missing row" }, { status: 400 });

  const ok = await deleteRosterRow(order.id, body.rowId);
  if (!ok) return NextResponse.json({ error: "Player not found on this order" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
