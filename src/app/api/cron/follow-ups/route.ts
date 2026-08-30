import { NextResponse } from "next/server";
import { healMissingSheets } from "@/lib/design-lab-assets";
import { dbEnabled } from "@/db";
import {
  findProofFollowUpCandidates,
  findProofCloseoutCandidates,
  findInvoiceReminderCandidates,
  recordInvoiceReminder,
  MAX_INVOICE_REMINDERS,
  findStaleDesigns,
  recordDesignerReminder,
  findAiLeadFollowUpCandidates,
  recordAiLeadFollowUp,
  findSeasonalReengagementCandidates,
  recordSeasonalPrompt,
  findReviewRequestCandidates,
  recordReviewRequest,
  findOrderReviewCandidates,
  recordOrderReviewRequest,
  findReferralPromptCandidates,
  recordReferralPrompt,
  findReorderCandidates,
  recordReorderPrompt,
} from "@/lib/follow-ups";
import { getOrCreateCustomer } from "@/lib/customers";
import { emailInvoiceReminder } from "@/lib/email";
import { sendFollowUpSms, smsIfConsented } from "@/lib/sms";
import { sendProofFollowUp } from "@/lib/proof-follow-up";
import { markDesignUnresponsive } from "@/lib/design-requests";
import { sendTeamOrderInvoice } from "@/lib/team-order-invoicing";
import { postDesignThreadUpdate } from "@/lib/discord";
import { getDb } from "@/db";
import { teamOrders, designRequests } from "@/db/schema";
import { and, eq, ne, isNull, isNotNull, or, lt, sql } from "drizzle-orm";
import { getLiveTracking } from "@/lib/shippo";
import { ensureTeamOrderDiscordThread } from "@/lib/team-orders";
import { syncOutstandingDeliveries } from "@/lib/delivery-recording";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily Vercel Cron (see vercel.json). Sends proof reminders on days 2, 5,
// and 10; day 14 moves still-quiet requests to Unresponsive. ?dryRun=1 lists
// what would happen without sending or archiving anything.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  // Reconcile carrier delivery first so every downstream message uses the
  // actual final-package delivery time.
  const deliveryResults = await syncOutstandingDeliveries({ dryRun });
  const candidates = await findProofFollowUpCandidates();
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;

  const results: { reference: string; team: string; round: number; sent?: boolean }[] = [];
  for (const c of candidates) {
    const round = c.followUpsSent + 1;
    if (dryRun) {
      results.push({ reference: c.reference, team: c.teamName, round });
      continue;
    }
    try {
      const sent = await sendProofFollowUp(c, round);
      results.push({ reference: c.reference, team: c.teamName, round, sent: sent.sent });
    } catch (e) {
      console.error(`Follow-up failed for ${c.reference}:`, e);
      results.push({ reference: c.reference, team: c.teamName, round, sent: false });
    }
  }

  const closeoutCandidates = await findProofCloseoutCandidates();
  const closeoutResults: { reference: string; team: string; archived?: boolean; reason?: string }[] = [];
  for (const candidate of closeoutCandidates) {
    if (dryRun) {
      closeoutResults.push({ reference: candidate.reference, team: candidate.teamName });
      continue;
    }
    try {
      const closed = await markDesignUnresponsive(candidate.id);
      closeoutResults.push({
        reference: candidate.reference,
        team: candidate.teamName,
        archived: closed.ok,
        reason: closed.reason,
      });
    } catch (error) {
      console.error(`Unresponsive closeout failed for ${candidate.reference}:`, error);
      closeoutResults.push({ reference: candidate.reference, team: candidate.teamName, archived: false, reason: "error" });
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

  // Add-on nudge: about a day after a customer pays, text them ONCE with their
  // self-serve link so they can add more jerseys/sizes to the same order (the
  // #1 thing customers ask for). Only paid, opted-in, design-linked orders that
  // haven't shipped yet - and never twice (addonNudgeSentAt). Quiet hours +
  // consent are enforced by smsIfConsented.
  const addonResults: { reference: string; team: string; sent?: boolean }[] = [];
  {
    const adb = getDb();
    const paidAt = sql`coalesce(${teamOrders.depositPaidAt}, ${teamOrders.invoicePaidAt})`;
    const addonCandidates = await adb
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        teamName: teamOrders.teamName,
        contactName: teamOrders.contactName,
        contactPhone: teamOrders.contactPhone,
        smsOptInAt: teamOrders.smsOptInAt,
        statusToken: designRequests.statusToken,
      })
      .from(teamOrders)
      .innerJoin(designRequests, eq(teamOrders.designRequestId, designRequests.id))
      .where(
        and(
          isNull(teamOrders.addonNudgeSentAt),
          isNull(teamOrders.archivedAt),
          isNull(teamOrders.shippedAt),
          ne(teamOrders.status, "cancelled"),
          isNotNull(teamOrders.smsOptInAt),
          isNotNull(teamOrders.contactPhone),
          isNotNull(designRequests.statusToken),
          sql`${paidAt} is not null`,
          sql`${paidAt} < now() - interval '20 hours'`,
          sql`${paidAt} > now() - interval '7 days'`,
        ),
      );
    for (const c of addonCandidates) {
      if (dryRun) { addonResults.push({ reference: c.reference, team: c.teamName }); continue; }
      try {
        const statusUrl = `${SITE}/design/status/${c.statusToken}`;
        const first = (c.contactName || "").trim().split(/\s+/)[0] || "there";
        const body = `Hi ${first}, this is Slugger Athletics. Thanks again for your ${c.teamName} order. If you need to add any more jerseys or sizes, you can add them to the same order here: ${statusUrl}. We can include them in the batch. Reply STOP to opt out.`;
        const sent = await smsIfConsented({ phone: c.contactPhone, optInAt: c.smsOptInAt, body });
        if (sent) await adb.update(teamOrders).set({ addonNudgeSentAt: new Date() }).where(eq(teamOrders.id, c.id));
        addonResults.push({ reference: c.reference, team: c.teamName, sent });
      } catch (e) {
        console.error(`Add-on nudge failed for ${c.reference}:`, e);
        addonResults.push({ reference: c.reference, team: c.teamName, sent: false });
      }
    }
  }

  // Stuck-invoice safety net: an order should auto-invoice the moment its
  // roster is submitted. If that ever fails (e.g. a Stripe hiccup), the order
  // sits in "submitted" with no invoice and nobody notices. Catch any that are
  // more than 2 hours old (so we never race the instant on-submit invoice) and
  // retry - self-healing, with a note to the design thread so staff sees it.
  const stuckInvoiceResults: { reference: string; team: string; sent?: boolean; error?: string }[] = [];
  {
    const sdb = getDb();
    const stuck = await sdb
      .select({ id: teamOrders.id, reference: teamOrders.reference, teamName: teamOrders.teamName })
      .from(teamOrders)
      .where(
        and(
          eq(teamOrders.status, "submitted"),
          isNull(teamOrders.invoiceUrl),
          isNull(teamOrders.depositPaidAt),
          isNull(teamOrders.archivedAt),
          sql`${teamOrders.createdAt} < now() - interval '2 hours'`,
        ),
      );
    for (const o of stuck) {
      if (dryRun) { stuckInvoiceResults.push({ reference: o.reference, team: o.teamName }); continue; }
      try {
        const res = await sendTeamOrderInvoice({ teamOrderId: o.id, stage: "deposit" });
        stuckInvoiceResults.push({ reference: o.reference, team: o.teamName, sent: res.ok, error: res.ok ? undefined : res.error });
        if (res.ok) {
          const threadId = await ensureTeamOrderDiscordThread(o.id);
          await postDesignThreadUpdate({
            threadId: threadId ?? undefined,
            title: `🧾 Safety net: sent the missing deposit invoice - ${o.teamName} (${o.reference})`,
            description: `This order was submitted but never got its auto-invoice. It has now been sent (${money(res.dueCents)} deposit of ${money(res.totalCents)}).`,
            username: "Slugger Design Requests",
          });
        }
      } catch (e) {
        console.error(`Stuck-invoice retry failed for ${o.reference}:`, e);
        stuckInvoiceResults.push({ reference: o.reference, team: o.teamName, sent: false, error: "exception" });
      }
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
      const threadId = await ensureTeamOrderDiscordThread(o.id);
      const days = Math.floor((labelStalled ? addedAge : scanAge!) / 86400000);
      const nudged = await postDesignThreadUpdate({
        threadId: threadId ?? undefined,
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
        : lead.round === 2
          ? `Hi ${name}, following up from Slugger Athletics - still happy to turn that jersey design into real uniforms whenever you're ready. Reply here anytime and we'll help.\nReply STOP to opt out.`
          : `Hi ${name}, last check-in from Slugger Athletics. Your jersey design is still saved with us. Whenever your team is ready, reply here and we'll get you a quote and real uniforms.\nReply STOP to opt out.`;
    let sent = false;
    try {
      sent = await sendFollowUpSms({ phone: lead.phone, body });
      if (sent) await recordAiLeadFollowUp(lead.id);
    } catch (e) {
      console.error("AI lead follow-up failed:", e);
    }
    aiLeadResults.push({ name, round: lead.round, sent });
  }

  // ── Season-aware re-engagement: nudge cold lab leads ahead of a busy ──────
  // ordering season (spring baseball/softball, fall ball). Only fires when
  // we're inside a sell window; once per window per lead.
  const seasonal = await findSeasonalReengagementCandidates();
  const seasonalResults: { name: string; campaign: string; sent?: boolean }[] = [];
  for (const lead of seasonal) {
    const name = lead.firstName?.trim() || "there";
    if (dryRun) {
      seasonalResults.push({ name, campaign: lead.campaignLabel });
      continue;
    }
    const body = `Hi ${name}, it's Slugger Athletics. ${lead.campaignLabel} season is coming up and teams are ordering now. Your custom jersey design is still saved with us, so it's an easy head start. Want a quick quote or a hand getting your team's gear ready? Reply here anytime.\nReply STOP to opt out.`;
    let sent = false;
    try {
      sent = await sendFollowUpSms({ phone: lead.phone, body });
      if (sent) await recordSeasonalPrompt(lead.id);
    } catch (e) {
      console.error("seasonal re-engagement failed:", e);
    }
    seasonalResults.push({ name, campaign: lead.campaignLabel, sent });
  }

  // ── Referral prompt (~a week after delivery): "refer a team, free jersey" ─
  const referralCandidates = await findReferralPromptCandidates();
  const referralResults: { reference: string; team: string; sent?: boolean }[] = [];
  for (const c of referralCandidates) {
    if (dryRun) {
      referralResults.push({ reference: c.reference, team: c.teamName });
      continue;
    }
    let sent = false;
    try {
      const customer = await getOrCreateCustomer(c.contactEmail, { name: c.contactName, phone: c.phone });
      const link = `${SITE}/r/${customer.referralCode}`;
      const first = (c.contactName || "").trim().split(/\s+/)[0] || "there";
      const body = `Hi ${first}, loved your new ${c.teamName} gear? 🐆 Refer another coach or team to Slugger Athletics and you BOTH get a free custom jersey (any style, our treat). Share your link: ${link}\nReply STOP to opt out.`;
      sent = await sendFollowUpSms({ phone: c.phone, body });
      if (sent) await recordReferralPrompt(c.id);
    } catch (e) {
      console.error("referral prompt failed:", e);
    }
    referralResults.push({ reference: c.reference, team: c.teamName, sent });
  }

  // ── Next-season reorder win-back (~a year after the order) ─────────────
  const reorderCandidates = await findReorderCandidates();
  const reorderResults: { reference: string; team: string; sent?: boolean }[] = [];
  for (const c of reorderCandidates) {
    if (dryRun) {
      reorderResults.push({ reference: c.reference, team: c.teamName });
      continue;
    }
    const first = (c.contactName || "").trim().split(/\s+/)[0] || "there";
    const body = `Hi ${first}, new season coming up? 🐆 It's about that time to gear up ${c.teamName} again with Slugger Athletics. We still have your design on file, so reordering is quick and easy - just reply and we'll get you set up.\nReply STOP to opt out.`;
    let sent = false;
    try {
      sent = await sendFollowUpSms({ phone: c.phone, body });
      if (sent) await recordReorderPrompt(c.id);
    } catch (e) {
      console.error("reorder prompt failed:", e);
    }
    reorderResults.push({ reference: c.reference, team: c.teamName, sent });
  }

  // ── Post-delivery review requests (two days after final delivery) ──────
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

  // Same review ask for store/shop buyers (phone from Stripe checkout).
  const orderReviewCandidates = await findOrderReviewCandidates();
  for (const c of orderReviewCandidates) {
    if (dryRun) {
      reviewResults.push({ reference: c.reference, team: "(store buyer)" });
      continue;
    }
    const first = (c.contactName || "").trim().split(/\s+/)[0] || "there";
    const body = `Hi ${first}, it's Slugger Athletics 🐆 Hope your gear turned out great! A quick review really helps our small shop - it'd mean a lot: ${reviewUrl}\nReply STOP to opt out.`;
    let sent = false;
    try {
      sent = await sendFollowUpSms({ phone: c.phone, body });
      if (sent) await recordOrderReviewRequest(c.id);
    } catch (e) {
      console.error("store review request failed:", e);
    }
    reviewResults.push({ reference: c.reference, team: "(store buyer)", sent });
  }

  // ── 5. Heal AI-lab submissions whose asset sheets failed to extract ────
  let healedSheets: { reference: string; added: string[] }[] = [];
  if (!dryRun) {
    try { healedSheets = await healMissingSheets(2); } catch (e) { console.error("sheet healing failed:", e); }
  }

  return NextResponse.json({
    dryRun,
    count: results.length + closeoutResults.length + invoiceResults.length + addonResults.length + stuckInvoiceResults.length + staleResults.length + inboundResults.length + aiLeadResults.length + referralResults.length + reorderResults.length + reviewResults.length + healedSheets.length + deliveryResults.length,
    deliveries: deliveryResults,
    results,
    unresponsiveCloseouts: closeoutResults,
    addonNudges: addonResults,
    stuckInvoices: stuckInvoiceResults,
    invoiceReminders: invoiceResults,
    designerReminders: staleResults,
    inboundStalls: inboundResults,
    aiLeadFollowUps: aiLeadResults,
    seasonalReengagement: seasonalResults,
    reviewRequests: reviewResults,
    referralPrompts: referralResults,
    reorderPrompts: reorderResults,
    healedSheets,
  });
}
