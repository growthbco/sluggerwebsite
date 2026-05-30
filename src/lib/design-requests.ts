import { randomUUID } from "node:crypto";
import { eq, and, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests, teamOrders } from "@/db/schema";

// Default design fee (env override: DESIGN_FEE_CENTS). Filters out customers
// who would otherwise shop our designs elsewhere. Credited to the final order.
export const DESIGN_FEE_CENTS = Number(process.env.DESIGN_FEE_CENTS) || 3500;

export type NewDesignRequest = {
  teamName: string;
  sport?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  vision?: string;
  colors?: string;
  notes?: string;
  inspirationImages?: string[];
  /** When the customer needs the uniforms in hand. ISO date string. */
  neededBy?: string;
  /** Fee state — set by the create-request route based on returning-customer
   *  detection. Defaults to "pending_payment" if not provided. */
  feeWaivedReason?: string | null;
  feeWaivedRef?: string | null;
};

const RUSH_DAYS = 14;
export const RUSH_FEE_NOTE = "Anything needed within 2 weeks incurs a rush fee of $5 per item.";

/** Returns true if a deadline date is within the rush window (< 14 days away). */
export function isRush(neededBy?: Date | string | null): boolean {
  if (!neededBy) return false;
  const d = typeof neededBy === "string" ? new Date(neededBy) : neededBy;
  if (isNaN(d.getTime())) return false;
  const days = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days < RUSH_DAYS;
}

function makeRef() {
  return `DR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

const token = () => randomUUID().replace(/-/g, "");

/** Look up a prior order (design or team-order) for this email. Used to
 *  auto-waive the design fee for returning customers — we don't want to
 *  re-charge people we know are going to buy from us. */
export async function findReturningCustomerRef(email: string): Promise<string | null> {
  if (!email) return null;
  const db = getDb();
  const e = email.trim().toLowerCase();

  // 1. Any prior design that reached approved/ordered = proven customer.
  const [prior] = await db
    .select({ reference: designRequests.reference })
    .from(designRequests)
    .where(
      and(
        sql`lower(${designRequests.contactEmail}) = ${e}`,
        or(eq(designRequests.status, "approved"), eq(designRequests.status, "ordered")),
      ),
    )
    .limit(1);
  if (prior) return prior.reference;

  // 2. Any prior team order at all = also a known customer.
  const [priorOrder] = await db
    .select({ reference: teamOrders.reference })
    .from(teamOrders)
    .where(sql`lower(${teamOrders.contactEmail}) = ${e}`)
    .limit(1);
  if (priorOrder) return priorOrder.reference;

  return null;
}

/** Mark the design fee as paid (via Stripe webhook) and flip status to
 *  submitted so the designer pipeline kicks in. */
export async function markDesignFeePaid(
  designRequestId: string,
  paymentId: string,
) {
  const db = getDb();
  await db
    .update(designRequests)
    .set({
      designFeePaidAt: new Date(),
      designFeePaymentId: paymentId,
      status: "submitted",
      updatedAt: new Date(),
    })
    .where(eq(designRequests.id, designRequestId));
}

/** Client submits the intake form -> create a request, mint tokens. */
export async function createDesignRequest(input: NewDesignRequest) {
  const db = getDb();
  const reference = makeRef();
  const statusToken = token();
  const manageToken = token();

  const neededByDate = input.neededBy ? new Date(input.neededBy) : null;
  const rush = isRush(neededByDate);

  // If the fee is waived (returning customer / promo applied server-side),
  // jump straight to 'submitted' so the designer pipeline kicks in. Otherwise
  // hold at 'pending_payment' until Stripe confirms via webhook.
  const waived = Boolean(input.feeWaivedReason);

  const [row] = await db
    .insert(designRequests)
    .values({
      reference,
      status: waived ? "submitted" : "pending_payment",
      teamName: input.teamName,
      sport: input.sport,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      vision: input.vision,
      colors: input.colors,
      notes: input.notes,
      inspirationImages: input.inspirationImages ?? [],
      neededBy: neededByDate && !isNaN(neededByDate.getTime()) ? neededByDate : null,
      rush,
      statusToken,
      manageToken,
      designFeeAmountCents: DESIGN_FEE_CENTS,
      designFeePaidAt: waived ? new Date() : null,
      designFeeWaivedReason: input.feeWaivedReason ?? null,
      designFeeWaivedRef: input.feeWaivedRef ?? null,
    })
    .returning();

  return { id: row.id, reference, statusToken, manageToken, rush, neededBy: row.neededBy, waived };
}

/** Save the Discord thread id of this request's forum post so follow-up
 *  events (change requests, approvals) land in the SAME thread. */
export async function setDiscordThreadId(id: string, threadId: string) {
  const db = getDb();
  await db
    .update(designRequests)
    .set({ discordThreadId: threadId, updatedAt: new Date() })
    .where(eq(designRequests.id, id));
}

export async function getByStatusToken(tkn: string) {
  const db = getDb();
  const [row] = await db.select().from(designRequests).where(eq(designRequests.statusToken, tkn)).limit(1);
  return row ?? null;
}

export async function getByManageToken(tkn: string) {
  const db = getDb();
  const [row] = await db.select().from(designRequests).where(eq(designRequests.manageToken, tkn)).limit(1);
  return row ?? null;
}

export async function getById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  return row ?? null;
}

/** Designer uploads proof image(s); auto-bumps status to proof_sent. */
export async function addProofImages(id: string, urls: string[]) {
  const db = getDb();
  const [existing] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  if (!existing) return null;
  const merged = [...(existing.proofImages ?? []), ...urls];
  const now = new Date();
  await db
    .update(designRequests)
    .set({ proofImages: merged, status: "proof_sent", proofSentAt: now, updatedAt: now })
    .where(eq(designRequests.id, id));
  return merged;
}

/** Client approves the proof (optionally with a chosen image url). */
export async function approveDesign(id: string, approvedUrl?: string) {
  const db = getDb();
  const now = new Date();
  await db
    .update(designRequests)
    .set({
      status: "approved",
      approvedAt: now,
      approvedDesignUrl: approvedUrl ?? null,
      updatedAt: now,
    })
    .where(eq(designRequests.id, id));
}

/** Max free revision rounds a client gets before the Request Changes
 *  button locks. Cap exists to keep designs from spiraling. */
export const MAX_REVISIONS = 3;

export type Annotation = { n: number; x: number; y: number; note: string };
export type ChangeRequestEntry = {
  at: string;
  proofImageUrl?: string;
  generalNote?: string;
  annotations?: Annotation[];
};

/** Client requests changes; loops back to designer.
 *  Stores a structured entry (annotations + general note) in changeRequests
 *  history, increments the revision counter, and flips status. Refuses if cap
 *  is already reached. */
export async function requestChanges(
  id: string,
  payload: { generalNote?: string; proofImageUrl?: string; annotations?: Annotation[] } = {},
): Promise<{ ok: true; used: number; max: number } | { ok: false; reason: "max_reached"; used: number; max: number }> {
  const db = getDb();
  const [existing] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  if (!existing) return { ok: false, reason: "max_reached", used: 0, max: MAX_REVISIONS };

  const used = existing.revisionsUsed ?? 0;
  if (used >= MAX_REVISIONS) {
    return { ok: false, reason: "max_reached", used, max: MAX_REVISIONS };
  }

  const now = new Date();
  const entry: ChangeRequestEntry = {
    at: now.toISOString(),
    proofImageUrl: payload.proofImageUrl,
    generalNote: payload.generalNote,
    annotations: payload.annotations?.length ? payload.annotations : undefined,
  };

  await db
    .update(designRequests)
    .set({
      status: "changes_requested",
      revisionsUsed: used + 1,
      changeRequests: [...(existing.changeRequests ?? []), entry],
      updatedAt: now,
    })
    .where(eq(designRequests.id, id));

  return { ok: true, used: used + 1, max: MAX_REVISIONS };
}

/** Called after a team order is submitted against this design. */
export async function markOrdered(id: string) {
  const db = getDb();
  const now = new Date();
  await db
    .update(designRequests)
    .set({ status: "ordered", orderedAt: now, updatedAt: now })
    .where(eq(designRequests.id, id));
}
