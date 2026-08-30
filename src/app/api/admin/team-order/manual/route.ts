import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { createManualTeamOrder } from "@/lib/manual-team-orders";

export const runtime = "nodejs";

/** Authenticated API entry point used when Codex or another staff tool enters
 * an order on Gary's behalf. Timeline fields are validated server-side and
 * cannot be bypassed by omitting them from the request. */
export async function POST(request: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request" }, { status: 400 });
  }

  try {
    const result = await createManualTeamOrder(body);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Manual team order creation failed:", error);
    return NextResponse.json({ error: "Could not create the manual order." }, { status: 500 });
  }
}
