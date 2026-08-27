import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { autoInvoiceOnSubmit } from "@/lib/team-order-invoicing";
import { dbEnabled } from "@/db";
import { getByManageToken, getRoster, submitTeamOrder } from "@/lib/team-orders";
import { minPiecesForItems } from "@/lib/order-items";
import { postTeamOrderToDiscord } from "@/lib/discord";
import { markOrdered, getById, approvedMockupImages } from "@/lib/design-requests";
import { setThreadStageTag } from "@/lib/discord-bot";

export const runtime = "nodejs";

// Coach submits the order via their private manage link: locks self-entry and
// posts the final roster to #team-orders.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;

  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (order.status === "submitted") {
    return NextResponse.json({ error: "Already submitted." }, { status: 409 });
  }

  const roster = await getRoster(order.id);
  if (roster.length === 0) {
    return NextResponse.json({ error: "Add at least one player before submitting." }, { status: 400 });
  }
  // Elevated per-item minimums (e.g. cheer sets require 12). Default-6 items
  // aren't hard-blocked here, preserving existing jersey flows.
  const minPieces = minPiecesForItems(order.items);
  if (minPieces > 6 && roster.length < minPieces) {
    return NextResponse.json(
      { error: `This order has a ${minPieces}-piece minimum. You have ${roster.length} - add ${minPieces - roster.length} more to submit.` },
      { status: 400 },
    );
  }

  const design = order.designRequestId ? await getById(order.designRequestId) : null;
  const hasApprovedDesign = Boolean(
    order.approvedDesignUrl ||
      (design &&
        (design.status === "approved" || design.status === "ordered") &&
        (design.approvedDesignUrls?.length || design.approvedDesignUrl)),
  );
  if (!hasApprovedDesign) {
    return NextResponse.json(
      {
        code: "DESIGN_REQUIRED",
        error: "An approved design is required before you can submit this order. You can keep building the roster while the design is finished.",
      },
      { status: 409 },
    );
  }

  try {
    await submitTeamOrder(order.id);
    // Linked orders post into the design's existing thread (one project, one
    // thread); standalone orders go to #team-orders.
    await postTeamOrderToDiscord(
      {
        reference: order.reference,
        teamName: order.teamName,
        contactName: order.contactName,
        contactEmail: order.contactEmail ?? undefined,
        contactPhone: order.contactPhone ?? undefined,
        jerseyStyle: order.jerseyStyle ?? undefined,
        jerseyMaterial: order.jerseyMaterial ?? undefined,
        items: order.items ?? ["jersey"],
        designImages: design ? approvedMockupImages(design) : undefined,
        whiteLabel: order.whiteLabel,
        roster: roster.map((r) => ({
          name: r.playerName ?? undefined,
          number: r.playerNumber ?? undefined,
          size: r.size ?? undefined,
          sizes: r.sizes ?? undefined,
          design: r.design ?? undefined,
          notes: r.notes ?? undefined,
        })),
      },
      { designThreadId: design?.discordThreadId },
    );
    // If this team order is linked to a design request, flip the design to
    // "ordered" so the funnel reflects the linked outcome.
    if (order.designRequestId) {
      try { await markOrdered(order.designRequestId); } catch (e) { console.error("markOrdered failed:", e); }
    }

    await setThreadStageTag(design?.discordThreadId, "📋 Roster In");
    // Roster in → deposit invoice goes out by itself (print-file QA comes
    // after; production only starts once the deposit is paid).
    waitUntil(autoInvoiceOnSubmit(order.id));
    return NextResponse.json({ ok: true, reference: order.reference });
  } catch (e) {
    console.error("submitTeamOrder failed:", e);
    return NextResponse.json({ error: "Could not submit order" }, { status: 500 });
  }
}
