import { randomUUID } from "node:crypto";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrders, teamOrderRoster, designRequests } from "@/db/schema";

export type NewTeamOrder = {
  teamName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  jerseyStyle?: string;
  jerseyMaterial?: string;
  items?: string[];
  designRequestId?: string;
};

export type RosterInput = {
  playerName?: string;
  playerNumber?: string;
  size?: string;
  sizes?: Record<string, string>;
  notes?: string;
};

function ref() {
  return `TO-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Coach creates a collecting order; returns tokens for the share + manage links. */
export async function createTeamOrder(input: NewTeamOrder) {
  const db = getDb();
  const selfEntryToken = randomUUID().replace(/-/g, "");
  const manageToken = randomUUID().replace(/-/g, "");
  const reference = ref();

  const [row] = await db
    .insert(teamOrders)
    .values({
      reference,
      status: "collecting",
      teamName: input.teamName,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      jerseyStyle: input.jerseyStyle,
      jerseyMaterial: input.jerseyMaterial,
      items: input.items?.length ? input.items : ["jersey"],
      designRequestId: input.designRequestId,
      selfEntryToken,
      manageToken,
      selfEntryOpen: true,
    })
    .returning();

  return { id: row.id, reference, selfEntryToken, manageToken };
}

export async function getBySelfEntryToken(token: string) {
  const db = getDb();
  const [row] = await db.select().from(teamOrders).where(eq(teamOrders.selfEntryToken, token)).limit(1);
  return row ?? null;
}

export async function getByManageToken(token: string) {
  const db = getDb();
  const [row] = await db.select().from(teamOrders).where(eq(teamOrders.manageToken, token)).limit(1);
  return row ?? null;
}

export async function getRoster(teamOrderId: string) {
  const db = getDb();
  return db
    .select()
    .from(teamOrderRoster)
    .where(eq(teamOrderRoster.teamOrderId, teamOrderId))
    .orderBy(asc(teamOrderRoster.position), asc(teamOrderRoster.createdAt));
}

/** A player adds their own row via the self-entry link. */
export async function addRosterRow(teamOrderId: string, input: RosterInput, filledBy = "self") {
  const db = getDb();
  const existing = await getRoster(teamOrderId);
  const [row] = await db
    .insert(teamOrderRoster)
    .values({
      teamOrderId,
      playerName: input.playerName,
      playerNumber: input.playerNumber,
      size: input.sizes?.jersey ?? input.size,
      sizes: input.sizes,
      notes: input.notes,
      filledBy,
      position: existing.length,
    })
    .returning();
  return row;
}

export type LinkedDesignPreview = {
  reference: string;
  status: string;
  /** Approved image if status=approved, else most recent proof image. */
  imageUrl: string | null;
  /** True when the design hasn't been approved yet (we're showing latest proof). */
  pending: boolean;
};

/** Pull the design image to show on the join/manage pages so players + coaches
 *  visually verify they're on the right team's roster. Returns null if there's
 *  no linked design or nothing visual yet. */
export async function getLinkedDesignPreview(designRequestId: string | null | undefined): Promise<LinkedDesignPreview | null> {
  if (!designRequestId) return null;
  const db = getDb();
  const [d] = await db.select().from(designRequests).where(eq(designRequests.id, designRequestId)).limit(1);
  if (!d) return null;
  const approved = d.approvedDesignUrl ?? null;
  const latestProof = d.proofImages?.length ? d.proofImages[d.proofImages.length - 1] : null;
  return {
    reference: d.reference,
    status: d.status,
    imageUrl: approved ?? latestProof,
    pending: d.status !== "approved",
  };
}

/** Coach submits the order; locks self-entry and marks it submitted. */
export async function submitTeamOrder(teamOrderId: string) {
  const db = getDb();
  await db
    .update(teamOrders)
    .set({ status: "submitted", selfEntryOpen: false, submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(teamOrders.id, teamOrderId));
}
