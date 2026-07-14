import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, addRosterRow } from "@/lib/team-orders";

export const runtime = "nodejs";

type IncomingRow = {
  name?: string;
  number?: string;
  sizes?: Record<string, string>;
  notes?: string;
};

// Coach bulk-adds reviewed roster rows (authed by the private manage token).
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (order.status !== "draft" && order.status !== "collecting") {
    return NextResponse.json({ error: "This order is already submitted - email us to change the roster." }, { status: 409 });
  }

  let rows: IncomingRow[] = [];
  try {
    ({ rows } = await req.json());
  } catch {}
  rows = (Array.isArray(rows) ? rows : []).filter((r) => (r.name ?? "").trim()).slice(0, 200);
  if (rows.length === 0) return NextResponse.json({ error: "No players to add." }, { status: 400 });

  let added = 0;
  for (const r of rows) {
    try {
      await addRosterRow(
        order.id,
        {
          playerName: String(r.name ?? "").trim().slice(0, 60),
          playerNumber: String(r.number ?? "").trim().slice(0, 4),
          sizes: Object.fromEntries(
            Object.entries(r.sizes ?? {})
              .filter(([, v]) => String(v ?? "").trim())
              .slice(0, 10)
              .map(([k, v]) => [String(k).slice(0, 20), String(v).trim().slice(0, 30)]),
          ),
          notes: String(r.notes ?? "").trim().slice(0, 200) || undefined,
        },
        "coach",
      );
      added++;
    } catch (e) {
      console.error("import row failed:", e);
    }
  }
  return NextResponse.json({ ok: true, added });
}
