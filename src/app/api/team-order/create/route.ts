import { NextResponse } from "next/server";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createTeamOrder } from "@/lib/team-orders";
import { getByStatusToken, findActiveDesignByEmail } from "@/lib/design-requests";
import { JERSEY_MATERIALS } from "@/lib/order-items";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "Self-entry links need the database configured (DATABASE_URL)." },
      { status: 503 },
    );
  }

  let body: { teamName?: string; contactName?: string; contactEmail?: string; contactPhone?: string; smsConsent?: boolean; sport?: string; jerseyStyle?: string; jerseyMaterial?: string; items?: string[]; designToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // If a designToken is attached, the team/contact identity MUST come from the
  // design - the link between approved design → team order is the source of
  // truth for which uniform belongs to which team.
  let teamName = body.teamName;
  let contactName = body.contactName;
  let contactEmail = body.contactEmail;
  let contactPhone = body.contactPhone;
  let sport = body.sport;
  let designRequestId: string | undefined;
  let discordThreadId: string | undefined;
  let rushFromDesign = false;
  let whiteLabelFromDesign = false;
  let trustedDesignToken = false;
  if (body.designToken) {
    const design = await getByStatusToken(body.designToken);
    if (design && design.status !== "cancelled") {
      trustedDesignToken = true;
      designRequestId = design.id;
      discordThreadId = design.discordThreadId ?? undefined;
      rushFromDesign = Boolean(design.rush);
      whiteLabelFromDesign = Boolean(design.whiteLabel);
      sport = design.sport ?? sport;
      if (design.status === "approved" || design.status === "ordered") {
        teamName = design.teamName;
        contactName = design.contactName;
        contactEmail = design.contactEmail;
        contactPhone = design.contactPhone ?? undefined;
      }
    }
  }
  // Safety net: no design link, but this email has exactly one active design
  // request - attach the order to it so roster notifications land in that
  // design's Discord thread instead of spawning a disconnected one.
  if (!designRequestId && !body.designToken && body.contactEmail) {
    const design = await findActiveDesignByEmail(body.contactEmail);
    if (design) {
      designRequestId = design.id;
      discordThreadId = design.discordThreadId ?? undefined;
      rushFromDesign = Boolean(design.rush);
      whiteLabelFromDesign = Boolean(design.whiteLabel);
      sport = design.sport ?? sport;
    }
  }

  if (!teamName || !contactName || !contactEmail) {
    return NextResponse.json({ error: "Team name, your name, and email are required." }, { status: 400 });
  }

  // Don't spawn a duplicate job: if this design already has an OPEN, unpaid order,
  // hand back THAT order's links instead of starting a second one. A brand new TO
  // is only right once the prior job is in production, shipped, or paid.
  if (designRequestId) {
    const { getByDesignRequestId } = await import("@/lib/team-orders");
    const existing = await getByDesignRequestId(designRequestId);
    const OPEN_UNPAID = ["draft", "collecting", "submitted", "quoted"];
    if (existing && OPEN_UNPAID.includes(existing.status) && !existing.depositPaidAt && !existing.invoicePaidAt) {
      const selectedMaterial = JERSEY_MATERIALS.some((material) => material.key === body.jerseyMaterial)
        ? body.jerseyMaterial
        : undefined;
      if (trustedDesignToken) {
        await getDb()
          .update(teamOrders)
          .set({
            sport: sport ?? existing.sport,
            jerseyStyle: body.jerseyStyle ?? existing.jerseyStyle,
            jerseyMaterial: selectedMaterial ?? existing.jerseyMaterial,
            items: body.items?.length ? body.items : existing.items,
            whiteLabel: whiteLabelFromDesign || existing.whiteLabel,
            updatedAt: new Date(),
          })
          .where(eq(teamOrders.id, existing.id));
      }
      const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      return NextResponse.json({
        reference: existing.reference,
        shareUrl: `${SITE}/team-order/join/${existing.selfEntryToken}`,
        manageUrl: `${SITE}/team-order/manage/${existing.manageToken}`,
      });
    }
  }

  try {
    const { reference, selfEntryToken, manageToken } = await createTeamOrder({
      teamName,
      contactName,
      contactEmail,
      contactPhone,
      sport,
      jerseyStyle: body.jerseyStyle,
      jerseyMaterial: JERSEY_MATERIALS.some((material) => material.key === body.jerseyMaterial)
        ? body.jerseyMaterial
        : undefined,
      items: body.items,
      designRequestId,
      whiteLabel: whiteLabelFromDesign,
      discordThreadId,
      rushShipping: rushFromDesign,
      smsOptIn: body.smsConsent === true && Boolean(contactPhone),
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
