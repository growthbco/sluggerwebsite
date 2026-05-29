import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests } from "@/db/schema";

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

/** Client submits the intake form -> create a request, mint tokens. */
export async function createDesignRequest(input: NewDesignRequest) {
  const db = getDb();
  const reference = makeRef();
  const statusToken = token();
  const manageToken = token();

  const neededByDate = input.neededBy ? new Date(input.neededBy) : null;
  const rush = isRush(neededByDate);

  const [row] = await db
    .insert(designRequests)
    .values({
      reference,
      status: "submitted",
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
    })
    .returning();

  return { id: row.id, reference, statusToken, manageToken, rush, neededBy: row.neededBy };
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

/** Client requests changes; loops back to designer. */
export async function requestChanges(id: string, note?: string) {
  const db = getDb();
  const [existing] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  if (!existing) return;
  const now = new Date();
  const newNotes = note ? `${existing.notes ?? ""}\n[Change request ${now.toISOString()}] ${note}`.trim() : existing.notes;
  await db
    .update(designRequests)
    .set({ status: "changes_requested", notes: newNotes, updatedAt: now })
    .where(eq(designRequests.id, id));
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
