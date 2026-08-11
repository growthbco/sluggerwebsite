import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { stripeEnabled } from "@/lib/stripe";
import { requireApiRole } from "@/lib/admin-auth";
import { sendTeamOrderInvoice } from "@/lib/team-order-invoicing";

export const runtime = "nodejs";

// Admin "Send invoice" button - the actual invoicing logic lives in
// src/lib/team-order-invoicing.ts (shared with roster-submit auto-invoicing).
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled() || !stripeEnabled()) {
    return NextResponse.json({ error: "Database or Stripe not configured" }, { status: 503 });
  }

  let body: { teamOrderId?: string; stage?: string; ship?: "auto" | "pickup"; shipWeightOz?: number } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamOrderId) return NextResponse.json({ error: "Missing teamOrderId" }, { status: 400 });

  const result = await sendTeamOrderInvoice({
    teamOrderId: body.teamOrderId,
    stage: body.stage === "balance" ? "balance" : "deposit",
    ship: body.ship,
    shipWeightOz: body.shipWeightOz,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const { ok, teamName, reference, ...rest } = result;
  void teamName; void reference;
  return NextResponse.json({ ok, ...rest });
}
