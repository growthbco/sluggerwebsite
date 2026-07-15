import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, getRoster, submitTeamOrder } from "@/lib/team-orders";
import { postTeamOrderToDiscord } from "@/lib/discord";
import { markOrdered, getById } from "@/lib/design-requests";

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

  try {
    await submitTeamOrder(order.id);
    // Linked orders post into the design's existing thread (one project, one
    // thread); standalone orders go to #team-orders.
    const design = order.designRequestId ? await getById(order.designRequestId) : null;
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
        roster: roster.map((r) => ({
          name: r.playerName ?? undefined,
          number: r.playerNumber ?? undefined,
          size: r.size ?? undefined,
          sizes: r.sizes ?? undefined,
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

    return NextResponse.json({ ok: true, reference: order.reference });
  } catch (e) {
    console.error("submitTeamOrder failed:", e);
    return NextResponse.json({ error: "Could not submit order" }, { status: 500 });
  }
}
