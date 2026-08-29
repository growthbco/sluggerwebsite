import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/design-requests";
import { getByDesignRequestId, getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { suggestStaffReply } from "@/lib/design-assistant";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Logged-in staff/designer only: draft a reply for human review. Restricted
// designer drafts receive design-thread context, never customer contact,
// payment, pricing, or shipping records.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const gate = await requireApiRole("production");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 403 ? "Forbidden" : "Unauthorized" },
      { status: gate.status },
    );
  }
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { name?: string; direction?: string } = {};
  try { body = await req.json(); } catch {}

  try {
    const limited = gate.session.role === "designer";
    const order = limited ? null : await getByDesignRequestId(request.id);
    const roster = order ? await getRoster(order.id) : [];
    const draft = await suggestStaffReply({
      design: {
        reference: request.reference,
        teamName: request.teamName,
        sport: request.sport,
        status: request.status,
        revisionsUsed: request.revisionsUsed,
        proofCount: request.proofImages?.length ?? 0,
        rush: request.rush,
        neededBy: request.neededBy,
      },
      order: order
        ? {
            reference: order.reference,
            status: order.status,
            items: order.items ?? ["jersey"],
            rosterCount: roster.length,
            estimateCents: roster.length ? computeTeamOrderQuote(order, roster).totalCents : null,
            quotedTotalCents: order.quotedTotalCents,
            depositPaidAt: order.depositPaidAt,
            invoicePaidAt: order.invoicePaidAt,
            shippedAt: order.shippedAt,
          }
        : null,
      messages: request.messages ?? [],
      staffName: limited ? gate.session.name : (body.name ?? "").trim().slice(0, 40) || gate.session.name,
      direction: (body.direction ?? "").trim().slice(0, 1500) || undefined,
      limited,
    });
    if (!draft) return NextResponse.json({ error: "No suggestion available right now - try again." }, { status: 503 });
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    console.error("suggest-reply failed:", e);
    return NextResponse.json({ error: "Could not draft a suggestion" }, { status: 500 });
  }
}
