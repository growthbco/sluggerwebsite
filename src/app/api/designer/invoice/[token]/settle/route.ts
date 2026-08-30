import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { isValidDesignerToken, settleOneBillable } from "@/lib/designer-invoices";

export const runtime = "nodejs";

// Legacy settlement path for Slugger staff. A designer's private invoice link
// is not authorization to change what Slugger tracks as paid or owed.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const gate = await requireApiRole("money");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 403 ? "Forbidden" : "Unauthorized" },
      { status: gate.status },
    );
  }

  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  if (!isValidDesignerToken(token)) return NextResponse.json({ error: "Invalid link" }, { status: 401 });

  let body: { teamOrderId?: string; kind?: string } = {};
  try { body = await req.json(); } catch {}
  const kind = body.kind === "order" ? "order" : "team_order";
  if (!body.teamOrderId) return NextResponse.json({ error: "Missing order" }, { status: 400 });

  const result = await settleOneBillable(body.teamOrderId, kind);
  if (!result.ok) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Audit note to staff - a staff member removed a job from what we owe.
  const hook = process.env.DISCORD_INVOICES_WEBHOOK_URL || process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (hook) {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Slugger Vendor Billing",
        content: `🧾 ${gate.session.name} marked **${result.name ?? "an order"}${result.reference ? ` (${result.reference})` : ""}** as already paid by Slugger - removed from the vendor's billable list. Undo it on the admin order if that was a mistake.`,
      }),
    }).catch((e) => console.error("settle notify failed:", e));
  }

  return NextResponse.json({ ok: true });
}
