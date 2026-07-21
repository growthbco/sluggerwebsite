import { NextResponse } from "next/server";
import { postTeamOrderToDiscord } from "@/lib/discord";
import { dbEnabled } from "@/db";
import { getByStatusToken, findActiveDesignByEmail, markOrdered } from "@/lib/design-requests";
import { createTeamOrder, addRosterRow, submitTeamOrder } from "@/lib/team-orders";

export const runtime = "nodejs";

type RosterRow = { name?: string; number?: string; size?: string; sizes?: Record<string, string>; notes?: string };

// Manual-roster team order submission (coach typed/imported the full roster).
// Persists to the DB first - Discord is a notification, not the datastore.
export async function POST(req: Request) {
  let body: {
    teamName?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    jerseyStyle?: string;
    jerseyMaterial?: string;
    items?: string[];
    roster?: RosterRow[];
    designToken?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const roster = (body.roster ?? []).filter(
    (r) => r.name || r.number || r.size || (r.sizes && Object.keys(r.sizes).length),
  );

  // If a designToken is attached, the team/contact identity MUST come from the
  // design - the customer can't rename their team mid-funnel or break the link
  // between approved design → team order → print-file QA.
  let teamName = body.teamName;
  let contactName = body.contactName;
  let contactEmail = body.contactEmail;
  let contactPhone = body.contactPhone;
  let design: Awaited<ReturnType<typeof getByStatusToken>> | null = null;
  if (body.designToken && dbEnabled()) {
    design = await getByStatusToken(body.designToken);
    if (design?.status === "cancelled") design = null;
    // Identity-lock only once the proof is approved; before that the design's
    // own details may still be in flux, but the LINK stays either way so the
    // roster lands in the design's Discord thread.
    if (design && (design.status === "approved" || design.status === "ordered")) {
      teamName = design.teamName;
      contactName = design.contactName;
      contactEmail = design.contactEmail;
      contactPhone = design.contactPhone ?? undefined;
    }
  }
  // Safety net: coaches routinely skip their design link and fill this form by
  // hand. If their email has exactly one active design request, attach the
  // order to it so the roster posts into that design's existing thread instead
  // of spawning a disconnected one. Identity is NOT overridden here.
  if (!design && !body.designToken && body.contactEmail && dbEnabled()) {
    design = await findActiveDesignByEmail(body.contactEmail);
  }

  if (!teamName || !contactName || !contactEmail) {
    return NextResponse.json({ error: "Team name, contact name, and email are required." }, { status: 400 });
  }
  if (roster.length === 0) {
    return NextResponse.json({ error: "Add at least one player to the roster." }, { status: 400 });
  }
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Ordering isn't configured yet." }, { status: 503 });
  }

  const items = body.items?.length ? body.items : ["jersey"];

  try {
    // 1. Persist: order + roster rows, then lock it as submitted.
    const created = await createTeamOrder({
      teamName,
      contactName,
      contactEmail,
      contactPhone,
      jerseyStyle: body.jerseyStyle,
      jerseyMaterial: body.jerseyMaterial,
      items,
      designRequestId: design?.id,
    });
    for (const r of roster.slice(0, 200)) {
      await addRosterRow(
        created.id,
        {
          playerName: r.name,
          playerNumber: r.number,
          size: r.size,
          sizes: r.sizes,
          notes: r.notes,
        },
        "coach",
      );
    }
    await submitTeamOrder(created.id);
    if (design) {
      try {
        await markOrdered(design.id);
      } catch (e) {
        console.error("markOrdered failed:", e);
      }
    }

    // 2. Notify (never the source of truth). Linked orders post into the
    // design's existing thread so the whole project stays in one place.
    const posted = await postTeamOrderToDiscord(
      {
        reference: created.reference,
      teamName,
      contactName,
      contactEmail,
      contactPhone,
      jerseyStyle: body.jerseyStyle,
      jerseyMaterial: body.jerseyMaterial,
      items,
        roster: roster.map((r) => ({
          name: r.name,
          number: r.number,
          size: r.sizes?.jersey ?? r.size,
          sizes: r.sizes,
          notes: r.notes,
        })),
      },
      { designThreadId: design?.discordThreadId },
    );

    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return NextResponse.json({
      ok: true,
      reference: created.reference,
      manageUrl: `${SITE}/team-order/manage/${created.manageToken}`,
      notified: posted,
    });
  } catch (e) {
    console.error("team order create failed:", e);
    return NextResponse.json(
      { error: "Could not save your order - please try again or text us at (352) 660-1232." },
      { status: 500 },
    );
  }
}
