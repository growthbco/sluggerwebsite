// Automated proof follow-ups. A design qualifies when a proof was sent, the
// client has gone quiet (no approval, no change request, no message since the
// proof), and we haven't exhausted the reminder cap.

import { eq, and, isNull, isNotNull, lt, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests, teamOrders, designLabVisitors, smsMessages } from "@/db/schema";
import { toE164 } from "@/lib/sms";

export const MAX_FOLLOW_UPS = 2;
const FIRST_AFTER_DAYS = 2; // proof sent -> first nudge
const NEXT_AFTER_DAYS = 4; // first nudge -> second nudge
const STALE_AFTER_DAYS = 60; // too old to auto-nudge; needs a human

const DAY_MS = 24 * 60 * 60 * 1000;

export type FollowUpCandidate = {
  id: string;
  reference: string;
  teamName: string;
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
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg && lastMsg.from === "client") continue;
    const lastClientMsg = [...msgs].reverse().find((m) => m.from === "client");

    const base = sent === 0 ? r.proofSentAt : r.lastFollowUpAt ?? r.proofSentAt;
    const clientAt = lastClientMsg ? new Date(lastClientMsg.at) : null;
    const since = clientAt && clientAt > base ? clientAt : base;
    const waitDays = sent === 0 ? FIRST_AFTER_DAYS : NEXT_AFTER_DAYS;
    if (now.getTime() - since.getTime() < waitDays * DAY_MS) continue;

    due.push({
      id: r.id,
      reference: r.reference,
      teamName: r.teamName,
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
export const MAX_AI_LEAD_FOLLOW_UPS = 2;
const AI_FIRST_AFTER_HOURS = 20;
const AI_NEXT_AFTER_DAYS = 3;
const AI_STALE_AFTER_DAYS = 30; // older than this: don't cold-text, needs a human

export type AiLeadCandidate = {
  id: string;
  firstName: string | null;
  phone: string;
  round: number; // 1 or 2
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
      // Round 2: wait a few days, and skip if they've replied since round 1
      // (a human is now handling that conversation).
      if (!v.lastFollowUpAt || now.getTime() - +v.lastFollowUpAt < AI_NEXT_AFTER_DAYS * DAY_MS) continue;
      const msgs = await db.select({ direction: smsMessages.direction, createdAt: smsMessages.createdAt }).from(smsMessages).where(eq(smsMessages.phone, phone));
      const repliedSince = msgs.some((m) => m.direction === "in" && +m.createdAt > +v.lastFollowUpAt!);
      if (repliedSince) continue;
      out.push({ id: v.id, firstName: v.firstName, phone, round: 2 });
    }
  }
  return out;
}

/* ── Post-delivery review requests ──────────────────────────────────
 * A few days after a team order ships (enough time to arrive and be worn),
 * text the coach a friendly "how'd it turn out? mind leaving a review?" with
 * our review link. Once per order, and only if REVIEW_URL is configured. */
const REVIEW_AFTER_DAYS = 5;
const REVIEW_MAX_DAYS = 30; // don't cold-ask for a review on a months-old order

export type ReviewCandidate = { id: string; reference: string; teamName: string; contactName: string; phone: string };

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
        eq(teamOrders.status, "shipped"),
        isNull(teamOrders.reviewRequestedAt),
        isNotNull(teamOrders.shippedAt),
        lt(teamOrders.shippedAt, cutoff),
        gt(teamOrders.shippedAt, floor),
      ),
    );
  return rows
    .map((o) => ({ id: o.id, reference: o.reference, teamName: o.teamName, contactName: o.contactName, phone: o.contactPhone ?? "" }))
    .filter((o) => o.phone.trim());
}

export async function recordReviewRequest(id: string, now = new Date()) {
  const db = getDb();
  await db.update(teamOrders).set({ reviewRequestedAt: now }).where(eq(teamOrders.id, id));
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
