import { NextResponse } from "next/server";
import { healMissingSheets } from "@/lib/design-lab-assets";
import { dbEnabled } from "@/db";
import {
  findProofFollowUpCandidates,
  recordFollowUp,
  MAX_FOLLOW_UPS,
  findInvoiceReminderCandidates,
  recordInvoiceReminder,
  MAX_INVOICE_REMINDERS,
  findStaleDesigns,
  recordDesignerReminder,
  findAiLeadFollowUpCandidates,
  recordAiLeadFollowUp,
  findReviewRequestCandidates,
  recordReviewRequest,
} from "@/lib/follow-ups";
import { emailProofFollowUp, emailInvoiceReminder } from "@/lib/email";
import { sendFollowUpSms } from "@/lib/sms";
import { postDesignThreadUpdate } from "@/lib/discord";
import { getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { and, eq, isNull, isNotNull, or, lt } from "drizzle-orm";
import { getLiveTracking } from "@/lib/shippo";
import { getById as getDesignById } from "@/lib/design-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily Vercel Cron (see vercel.json). Sends up to MAX_FOLLOW_UPS reminder
// emails to clients who haven't reviewed a sent proof. ?dryRun=1 lists who
// WOULD be nudged without sending anything.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const candidates = await findProofFollowUpCandidates();
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

  const results: { reference: string; team: string; round: number; sent?: boolean }[] = [];
  for (const c of candidates) {
    const round = c.followUpsSent + 1;
    if (dryRun) {
      results.push({ reference: c.reference, team: c.teamName, round });
      continue;
    }
    try {
      const sent = await emailProofFollowUp({
        to: c.contactEmail,
        teamName: c.teamName,
        reference: c.reference,
        statusUrl: `${SITE}/design/status/${c.statusToken}`,
        round,
        neededBy: c.neededBy,
      });
      if (sent) {
        await recordFollowUp(c.id);
        await sendFollowUpSms({
          phone: c.contactPhone,
          body: `Slugger Athletics: your ${c.teamName} design proof is waiting for review. Approve or request changes here: ${SITE}/design/status/${c.statusToken}\nReply STOP to opt out.`,
        });
        await postDesignThreadUpdate({
          threadId: c.discordThreadId ?? undefined,
          title: `⏰ Auto follow-up ${round}/${MAX_FOLLOW_UPS} emailed - ${c.teamName} (${c.reference})`,
          description: `Client hasn't reviewed the proof sent ${c.proofSentAt.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}. Reminder email sent automatically.`,
          username: "Slugger Design Requests",
        });
      }
      results.push({ reference: c.reference, team: c.teamName, round, sent });
    } catch (e) {
      console.error(`Follow-up failed for ${c.reference}:`, e);
      results.push({ reference: c.reference, team: c.teamName, round, sent: false });
    }
  }

  // Unpaid invoice reminders (deposit or balance on team orders).
  const invoiceCandidates = await findInvoiceReminderCandidates();
  const invoiceResults: { reference: string; team: string; stage: string; round: number; sent?: boolean }[] = [];
  for (const c of invoiceCandidates) {
    const round = c.remindersSent + 1;
    if (dryRun) {
      invoiceResults.push({ reference: c.reference, team: c.teamName, stage: c.stage, round });
      continue;
    }
    try {
      const sent = await emailInvoiceReminder({
        to: c.contactEmail,
        teamName: c.teamName,
        reference: c.reference,
        stage: c.stage,
        dueCents: c.dueCents,
        payUrl: c.payUrl,
        isFinal: round >= MAX_INVOICE_REMINDERS,
      });
      if (sent) {
        await recordInvoiceReminder(c.id);
        await sendFollowUpSms({
          phone: c.contactPhone,
          body: `Slugger Athletics reminder: the ${c.stage === "deposit" ? "50% deposit" : "final balance"} for ${c.teamName} (${c.reference}) is still unpaid. Pay here: ${c.payUrl}\nReply STOP to opt out.`,
        });
      }
      invoiceResults.push({ reference: c.reference, team: c.teamName, stage: c.stage, round, sent });
    } catch (e) {
      console.error(`Invoice reminder failed for ${c.reference}:`, e);
      invoiceResults.push({ reference: c.reference, team: c.teamName, stage: c.stage, round, sent: false });
    }
  }

  // Designer SLA: designs sitting >24h with no first proof sent get an @here
  // ping in their Discord thread so the designer picks them up.
  const stale = await findStaleDesigns();
  const staleResults: { reference: string; team: string; hours: number; pinged?: boolean }[] = [];
  for (const d of stale) {
    if (dryRun) {
      staleResults.push({ reference: d.reference, team: d.teamName, hours: d.waitingHours });
      continue;
    }
    const deadline =
      d.neededBy && !isNaN(d.neededBy.getTime())
        ? d.neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })
        : null;
    const pinged = await postDesignThreadUpdate({
      threadId: d.discordThreadId ?? undefined,
      title: `⏰ Needs a first proof - ${d.teamName} (${d.reference})`,
      description: [
        `This design has been waiting **${d.waitingHours}h** with no proof sent to the client yet.`,
        deadline ? `Needed by **${deadline}**.` : "",
        "Send a first draft, or reply here if it's blocked.",
      ]
        .filter(Boolean)
        .join("\n"),
      mention: true,
      username: "Slugger Design SLA",
    });
    if (pinged) await recordDesignerReminder(d.id);
    staleResults.push({ reference: d.reference, team: d.teamName, hours: d.waitingHours, pinged });
  }

  // Stalled inbound shipments (factory -> shop): the designer created a
  // label that the carrier never received (48h+), or the package hasn't
  // scanned in 4+ days. Nudges the design thread, at most every 48h.
  const NUDGE_COOLDOWN_MS = 48 * 60 * 60 * 1000;
  const LABEL_STALL_MS = 48 * 60 * 60 * 1000;
  const TRANSIT_STALL_MS = 4 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const db = getDb();
  const tracked = await db
    .select()
    .from(teamOrders)
    .where(
      and(
        isNotNull(teamOrders.inboundTrackingNumber),
        isNull(teamOrders.archivedAt),
        or(isNull(teamOrders.inboundNudgedAt), lt(teamOrders.inboundNudgedAt, new Date(now - NUDGE_COOLDOWN_MS))),
      ),
    );
  const inboundResults: { reference: string; team: string; status: string; nudged?: boolean }[] = [];
  for (const o of tracked) {
    try {
      const live = await getLiveTracking(o.inboundCarrier, o.inboundTrackingNumber!);
      if (!live || live.status === "Delivered") continue;
      const addedAge = o.inboundTrackingAddedAt ? now - +o.inboundTrackingAddedAt : 0;
      const scanAge = live.at ? now - +new Date(live.at) : null;
      const labelStalled = live.status === "Label created" && addedAge > LABEL_STALL_MS;
      const transitStalled = live.status === "In transit" && scanAge !== null && scanAge > TRANSIT_STALL_MS;
      if (!labelStalled && !transitStalled) continue;
      if (dryRun) {
        inboundResults.push({ reference: o.reference, team: o.teamName, status: live.status });
        continue;
      }
      const design = o.designRequestId ? await getDesignById(o.designRequestId) : null;
      const days = Math.floor((labelStalled ? addedAge : scanAge!) / 86400000);
      const nudged = await postDesignThreadUpdate({
        threadId: design?.discordThreadId,
        title: `🚨 Inbound shipment not moving - ${o.teamName} (${o.reference})`,
        description: labelStalled
          ? `The ${o.inboundCarrier ?? ""} label for this order was created **${days} day${days === 1 ? "" : "s"} ago** but the carrier still has NOT received the package. Please drop it off or reply here with what's holding it up.`
          : `This ${o.inboundCarrier ?? ""} shipment has had **no new scan in ${days} days**. Please check with the carrier and reply here with an update.`,
        mention: true,
        username: "Slugger Shipping Watch",
      });
      if (nudged) {
        await db.update(teamOrders).set({ inboundNudgedAt: new Date() }).where(eq(teamOrders.id, o.id));
      }
      inboundResults.push({ reference: o.reference, team: o.teamName, status: live.status, nudged });
    } catch (e) {
      console.error(`Inbound stall check failed for ${o.reference}:`, e);
    }
  }

  // ── AI Jersey Maker leads: "can we help?" re-engagement texts ──────────
  const aiLeads = await findAiLeadFollowUpCandidates();
  const aiLeadResults: { name: string; round: number; sent?: boolean }[] = [];
  for (const lead of aiLeads) {
    const name = lead.firstName?.trim() || "there";
    if (dryRun) {
      aiLeadResults.push({ name, round: lead.round });
      continue;
    }
    const body =
      lead.round === 1
        ? `Hi ${name}, it's Slugger Athletics 🐆 We saw you were creating a jersey design with our Jersey Maker - want a hand finishing it or a quick quote for your team? Just reply here and we'll take care of you. No minimums.\nReply STOP to opt out.`
        : `Hi ${name}, following up from Slugger Athletics - still happy to turn that jersey design into real uniforms whenever you're ready. Reply here anytime and we'll help.\nReply STOP to opt out.`;
    let sent = false;
    try {
      sent = await sendFollowUpSms({ phone: lead.phone, body });
      if (sent) await recordAiLeadFollowUp(lead.id);
    } catch (e) {
      console.error("AI lead follow-up failed:", e);
    }
    aiLeadResults.push({ name, round: lead.round, sent });
  }

  // ── Post-delivery review requests (a few days after shipping) ──────────
  const reviewUrl = process.env.REVIEW_URL;
  const reviewCandidates = await findReviewRequestCandidates();
  const reviewResults: { reference: string; team: string; sent?: boolean }[] = [];
  for (const c of reviewCandidates) {
    if (dryRun) {
      reviewResults.push({ reference: c.reference, team: c.teamName });
      continue;
    }
    const first = (c.contactName || "").trim().split(/\s+/)[0] || "there";
    const body = `Hi ${first}, it's Slugger Athletics 🐆 Hope your ${c.teamName} gear turned out great! A quick review really helps our small shop - it'd mean a lot: ${reviewUrl}\nReply STOP to opt out.`;
    let sent = false;
    try {
      sent = await sendFollowUpSms({ phone: c.phone, body });
      if (sent) await recordReviewRequest(c.id);
    } catch (e) {
      console.error("review request failed:", e);
    }
    reviewResults.push({ reference: c.reference, team: c.teamName, sent });
  }

  // ── 5. Heal AI-lab submissions whose asset sheets failed to extract ────
  let healedSheets: { reference: string; added: string[] }[] = [];
  if (!dryRun) {
    try { healedSheets = await healMissingSheets(2); } catch (e) { console.error("sheet healing failed:", e); }
  }

  return NextResponse.json({
    dryRun,
    count: results.length + invoiceResults.length + staleResults.length + inboundResults.length + aiLeadResults.length + healedSheets.length,
    results,
    invoiceReminders: invoiceResults,
    designerReminders: staleResults,
    inboundStalls: inboundResults,
    aiLeadFollowUps: aiLeadResults,
    reviewRequests: reviewResults,
    healedSheets,
  });
}
