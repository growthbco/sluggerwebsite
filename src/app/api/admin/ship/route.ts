import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { markShipped } from "@/lib/fulfillment";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only manual path: record an externally bought (e.g. Pirate Ship)
// tracking number, flip the status, email the customer.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { kind?: string; id?: string; trackingNumber?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const tracking = (body.trackingNumber ?? "").trim().slice(0, 60);
  if (!body.id || !tracking || !["team_order", "order"].includes(body.kind ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await markShipped(body.kind as "team_order" | "order", body.id, tracking);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, emailed: result.emailed });
}
