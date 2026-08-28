import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, updateRosterRow, deleteRosterRow, ensureTeamOrderDiscordThread } from "@/lib/team-orders";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

// The coach can correct/remove a roster row from their manage link, even after
// submission - up until the order ships. A size fix shouldn't require emailing
// us. Post-submission changes ping the order's Discord thread so staff catch
// them before production, and clear that jersey's print-file verification.
const LOCKED = new Set(["shipped", "cancelled"]);

function pingStaff(order: Awaited<ReturnType<typeof getByManageToken>>, summary: string) {
  if (!order) return;
  void (async () => {
    try {
      await postDesignThreadUpdate({
        threadId: (await ensureTeamOrderDiscordThread(order.id)) ?? undefined,
        title: `✏️ Roster change by coach - ${order.teamName} (${order.reference})`,
        description: `${summary}\n\nThe coach edited the roster from their manage link after the order was submitted. Re-check the print file for the affected jersey before it goes to production.`,
        mention: true,
        username: "Slugger Custom Orders",
      });
    } catch (e) {
      console.error("roster-change ping failed:", e);
    }
  })();
}

export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (LOCKED.has(order.status)) {
    return NextResponse.json({ error: "This order has already shipped - text or email us and we'll help." }, { status: 409 });
  }

  let body: { rowId?: string; playerName?: string; playerNumber?: string; sizes?: Record<string, string>; notes?: string; design?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.rowId) return NextResponse.json({ error: "Missing row" }, { status: 400 });

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

  const submitted = !["draft", "collecting"].includes(order.status);
  if (submitted) {
    const who = [patch.playerName, patch.playerNumber ? `#${patch.playerNumber}` : null].filter(Boolean).join(" ") || "a player";
    const what = patch.sizes ? `sizes -> ${Object.entries(patch.sizes).map(([k, v]) => `${k}: ${v}`).join(", ")}` : "details updated";
    pingStaff(order, `${who}: ${what}`);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (LOCKED.has(order.status)) {
    return NextResponse.json({ error: "This order has already shipped - text or email us and we'll help." }, { status: 409 });
  }

  let body: { rowId?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.rowId) return NextResponse.json({ error: "Missing row" }, { status: 400 });

  const ok = await deleteRosterRow(order.id, body.rowId);
  if (!ok) return NextResponse.json({ error: "Player not found on this order" }, { status: 404 });

  const submitted = !["draft", "collecting"].includes(order.status);
  if (submitted) pingStaff(order, "A player was removed from the roster.");
  return NextResponse.json({ ok: true });
}
