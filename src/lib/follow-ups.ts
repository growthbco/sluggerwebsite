// Automated proof follow-ups. A design qualifies when a proof was sent, the
// client has gone quiet (no approval, no change request, no message since the
// proof), and we haven't exhausted the reminder cap.

import { eq, ne, and, isNull, isNotNull, lt, gt, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests, teamOrders, designLabVisitors, smsMessages, orders } from "@/db/schema";
import { toE164 } from "@/lib/sms";

// Daily proof follow-ups: once a design is sent and the client goes quiet, we
// text them every day until they act or we hit the cap. Env-overridable so the
// cadence can be tuned without a deploy.
export const MAX_FOLLOW_UPS = Number(process.env.PROOF_FOLLOWUP_MAX) || 10;
const FIRST_AFTER_DAYS = 1; // proof sent -> first nudge (next day)
const NEXT_AFTER_DAYS = 1; // then once every day after
const STALE_AFTER_DAYS = 60; // too old to auto-nudge; needs a human

const DAY_MS = 24 * 60 * 60 * 1000;

export type FollowUpCandidate = {
  id: string;
  reference: string;
  teamName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  smsOptInAt: Date | null;
  statusToken: string | null;
  discordThreadId: string | null;
  followUpsSent: number;
  proofSentAt: Date;
  neededBy: Date | null;
};

export async function findProofFollowUpCandidates(now = new Date()): Promise<FollowUpCandidate[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(designRequests)
    .where(eq(designRequests.status, "proof_sent"));

  const due: FollowUpCandidate[] = [];
  for (const r of rows) {
    if (r.archivedAt) continue; // archived = deliberately parked, no robots
    if (!r.proofSentAt || !r.contactEmail) continue;
    const sent = r.followUpsSent ?? 0;
    if (sent >= MAX_FOLLOW_UPS) continue;

    const ageDays = (now.getTime() - r.proofSentAt.getTime()) / DAY_MS;
    if (ageDays > STALE_AFTER_DAYS) continue;

    // If the thread ends on an unanswered client message, a human should
    // answer it - no robot nudges. But once we've replied (staff or the AI
    // assistant) and the client goes quiet AGAIN, follow-ups resume, timed
    // from their last activity. (The old rule - any client message after the
    // proof disables nudges forever - silently killed all follow-ups once the
    // AI chat launched, because nearly every client now sends messages.)
    const msgs = r.messages ?? [];
    const base = sent === 0 ? r.proofSentAt : r.lastFollowUpAt ?? r.proofSentAt;
    const lastMsg = msgs[msgs.length - 1];
    // Stand down ONLY if the client's last message is unanswered AND arrived
    // AFTER our last touch (the proof, or our last nudge) - that's a real
    // question a human should answer. A happy pre-proof comment ("sounds
    // great!") must NOT freeze the nudges forever (that's what stranded Dona
    // Lemoine / DR-V3FQOW with zero follow-ups since Aug 16).
    if (lastMsg && lastMsg.from === "client" && new Date(lastMsg.at) > base) continue;
    const lastClientMsg = [...msgs].reverse().find((m) => m.from === "client");

    const clientAt = lastClientMsg ? new Date(lastClientMsg.at) : null;
    const since = clientAt && clientAt > base ? clientAt : base;
    const waitDays = sent === 0 ? FIRST_AFTER_DAYS : NEXT_AFTER_DAYS;
    if (now.getTime() - since.getTime() < waitDays * DAY_MS) continue;

    due.push({
      id: r.id,
      reference: r.reference,
      teamName: r.teamName,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      contactPhone: r.contactPhone,
      smsOptInAt: r.smsOptInAt,
      statusToken: r.statusToken,
      discordThreadId: r.discordThreadId,
      followUpsSent: sent,
      proofSentAt: r.proofSentAt,
      neededBy: r.neededBy,
    });
  }
  return due;
}

/* ------------------------------------------------------------------ */
/* Unpaid invoice reminders (team orders)                              */
/* ------------------------------------------------------------------ */

export const MAX_INVOICE_REMINDERS = 2;
const INVOICE_FIRST_AFTER_DAYS = 3;
const INVOICE_NEXT_AFTER_DAYS = 4;

export type InvoiceReminderCandidate = {
  id: string;
  reference: string;
  teamName: string;
  contactEmail: string;
  stage: "deposit" | "balance";
  contactPhone: string | null;
  smsOptInAt: Date | null;
  payUrl: string;
  dueCents: number;
  remindersSent: number;
};

/** Team orders with an outstanding deposit or balance invoice that's gone
 *  quiet. Archived orders are skipped - they're deliberately parked. */
export async function findInvoiceReminderCandidates(now = new Date()): Promise<InvoiceReminderCandidate[]> {
  const db = getDb();
  const rows = await db.select().from(teamOrders);

  const due: InvoiceReminderCandidate[] = [];
  for (const o of rows) {
    if (o.archivedAt || o.invoicePaidAt) continue;
    const sent = o.invoiceRemindersSent ?? 0;
    if (sent >= MAX_INVOICE_REMINDERS) continue;

    // Which invoice is outstanding?
    let stage: "deposit" | "balance" | null = null;
    let payUrl: string | null = null;
    if (o.balanceInvoiceUrl && o.depositPaidAt) {
      stage = "balance";
      payUrl = o.balanceInvoiceUrl;
    } else if (o.invoiceUrl && !o.depositPaidAt) {
      stage = "deposit";
      payUrl = o.invoiceUrl;
    }
    if (!stage || !payUrl || !o.contactEmail) continue;

    const total = o.quotedTotalCents ?? 0;
    const deposit = o.depositCents ?? Math.round(total / 2);
    const dueGoods = stage === "deposit" ? deposit : total - deposit;
    if (dueGoods <= 0) continue;
    const dueCents = dueGoods + Math.round(dueGoods * 0.07); // + 7% FL tax

    const since = o.lastInvoiceReminderAt ?? o.updatedAt;
    const waitDays = sent === 0 ? INVOICE_FIRST_AFTER_DAYS : INVOICE_NEXT_AFTER_DAYS;
    if (!since || now.getTime() - since.getTime() < waitDays * DAY_MS) continue;

    due.push({
      id: o.id,
      reference: o.reference,
      teamName: o.teamName,
      contactEmail: o.contactEmail,
      stage,
      contactPhone: o.contactPhone,
      smsOptInAt: o.smsOptInAt,
      payUrl,
      dueCents,
      remindersSent: sent,
    });
  }
  return due;
}

export async function recordInvoiceReminder(id: string, now = new Date()) {
  const db = getDb();
  const [row] = await db
    .select({ sent: teamOrders.invoiceRemindersSent })
    .from(teamOrders)
    .where(eq(teamOrders.id, id))
    .limit(1);
  await db
    .update(teamOrders)
    .set({ invoiceRemindersSent: (row?.sent ?? 0) + 1, lastInvoiceReminderAt: now })
    .where(eq(teamOrders.id, id));
}

/* ------------------------------------------------------------------ */
/* Designer SLA: no first proof sent within 24h                        */
/* ------------------------------------------------------------------ */

const DESIGN_SLA_HOURS = 24;
const REMIND_EVERY_HOURS = 20; // don't re-ping more often than this

export type StaleDesign = {
  id: string;
  reference: string;
  teamName: string;
  discordThreadId: string | null;
  neededBy: Date | null;
  waitingHours: number;
};

/** Designs sitting with no first proof sent past the SLA - ping the designer. */
export async function findStaleDesigns(now = new Date()): Promise<StaleDesign[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(designRequests)
    .where(eq(designRequests.status, "submitted")); // ready-to-design queue

  const inDesign = await db.select().from(designRequests).where(eq(designRequests.status, "in_design"));

  const due: StaleDesign[] = [];
  for (const r of [...rows, ...inDesign]) {
    if (r.archivedAt || r.proofSentAt) continue;
    // Clock starts when it entered the design queue (fee paid or waived).
    const start = r.designFeePaidAt ?? r.createdAt;
    const waitingHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (waitingHours < DESIGN_SLA_HOURS) continue;
    if (r.designerRemindedAt && (now.getTime() - r.designerRemindedAt.getTime()) / (1000 * 60 * 60) < REMIND_EVERY_HOURS) {
      continue;
    }
    due.push({
      id: r.id,
      reference: r.reference,
      teamName: r.teamName,
      discordThreadId: r.discordThreadId,
      neededBy: r.neededBy,
      waitingHours: Math.round(waitingHours),
    });
  }
  return due;
}

export async function recordDesignerReminder(id: string, now = new Date()) {
  const db = getDb();
  await db.update(designRequests).set({ designerRemindedAt: now }).where(eq(designRequests.id, id));
}

export async function recordFollowUp(id: string, now = new Date()) {
  const db = getDb();
  const [row] = await db
    .select({ followUpsSent: designRequests.followUpsSent })
    .from(designRequests)
    .where(eq(designRequests.id, id))
    .limit(1);
  await db
    .update(designRequests)
    .set({ followUpsSent: (row?.followUpsSent ?? 0) + 1, lastFollowUpAt: now })
    .where(eq(designRequests.id, id));
}

/* ── AI Jersey Maker lead follow-ups ────────────────────────────────
 * Someone used the AI design tool, gave a phone to unlock their design, but
 * never ordered. A gentle 2-step "can we help?" text (day ~1, then day ~4 if
 * they never replied). Skips leads who already became a real design request. */
export const MAX_AI_LEAD_FOLLOW_UPS = 3;
const AI_FIRST_AFTER_HOURS = 20;
const AI_NEXT_AFTER_DAYS = 3; // round 2: a few days after round 1
const AI_THIRD_AFTER_DAYS = 14; // round 3: two weeks after round 2, spaced out
const AI_STALE_AFTER_DAYS = 45; // older than this: the seasonal track takes over

export type AiLeadCandidate = {
  id: string;
  firstName: string | null;
  phone: string;
  round: number; // 1, 2, or 3
};

export async function findAiLeadFollowUpCandidates(now = new Date()): Promise<AiLeadCandidate[]> {
  const db = getDb();
  const visitors = await db.select().from(designLabVisitors);
  // Emails that already turned into a real design request = converted, skip.
  const drRows = await db.select({ email: designRequests.contactEmail }).from(designRequests);
  const converted = new Set(drRows.map((r) => (r.email ?? "").trim().toLowerCase()).filter(Boolean));

  const out: AiLeadCandidate[] = [];
  for (const v of visitors) {
    if (v.paidAt) continue; // already paid/converted in the lab
    if ((v.generations ?? 0) < 1) continue; // never actually designed
    const phone = toE164(v.phone);
    if (!phone) continue;
    if ((v.smsFollowUpsSent ?? 0) >= MAX_AI_LEAD_FOLLOW_UPS) continue;
    if (v.email && converted.has(v.email.trim().toLowerCase())) continue;
    const ageDays = (now.getTime() - +v.createdAt) / DAY_MS;
    if (ageDays > AI_STALE_AFTER_DAYS) continue;

    const sent = v.smsFollowUpsSent ?? 0;
    if (sent === 0) {
      if (now.getTime() - +v.createdAt < AI_FIRST_AFTER_HOURS * 60 * 60 * 1000) continue;
      out.push({ id: v.id, firstName: v.firstName, phone, round: 1 });
    } else {
      // Rounds 2 & 3: space them out (3 days, then 14), and skip if they've
      // replied since the last one (a human is now handling that conversation).
      const waitDays = sent === 1 ? AI_NEXT_AFTER_DAYS : AI_THIRD_AFTER_DAYS;
      if (!v.lastFollowUpAt || now.getTime() - +v.lastFollowUpAt < waitDays * DAY_MS) continue;
      const msgs = await db.select({ direction: smsMessages.direction, createdAt: smsMessages.createdAt }).from(smsMessages).where(eq(smsMessages.phone, phone));
      const repliedSince = msgs.some((m) => m.direction === "in" && +m.createdAt > +v.lastFollowUpAt!);
      if (repliedSince) continue;
      out.push({ id: v.id, firstName: v.firstName, phone, round: sent + 1 });
    }
  }
  return out;
}

/* ── Post-delivery review requests ──────────────────────────────────
 * A few days after a team order ships (enough time to arrive and be worn),
 * text the coach a friendly "how'd it turn out? mind leaving a review?" with
 * our review link. Once per order, and only if REVIEW_URL is configured. */
// The review ask waits until the package is actually Delivered (live carrier
// status). We start looking 2 days out (nothing arrives faster), stop cold-
// asking after 30 days, and if tracking never reports Delivered we send anyway
// at the fallback age so a missed scan doesn't cost us the review.
const REVIEW_AFTER_DAYS = 2;
const REVIEW_MAX_DAYS = 30;
export const REVIEW_FALLBACK_DAYS = 12;

export type ReviewCandidate = {
  id: string;
  reference: string;
  teamName: string;
  contactName: string;
  phone: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
};

export async function findReviewRequestCandidates(now = new Date()): Promise<ReviewCandidate[]> {
  if (!process.env.REVIEW_URL) return [];
  const db = getDb();
  const cutoff = new Date(now.getTime() - REVIEW_AFTER_DAYS * DAY_MS);
  const floor = new Date(now.getTime() - REVIEW_MAX_DAYS * DAY_MS);
  const rows = await db
    .select()
    .from(teamOrders)
    .where(
      and(
        // Keyed off shippedAt, NOT status - an order can ship while still
        // marked "paid" (paid in full) or "in_production", and those still
        // deserve a review. Only a cancelled order is excluded.
        ne(teamOrders.status, "cancelled"),
        isNull(teamOrders.reviewRequestedAt),
        isNotNull(teamOrders.shippedAt),
        lt(teamOrders.shippedAt, cutoff),
        gt(teamOrders.shippedAt, floor),
      ),
    );
  return rows
    .map((o) => ({ id: o.id, reference: o.reference, teamName: o.teamName, contactName: o.contactName, phone: o.contactPhone ?? "", carrier: o.shipCarrier, trackingNumber: o.trackingNumber, shippedAt: o.shippedAt }))
    .filter((o) => o.phone.trim());
}

export async function recordReviewRequest(id: string, now = new Date()) {
  const db = getDb();
  await db.update(teamOrders).set({ reviewRequestedAt: now }).where(eq(teamOrders.id, id));
}

/** Same post-delivery review ask, for store/shop orders (buyer phone captured
 *  by Stripe at checkout). Fulfilled = shipped for these. */
export async function findOrderReviewCandidates(now = new Date()): Promise<ReviewCandidate[]> {
  if (!process.env.REVIEW_URL) return [];
  const db = getDb();
  const cutoff = new Date(now.getTime() - REVIEW_AFTER_DAYS * DAY_MS);
  const floor = new Date(now.getTime() - REVIEW_MAX_DAYS * DAY_MS);
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        // Shipped is the real signal (a store order can ship while still
        // "paid"); only cancelled/refunded are excluded.
        notInArray(orders.status, ["cancelled", "refunded"]),
        isNull(orders.reviewRequestedAt),
        isNotNull(orders.shippedAt),
        lt(orders.shippedAt, cutoff),
        gt(orders.shippedAt, floor),
      ),
    );
  return rows
    .map((o) => ({ id: o.id, reference: o.reference, teamName: "", contactName: o.customerName ?? "", phone: o.customerPhone ?? "", carrier: o.shipCarrier, trackingNumber: o.trackingNumber, shippedAt: o.shippedAt }))
    .filter((o) => o.phone.trim());
}

export async function recordOrderReviewRequest(id: string, now = new Date()) {
  const db = getDb();
  await db.update(orders).set({ reviewRequestedAt: now }).where(eq(orders.id, id));
}

/* ── Referral prompt (a week after delivery) ────────────────────────
 * Text a happy coach their referral link so they can refer another team -
 * both sides earn a free crew-neck jersey. Once per order. */
const REFERRAL_AFTER_DAYS = 8;
const REFERRAL_MAX_DAYS = 40;

export type ReferralCandidate = { id: string; reference: string; teamName: string; contactName: string; contactEmail: string; phone: string };

export async function findReferralPromptCandidates(now = new Date()): Promise<ReferralCandidate[]> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - REFERRAL_AFTER_DAYS * DAY_MS);
  const floor = new Date(now.getTime() - REFERRAL_MAX_DAYS * DAY_MS);
  const rows = await db
    .select()
    .from(teamOrders)
    .where(
      and(
        eq(teamOrders.status, "shipped"),
        isNull(teamOrders.referralPromptedAt),
        isNotNull(teamOrders.shippedAt),
        lt(teamOrders.shippedAt, cutoff),
        gt(teamOrders.shippedAt, floor),
      ),
    );
  return rows
    .map((o) => ({ id: o.id, reference: o.reference, teamName: o.teamName, contactName: o.contactName, contactEmail: o.contactEmail, phone: o.contactPhone ?? "" }))
    .filter((o) => o.phone.trim() && o.contactEmail.trim());
}

export async function recordReferralPrompt(id: string, now = new Date()) {
  const db = getDb();
  await db.update(teamOrders).set({ referralPromptedAt: now }).where(eq(teamOrders.id, id));
}

/* ── Next-season reorder win-back (~a year later) ───────────────────
 * Long buying cycles: text last season's teams before this season so they
 * reorder. Their design is on file, so it's an easy yes. Once per order. */
const REORDER_MIN_DAYS = 300;
const REORDER_MAX_DAYS = 400;

export type ReorderCandidate = { id: string; reference: string; teamName: string; contactName: string; phone: string };

export async function findReorderCandidates(now = new Date()): Promise<ReorderCandidate[]> {
  const db = getDb();
  const olderThan = new Date(now.getTime() - REORDER_MIN_DAYS * DAY_MS);
  const notBefore = new Date(now.getTime() - REORDER_MAX_DAYS * DAY_MS);
  const rows = await db
    .select()
    .from(teamOrders)
    .where(
      and(
        isNull(teamOrders.reorderPromptedAt),
        isNull(teamOrders.archivedAt),
        isNotNull(teamOrders.shippedAt),
        lt(teamOrders.shippedAt, olderThan),
        gt(teamOrders.shippedAt, notBefore),
      ),
    );
  return rows
    .map((o) => ({ id: o.id, reference: o.reference, teamName: o.teamName, contactName: o.contactName, phone: o.contactPhone ?? "" }))
    .filter((o) => o.phone.trim());
}

export async function recordReorderPrompt(id: string, now = new Date()) {
  const db = getDb();
  await db.update(teamOrders).set({ reorderPromptedAt: now }).where(eq(teamOrders.id, id));
}

export async function recordAiLeadFollowUp(id: string, now = new Date()) {
  const db = getDb();
  const [row] = await db.select({ n: designLabVisitors.smsFollowUpsSent }).from(designLabVisitors).where(eq(designLabVisitors.id, id)).limit(1);
  await db
    .update(designLabVisitors)
    .set({ smsFollowUpsSent: (row?.n ?? 0) + 1, lastFollowUpAt: now })
    .where(eq(designLabVisitors.id, id));
}

/* ── Season-aware re-engagement ─────────────────────────────────────
 *
 * Cold leads (used the AI lab, gave a phone, never ordered) get one nudge
 * ahead of each busy ordering season, when teams are actually forming and
 * gearing up. Florida-tuned windows (baseball/softball skew earlier and warmer
 * here): teams order ~4-6 weeks before the season, so the SELL window is:
 *   - Spring baseball/softball: Nov 1 - Jan 31
 *   - Fall ball:                Jun 15 - Aug 15
 * Capped once per window (cooldown) so a lead hears from us each new season
 * without being spammed. Complements the ~1-year reorder win-back for past
 * customers - this targets the interested-but-never-bought pool. */
export type SeasonCampaign = { key: string; label: string };
const SEASONAL_MIN_AGE_DAYS = 45; // past the regular AI-lead cadence
const SEASONAL_MAX_AGE_DAYS = 550; // ~18 months; older leads are truly cold
const SEASONAL_COOLDOWN_DAYS = 120; // at most one seasonal ping per ~4-month window

export function currentSeasonCampaign(now = new Date()): SeasonCampaign | null {
  const [mm, dd] = now
    .toLocaleDateString("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit" })
    .split("/")
    .map(Number);
  const mmdd = mm * 100 + dd;
  if (mmdd >= 1101 || mmdd <= 131) return { key: "spring", label: "Spring baseball and softball" };
  if (mmdd >= 615 && mmdd <= 815) return { key: "fall", label: "Fall ball" };
  return null;
}

export type SeasonalCandidate = { id: string; firstName: string | null; phone: string; campaignLabel: string };

export async function findSeasonalReengagementCandidates(now = new Date()): Promise<SeasonalCandidate[]> {
  const campaign = currentSeasonCampaign(now);
  if (!campaign) return []; // not in a sell window - nothing to send
  const db = getDb();
  const visitors = await db.select().from(designLabVisitors);
  const drRows = await db.select({ email: designRequests.contactEmail }).from(designRequests);
  const converted = new Set(drRows.map((r) => (r.email ?? "").trim().toLowerCase()).filter(Boolean));

  const out: SeasonalCandidate[] = [];
  for (const v of visitors) {
    if (v.paidAt) continue; // already a customer
    if ((v.generations ?? 0) < 1) continue; // never actually designed
    const phone = toE164(v.phone);
    if (!phone) continue;
    if (v.email && converted.has(v.email.trim().toLowerCase())) continue; // became a real design request
    const ageDays = (now.getTime() - +v.createdAt) / DAY_MS;
    if (ageDays < SEASONAL_MIN_AGE_DAYS || ageDays > SEASONAL_MAX_AGE_DAYS) continue;
    if (v.lastSeasonalPromptAt && now.getTime() - +v.lastSeasonalPromptAt < SEASONAL_COOLDOWN_DAYS * DAY_MS) continue;
    out.push({ id: v.id, firstName: v.firstName, phone, campaignLabel: campaign.label });
  }
  return out;
}

export async function recordSeasonalPrompt(id: string, now = new Date()) {
  await getDb().update(designLabVisitors).set({ lastSeasonalPromptAt: now }).where(eq(designLabVisitors.id, id));
}
