import { randomUUID } from "node:crypto";
import { eq, asc, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrders, teamOrderRoster, designRequests } from "@/db/schema";
import { isInHouseItem } from "@/lib/order-items";

export type JerseyLine = {
  id: string;
  name: string;
  number: string;
  size: string;
  color: string;
  verifiedAt: Date | null;
  sheet: string | null;
};

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
  design?: string;
  quantity?: number;
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

/** The team order (if any) that fulfills a given design request. Used by the
 *  designer-facing print-file QA so they can verify against the roster the
 *  team submitted, without exposing the QA tool to the coach. */
export async function getByDesignRequestId(designRequestId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(teamOrders)
    .where(eq(teamOrders.designRequestId, designRequestId))
    .orderBy(asc(teamOrders.createdAt))
    .limit(1);
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

/** Printable jerseys on a team order (one line per roster row) for per-jersey
 *  print-file QA. Excludes in-house pieces (hats) and blank rows. */
export async function getPrintableJerseys(teamOrderId: string): Promise<JerseyLine[]> {
  const rows = await getRoster(teamOrderId);
  return rows
    .filter((r) => {
      const hasPrinted = (r.size ?? "").trim() || Object.entries(r.sizes ?? {}).some(([k, v]) => !isInHouseItem(k) && (v ?? "").trim());
      const personalized = (r.playerName ?? "").trim() || (r.playerNumber ?? "").trim();
      return hasPrinted && personalized;
    })
    .map((r) => {
      const sized = Object.entries(r.sizes ?? {}).find(([k, v]) => !isInHouseItem(k) && (v ?? "").trim());
      return {
        id: r.id,
        name: (r.playerName ?? "").trim(),
        number: (r.playerNumber ?? "").trim(),
        size: (r.sizes?.jersey ?? sized?.[1] ?? r.size ?? "").trim(),
        color: (r.design ?? r.notes ?? "").trim(),
        verifiedAt: r.printVerifiedAt,
        sheet: r.printVerifiedSheet,
      };
    });
}

/** Mark specific jerseys verified against a sheet, then recompute the order's
 *  overall print-file gate (all printable jerseys verified => set). */
export async function markJerseysVerified(teamOrderId: string, rowIds: string[], sheetUrl: string): Promise<void> {
  const db = getDb();
  if (rowIds.length) {
    await db.update(teamOrderRoster).set({ printVerifiedAt: new Date(), printVerifiedSheet: sheetUrl }).where(inArray(teamOrderRoster.id, rowIds));
  }
  const all = await getPrintableJerseys(teamOrderId);
  const allVerified = all.length > 0 && all.every((j) => j.verifiedAt);
  await db.update(teamOrders).set({ printFileVerifiedAt: allVerified ? new Date() : null, updatedAt: new Date() }).where(eq(teamOrders.id, teamOrderId));
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
      design: input.design,
      quantity: Math.max(1, input.quantity ?? 1),
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
  /** Design colors (free-text + hex list), for the order-details summary. */
  colors: string | null;
  /** All approved designs/colorways players can pick from (label + image + SKU). */
  designs: { label: string; image: string; sku: string | null }[];
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
  const colors = [d.colors?.trim(), (d.colorHexes ?? []).join(", ")].filter(Boolean).join(" · ") || null;
  // All approved colorways players can pick from - labeled from proofLabels
  // when set, otherwise "Design 1/2/…".
  const approvedList = d.approvedDesignUrls?.length ? d.approvedDesignUrls : approved ? [approved] : [];
  const labels = d.proofLabels ?? {};
  const skuMap = d.designSkus ?? {};
  const designs = approvedList.map((url, i) => ({ label: (labels[url] || `Design ${i + 1}`).trim(), image: url, sku: skuMap[url] ?? null }));
  return {
    reference: d.reference,
    status: d.status,
    imageUrl: approved ?? latestProof,
    // "ordered" comes AFTER approval - it's still an approved design.
    pending: d.status !== "approved" && d.status !== "ordered",
    colors,
    designs,
  };
}

/** Persist a print-file verification result. */
export async function savePrintFileVerification(
  teamOrderId: string,
  printFileUrls: string[],
  verification: NonNullable<typeof teamOrders.$inferSelect.printFileVerification>,
) {
  const db = getDb();
  await db
    .update(teamOrders)
    .set({
      printFileUrl: printFileUrls[0] ?? null,
      printFileUrls,
      printFileVerification: verification,
      printFileVerifiedAt: verification.ok ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(teamOrders.id, teamOrderId));
}

/** Designer logs the factory -> Slugger shipment. Internal only. */
export async function saveInboundTracking(
  teamOrderId: string,
  trackingNumber: string,
  carrier: string,
) {
  const db = getDb();
  await db
    .update(teamOrders)
    .set({
      inboundTrackingNumber: trackingNumber,
      inboundCarrier: carrier,
      inboundTrackingAddedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(teamOrders.id, teamOrderId));
}

/** Coach submits the order; locks self-entry and marks it submitted. */
export async function submitTeamOrder(teamOrderId: string) {
  const db = getDb();
  await db
    .update(teamOrders)
    .set({ status: "submitted", selfEntryOpen: false, submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(teamOrders.id, teamOrderId));
}
