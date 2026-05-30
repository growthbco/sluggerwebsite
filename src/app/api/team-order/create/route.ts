import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { createTeamOrder } from "@/lib/team-orders";
import { getByStatusToken } from "@/lib/design-requests";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "Self-entry links need the database configured (DATABASE_URL)." },
      { status: 503 },
    );
  }

  let body: { teamName?: string; contactName?: string; contactEmail?: string; contactPhone?: string; jerseyStyle?: string; jerseyMaterial?: string; items?: string[]; designToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // If a designToken is attached, the team/contact identity MUST come from the
  // design — the link between approved design → team order is the source of
  // truth for which uniform belongs to which team.
  let teamName = body.teamName;
  let contactName = body.contactName;
  let contactEmail = body.contactEmail;
  let contactPhone = body.contactPhone;
  let designRequestId: string | undefined;
  if (body.designToken) {
    const design = await getByStatusToken(body.designToken);
    if (design) {
      designRequestId = design.id;
      if (design.status === "approved" || design.status === "ordered") {
        teamName = design.teamName;
        contactName = design.contactName;
        contactEmail = design.contactEmail;
        contactPhone = design.contactPhone ?? undefined;
      }
    }
  }

  if (!teamName || !contactName || !contactEmail) {
    return NextResponse.json({ error: "Team name, your name, and email are required." }, { status: 400 });
  }

  try {
    const { reference, selfEntryToken, manageToken } = await createTeamOrder({
      teamName,
      contactName,
      contactEmail,
      contactPhone,
      jerseyStyle: body.jerseyStyle,
      jerseyMaterial: body.jerseyMaterial,
      items: body.items,
      designRequestId,
    });
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return NextResponse.json({
      reference,
      shareUrl: `${SITE}/team-order/join/${selfEntryToken}`,
      manageUrl: `${SITE}/team-order/manage/${manageToken}`,
    });
  } catch (e) {
    console.error("createTeamOrder failed:", e);
    return NextResponse.json({ error: "Could not create team order" }, { status: 500 });
  }
}
