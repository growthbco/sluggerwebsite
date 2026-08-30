import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { updateRosterRowsBulkAndNotify, type BulkRosterUpdate } from "@/lib/team-orders";

export const runtime = "nodejs";

// Staff-only exceptional correction path. Customer edits are locked after the
// deposit; when staff must fix several jerseys, this endpoint posts one clear
// designer summary instead of flooding Discord with per-row notifications.
export async function POST(req: Request) {
  const auth = await requireApiRole("money");
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Forbidden" }, { status: auth.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json().catch(() => null) as { teamOrderId?: unknown; updates?: unknown } | null;
  const teamOrderId = typeof body?.teamOrderId === "string" ? body.teamOrderId : "";
  const incoming = Array.isArray(body?.updates) ? body.updates.slice(0, 200) : [];
  if (!teamOrderId || !incoming.length) {
    return NextResponse.json({ error: "Order and at least one roster update are required." }, { status: 400 });
  }

  const updates: BulkRosterUpdate[] = incoming.flatMap((raw): BulkRosterUpdate[] => {
    if (!raw || typeof raw !== "object") return [];
    const value = raw as { rowId?: unknown; patch?: unknown };
    if (typeof value.rowId !== "string" || !value.patch || typeof value.patch !== "object") return [];
    const source = value.patch as Record<string, unknown>;
    const sizes = source.sizes && typeof source.sizes === "object" && !Array.isArray(source.sizes)
      ? Object.fromEntries(
          Object.entries(source.sizes as Record<string, unknown>)
            .filter(([, size]) => typeof size === "string" && size.trim())
            .slice(0, 10)
            .map(([key, size]) => [key.slice(0, 64), String(size).trim().slice(0, 30)]),
        )
      : undefined;
    return [{
      rowId: value.rowId,
      patch: {
        ...(typeof source.playerName === "string" ? { playerName: source.playerName.trim().slice(0, 60) } : {}),
        ...(typeof source.playerNumber === "string" ? { playerNumber: source.playerNumber.trim().slice(0, 4) } : {}),
        ...(typeof source.notes === "string" ? { notes: source.notes.trim().slice(0, 200) } : {}),
        ...(typeof source.design === "string" ? { design: source.design.trim().slice(0, 60) } : {}),
        ...(sizes ? { sizes } : {}),
      },
    }];
  });
  if (updates.length !== incoming.length) {
    return NextResponse.json({ error: "One or more roster updates are invalid." }, { status: 400 });
  }

  try {
    const result = await updateRosterRowsBulkAndNotify(teamOrderId, updates);
    if (!result.notified) {
      return NextResponse.json({ error: "Roster updated, but the designer summary could not be sent.", ...result }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("bulk roster update failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update roster." }, { status: 400 });
  }
}
