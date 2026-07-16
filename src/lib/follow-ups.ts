// Automated proof follow-ups. A design qualifies when a proof was sent, the
// client has gone quiet (no approval, no change request, no message since the
// proof), and we haven't exhausted the reminder cap.

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests, teamOrders } from "@/db/schema";

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

    // A client message after the proof counts as a reply - a human should
    // answer it, not a robot.
    const lastClientMsg = [...(r.messages ?? [])].reverse().find((m) => m.from === "client");
    if (lastClientMsg && new Date(lastClientMsg.at) > r.proofSentAt) continue;

    const since = sent === 0 ? r.proofSentAt : r.lastFollowUpAt ?? r.proofSentAt;
    const waitDays = sent === 0 ? FIRST_AFTER_DAYS : NEXT_AFTER_DAYS;
    if (now.getTime() - since.getTime() < waitDays * DAY_MS) continue;

    due.push({
      id: r.id,
      reference: r.reference,
      teamName: r.teamName,
      contactEmail: r.contactEmail,
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
