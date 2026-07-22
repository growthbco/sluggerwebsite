import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/design-requests";
import { getByDesignRequestId, getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { suggestStaffReply } from "@/lib/design-assistant";

export const runtime = "nodejs";

// Staff-only (manage token): draft an AI reply suggestion for the message
// thread. The draft lands in the composer for the staff member to edit and
// send under their own name - nothing is sent to the client from here.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { name?: string } = {};
  try { body = await req.json(); } catch {}

  try {
    const order = await getByDesignRequestId(request.id);
    const roster = order ? await getRoster(order.id) : [];
    const draft = await suggestStaffReply({
      design: {
        reference: request.reference,
        teamName: request.teamName,
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
      staffName: (body.name ?? "").trim().slice(0, 40) || undefined,
    });
    if (!draft) return NextResponse.json({ error: "No suggestion available right now - try again." }, { status: 503 });
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    console.error("suggest-reply failed:", e);
    return NextResponse.json({ error: "Could not draft a suggestion" }, { status: 500 });
  }
}
