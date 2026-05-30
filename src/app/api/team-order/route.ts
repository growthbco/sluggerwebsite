import { NextResponse } from "next/server";
import { postTeamOrderToDiscord } from "@/lib/discord";
import { dbEnabled } from "@/db";
import { getByStatusToken, markOrdered } from "@/lib/design-requests";

export const runtime = "nodejs";

type RosterRow = { name?: string; number?: string; size?: string; sizes?: Record<string, string>; notes?: string };

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
  // design — the customer can't rename their team mid-funnel or break the link
  // between approved design → team order → print-file QA.
  let teamName = body.teamName;
  let contactName = body.contactName;
  let contactEmail = body.contactEmail;
  let contactPhone = body.contactPhone;
  if (body.designToken && dbEnabled()) {
    const design = await getByStatusToken(body.designToken);
    if (design && (design.status === "approved" || design.status === "ordered")) {
      teamName = design.teamName;
      contactName = design.contactName;
      contactEmail = design.contactEmail;
      contactPhone = design.contactPhone ?? undefined;
    }
  }

  if (!teamName || !contactName) {
    return NextResponse.json({ error: "Team name and contact name are required." }, { status: 400 });
  }
  if (roster.length === 0) {
    return NextResponse.json({ error: "Add at least one player to the roster." }, { status: 400 });
  }

  const reference = `TO-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const posted = await postTeamOrderToDiscord({
    reference,
    teamName,
    contactName,
    contactEmail,
    contactPhone,
    jerseyStyle: body.jerseyStyle,
    jerseyMaterial: body.jerseyMaterial,
    items: body.items?.length ? body.items : ["jersey"],
    roster: roster.map((r) => ({
      name: r.name,
      number: r.number,
      size: r.sizes?.jersey ?? r.size,
      sizes: r.sizes,
      notes: r.notes,
    })),
  });

  // If this manual order came from an approved design, flip the design to
  // "ordered" so the funnel reflects the linked outcome.
  if (body.designToken && dbEnabled()) {
    try {
      const d = await getByStatusToken(body.designToken);
      if (d) await markOrdered(d.id);
    } catch (e) {
      console.error("markOrdered failed:", e);
    }
  }

  // The order is captured for the team even if Discord isn't configured yet.
  return NextResponse.json({ ok: true, reference, notified: posted });
}
