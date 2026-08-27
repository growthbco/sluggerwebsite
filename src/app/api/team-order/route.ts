import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { postTeamOrderToDiscord } from "@/lib/discord";
import { setThreadStageTag } from "@/lib/discord-bot";
import { dbEnabled } from "@/db";
import { getByStatusToken, findActiveDesignByEmail, markOrdered, approvedMockupImages } from "@/lib/design-requests";
import { createTeamOrder, addRosterRow, submitTeamOrder, ensureTeamOrderDiscordThread } from "@/lib/team-orders";
import { autoInvoiceOnSubmit } from "@/lib/team-order-invoicing";

export const runtime = "nodejs";

type RosterRow = { name?: string; number?: string; size?: string; sizes?: Record<string, string>; design?: string; notes?: string; quantity?: number };

// Manual-roster team order submission (coach typed/imported the full roster).
// Persists to the DB first - Discord is a notification, not the datastore.
export async function POST(req: Request) {
  let body: {
    teamName?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    smsConsent?: boolean;
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

  // A roster can be prepared before artwork is ready, but it cannot become a
  // real submitted order until an approved mockup is attached. Keep this check
  // server-side so a stale page or direct API call cannot bypass the rule.
  const hasApprovedDesign = Boolean(
    design &&
      (design.status === "approved" || design.status === "ordered") &&
      (design.approvedDesignUrls?.length || design.approvedDesignUrl),
  );
  if (!hasApprovedDesign) {
    return NextResponse.json(
      {
        code: "DESIGN_REQUIRED",
        error: "An approved design is required before you can submit this order. Start or finish your free design first.",
      },
      { status: 409 },
    );
  }

  const items = body.items?.length ? body.items : ["jersey"];

  try {
    // 1. Persist: order + roster rows, then lock it as submitted.
    // ONE roster per open job: a second submission for a design that already has
    // an OPEN, unpaid order (a coach adding themselves, a re-entered failed
    // submit, a single extra jersey) must add to THAT order, not spawn a second
    // job. A NEW order is only correct once the prior job is in production,
    // shipped, or paid - i.e. a genuine new batch. Anything before that
    // (draft/collecting/submitted/quoted, unpaid) reuses the current TO.
    const OPEN_UNPAID = ["draft", "collecting", "submitted", "quoted"];
    const { getByDesignRequestId } = await import("@/lib/team-orders");
    const existing = design ? await getByDesignRequestId(design.id) : null;
    const reuse =
      existing && OPEN_UNPAID.includes(existing.status) && !existing.depositPaidAt && !existing.invoicePaidAt
        ? existing
        : null;
    const created = reuse
      ? { id: reuse.id, reference: reuse.reference, selfEntryToken: reuse.selfEntryToken!, manageToken: reuse.manageToken! }
      : await createTeamOrder({
          teamName,
          contactName,
          contactEmail,
          contactPhone,
          jerseyStyle: body.jerseyStyle,
          jerseyMaterial: body.jerseyMaterial,
          items,
          designRequestId: design?.id,
          discordThreadId: design?.discordThreadId ?? undefined,
          rushShipping: design?.rush ?? false,
          smsOptIn: (body.smsConsent === true && Boolean(contactPhone)) || Boolean(design?.smsOptInAt),
        });
    for (const r of roster.slice(0, 200)) {
      await addRosterRow(
        created.id,
        {
          playerName: r.name,
          playerNumber: r.number,
          size: r.size,
          sizes: r.sizes,
          design: r.design,
          notes: r.notes,
          quantity: r.quantity,
        },
        "coach",
      );
    }
    await submitTeamOrder(created.id);
    // Auto-invoice ONLY when the submitter proved they own this funnel by
    // presenting a valid design token. This endpoint is public and takes an
    // attacker-controlled teamName / email / phone; without the proof, auto-
    // sending a branded invoice email + an SMS from our A2P number to those
    // contacts would be a phishing relay. Tokenless/email-matched submissions
    // wait for a staff click ("Send invoice") instead.
    if (body.designToken && design) {
      if (reuse) {
        // Added pieces to an existing open job: (re)send the deposit invoice so
        // it reflects the FULL roster including the just-added pieces. The
        // on-submit auto-invoice skips an order that already has an invoice link,
        // which would otherwise leave the new pieces unbilled.
        const { sendTeamOrderInvoice } = await import("@/lib/team-order-invoicing");
        waitUntil(sendTeamOrderInvoice({ teamOrderId: created.id, stage: "deposit" }));
      } else {
        waitUntil(autoInvoiceOnSubmit(created.id));
      }
    }
    // First-touch attribution: where this coach originally came from.
    try {
      const { attributionFromCookie } = await import("@/lib/attribution");
      const source = await attributionFromCookie();
      if (source) {
        const { getDb } = await import("@/db");
        const { teamOrders } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        await getDb().update(teamOrders).set({ source }).where(eq(teamOrders.id, created.id));
      }
    } catch (e) { console.error("attribution stamp failed:", e); }
    if (design) {
      try {
        await markOrdered(design.id);
      } catch (e) {
        console.error("markOrdered failed:", e);
      }
    }

    // 2. Notify (never the source of truth). Linked orders post into the
    // design's existing thread so the whole project stays in one place.
    const discordThreadId = await ensureTeamOrderDiscordThread(created.id);
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
        designImages: design ? approvedMockupImages(design) : undefined,
        roster: roster.map((r) => ({
          name: r.name,
          number: r.number,
          size: r.sizes?.jersey ?? r.size,
          sizes: r.sizes,
          design: r.design,
          notes: r.notes,
        })),
        manageUrl: design?.manageToken
          ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com"}/design/manage/${design.manageToken}`
          : `${process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com"}/team-order/manage/${created.manageToken}`,
      },
      { designThreadId: discordThreadId },
    );

    await setThreadStageTag(discordThreadId, "📋 Roster In");

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
      { error: "Could not save your order - please try again or text us at (352) 414-7270." },
      { status: 500 },
    );
  }
}
