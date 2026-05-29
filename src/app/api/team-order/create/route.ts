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
  if (!body.teamName || !body.contactName || !body.contactEmail) {
    return NextResponse.json({ error: "Team name, your name, and email are required." }, { status: 400 });
  }

  // Resolve linked design (if any), to attach the design request id.
  let designRequestId: string | undefined;
  if (body.designToken) {
    const req = await getByStatusToken(body.designToken);
    if (req) designRequestId = req.id;
  }

  try {
    const { reference, selfEntryToken, manageToken } = await createTeamOrder({
      teamName: body.teamName,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
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
