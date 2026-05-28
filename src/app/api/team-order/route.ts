import { NextResponse } from "next/server";
import { postTeamOrderToDiscord } from "@/lib/discord";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const roster = (body.roster ?? []).filter(
    (r) => r.name || r.number || r.size || (r.sizes && Object.keys(r.sizes).length),
  );
  if (!body.teamName || !body.contactName) {
    return NextResponse.json({ error: "Team name and contact name are required." }, { status: 400 });
  }
  if (roster.length === 0) {
    return NextResponse.json({ error: "Add at least one player to the roster." }, { status: 400 });
  }

  const reference = `TO-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const posted = await postTeamOrderToDiscord({
    reference,
    teamName: body.teamName,
    contactName: body.contactName,
    contactEmail: body.contactEmail,
    contactPhone: body.contactPhone,
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

  // The order is captured for the team even if Discord isn't configured yet.
  return NextResponse.json({ ok: true, reference, notified: posted });
}
