import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { markCustomerPickedUp } from "@/lib/fulfillment";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamOrderId) return NextResponse.json({ error: "Missing team order." }, { status: 400 });

  const result = await markCustomerPickedUp(body.teamOrderId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true, notified: result.notified });
}
