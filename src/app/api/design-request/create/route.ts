import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { createDesignRequest } from "@/lib/design-requests";
import { postDesignRequestToDiscord } from "@/lib/discord";
import { emailDesignRequestToDesigner, emailDesignRequestConfirmation } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { error: "Design requests need the database configured (DATABASE_URL)." },
      { status: 503 },
    );
  }

  let body: {
    teamName?: string;
    sport?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    vision?: string;
    colors?: string;
    notes?: string;
    inspirationImages?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.teamName || !body.contactName || !body.contactEmail) {
    return NextResponse.json({ error: "Team name, your name, and email are required." }, { status: 400 });
  }
  // Optional uploads; require either a vision description or at least one image
  // so we have *something* to design from.
  if (!body.vision && !(body.inspirationImages?.length)) {
    return NextResponse.json(
      { error: "Add a description of your vision, or upload at least one inspiration image." },
      { status: 400 },
    );
  }

  try {
    const { reference, statusToken, manageToken } = await createDesignRequest({
      teamName: body.teamName,
      sport: body.sport,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      vision: body.vision,
      colors: body.colors,
      notes: body.notes,
      inspirationImages: body.inspirationImages ?? [],
    });

    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const statusUrl = `${SITE}/design/status/${statusToken}`;
    const manageUrl = `${SITE}/design/manage/${manageToken}`;

    // Notify designer (Discord thread + email) and confirm to the client.
    // Don't fail the user if either side isn't configured yet.
    await Promise.allSettled([
      postDesignRequestToDiscord({
        reference,
        teamName: body.teamName,
        sport: body.sport,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        vision: body.vision,
        colors: body.colors,
        inspirationImages: body.inspirationImages ?? [],
        manageUrl,
      }),
      emailDesignRequestToDesigner({
        reference,
        teamName: body.teamName,
        sport: body.sport,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        vision: body.vision,
        colors: body.colors,
        inspirationImages: body.inspirationImages ?? [],
        manageUrl,
      }),
      emailDesignRequestConfirmation({
        to: body.contactEmail,
        teamName: body.teamName,
        reference,
        statusUrl,
      }),
    ]);

    return NextResponse.json({ ok: true, reference, statusUrl });
  } catch (e) {
    console.error("createDesignRequest failed:", e);
    return NextResponse.json({ error: "Could not save your design request" }, { status: 500 });
  }
}
