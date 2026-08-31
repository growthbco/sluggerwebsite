import { randomUUID } from "node:crypto";
import { eq, and, ne, asc, isNull, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrders, teamOrderRoster, designRequests } from "@/db/schema";
import {
  notDesignerMade,
  defaultRequiresNames,
  fabricForStyle,
  formatSize,
  itemLabel,
  itemKeysFromDesignProducts,
  fabricFor,
  resolveJerseyMaterial,
} from "@/lib/order-items";
import type { CustomerOrderSpec } from "@/lib/order-spec";

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
  sport?: string;
  jerseyStyle?: string;
  jerseyMaterial?: string;
  items?: string[];
  designRequestId?: string;
  /** Staff-confirmed paid upgrade: omit all Slugger branding from production. */
  whiteLabel?: boolean;
  /** Discord home for this order. Usually the linked design's forum thread. */
  discordThreadId?: string;
  // Inherited from a rush design request: flags the flat $100 rush fee.
  rushShipping?: boolean;
  /** Customer-selected fulfillment method. Local pickup never carries a
   * shipping charge or requires a delivery address. */
  localPickup?: boolean;
  /** Explicit timeline facts for an order entered by staff rather than the
   * customer workflow. All fields are validated together upstream. */
  manualTimeline?: {
    startAt: Date;
    tier: "standard" | "rush" | "priority";
    requestedInHandAt: Date;
    customerDatePromised: boolean;
    promisedInHandAt?: Date;
    priorityFeeCents?: number;
  };
  // Active SMS opt-in checked on the order form.
  smsOptIn?: boolean;
  // "Names on the back?" - defaults from the items (cheer -> No) when omitted.
  requiresNames?: boolean;
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

type ApprovedDesignOrderInput = {
  id: string;
  teamName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  sport?: string | null;
  jerseyStyle?: string | null;
  productTypes?: string[] | null;
  vision?: string | null;
  aiDesignState?: unknown;
  discordThreadId?: string | null;
  rush?: boolean | null;
  smsOptInAt?: Date | null;
  whiteLabel?: boolean | null;
};

/** Map a design brief to the exact billable order items. Shared by customer
 * and staff approval so both paths provision the same kind of order. */
export function itemsForDesignRequest(request: Pick<ApprovedDesignOrderInput, "productTypes" | "vision" | "sport" | "aiDesignState">): string[] {
  let items = itemKeysFromDesignProducts(request.productTypes);
  if (!items.length) items = ["jersey"];
  const state = request.aiDesignState as { style?: string; sport?: string } | null;
  const hint = `${request.vision ?? ""} ${state?.style ?? ""} ${state?.sport ?? ""} ${request.sport ?? ""} ${(request.productTypes ?? []).join(" ")}`.toLowerCase();
  if (items.includes("cheer_uniform") && /rhinestone|bling|crystal/.test(hint)) {
    items = items.map((key) => (key === "cheer_uniform" ? "cheer_uniform_rhinestone" : key));
  }
  if (/hockey/.test(hint)) items = items.map((key) => (key === "jersey" ? "hockey_jersey" : key));
  if (/flag football|flag-football/.test(hint)) items = items.map((key) => (key === "jersey" ? "flag_football_jersey" : key));
  return items;
}

/** Idempotently create the roster/order that belongs to an approved design. */
export async function provisionTeamOrderForApprovedDesign(request: ApprovedDesignOrderInput) {
  const existing = await getByDesignRequestId(request.id);
  if (existing) return existing;
  const state = request.aiDesignState as { sport?: string; style?: string } | null;
  await createTeamOrder({
    teamName: request.teamName,
    contactName: request.contactName,
    contactEmail: request.contactEmail,
    contactPhone: request.contactPhone ?? undefined,
    sport: request.sport ?? undefined,
    jerseyStyle: request.jerseyStyle ?? undefined,
    jerseyMaterial: fabricFor(
      request.jerseyStyle,
      request.sport,
      state?.sport,
      state?.style,
      request.vision,
      ...(request.productTypes ?? []),
    ),
    items: itemsForDesignRequest(request),
    designRequestId: request.id,
    whiteLabel: Boolean(request.whiteLabel),
    discordThreadId: request.discordThreadId ?? undefined,
    rushShipping: Boolean(request.rush),
    smsOptIn: Boolean(request.smsOptInAt),
  });
  return getByDesignRequestId(request.id);
}

type CustomerRosterLockable = {
  status: string;
  depositPaidAt?: Date | null;
  invoicePaidAt?: Date | null;
};

/** Customer roster changes stop the instant production is funded. Keep this
 * server-side and reuse it in every token-authenticated mutation so a stale
 * browser tab cannot bypass the lock. Staff may still make an exceptional
 * correction through the consolidated bulk-update path below. */
export function customerRosterLockMessage(order: CustomerRosterLockable): string | null {
  if (order.status === "cancelled") return "This order was cancelled, so its roster is locked.";
  if (order.status === "shipped") return "This order has already shipped, so its roster is locked.";
  if (order.depositPaidAt || order.invoicePaidAt || order.status === "in_production" || order.status === "paid") {
    return "Your deposit has been received and production has started, so this roster is locked. Contact Slugger Athletics if an urgent correction is needed.";
  }
  return null;
}

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
      sport: input.sport,
      jerseyStyle: input.jerseyStyle,
      // Never blanket-default to Mesh: if no fabric was chosen, derive it from
      // the style (button-front / zip = polyester, else mesh).
      jerseyMaterial:
        resolveJerseyMaterial(input.jerseyMaterial, input.jerseyStyle, input.sport) ??
        fabricForStyle(input.jerseyStyle),
      items: input.items?.length ? input.items : ["jersey"],
      designRequestId: input.designRequestId,
      whiteLabel: input.whiteLabel ?? false,
      discordThreadId: input.discordThreadId,
      rushShipping: input.rushShipping ?? false,
      localPickup: input.localPickup ?? false,
      manualEntryAt: input.manualTimeline ? new Date() : undefined,
      timelineStartAt: input.manualTimeline?.startAt,
      turnaroundTier: input.manualTimeline?.tier,
      requestedInHandAt: input.manualTimeline?.requestedInHandAt,
      customerDatePromised: input.manualTimeline?.customerDatePromised ?? false,
      promisedInHandAt: input.manualTimeline?.promisedInHandAt,
      priorityFeeCents: input.manualTimeline?.priorityFeeCents ?? 0,
      requiresNames: input.requiresNames ?? defaultRequiresNames(input.items),
      smsOptInAt: input.smsOptIn ? new Date() : undefined,
      selfEntryToken,
      manageToken,
      selfEntryOpen: true,
    })
    .returning();

  return { id: row.id, reference, selfEntryToken, manageToken };
}

/** Coach's "names on the back?" survey answer. Controls whether the roster
 *  form shows the player-name field. */
export async function setRequiresNames(orderId: string, requiresNames: boolean) {
  const db = getDb();
  await db.update(teamOrders).set({ requiresNames }).where(eq(teamOrders.id, orderId));
}

/** Customer-selected jersey fabric. This is deliberately editable only before
 * payment; after the deposit the same production lock as roster edits applies. */
export async function setJerseyMaterial(orderId: string, jerseyMaterial: string) {
  const db = getDb();
  await db
    .update(teamOrders)
    .set({ jerseyMaterial, updatedAt: new Date() })
    .where(eq(teamOrders.id, orderId));
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

/** Staff/designer admin workflows identify an order by its ordinary id so the
 * customer management token never has to cross the server/client boundary. */
export async function getById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(teamOrders).where(eq(teamOrders.id, id)).limit(1);
  return row ?? null;
}

/** Resolve the single Discord home for a custom order.
 *
 * Linked orders reuse their design request's thread. Standalone/manual orders
 * get their own thread in the Design Requests forum. The result is persisted
 * on team_orders so payments, add-ons, QA, notes, and shipping never have to
 * guess a destination or create duplicate posts. */
export async function ensureTeamOrderDiscordThread(orderId: string): Promise<string | null> {
  const db = getDb();
  const [order] = await db
    .select({
      id: teamOrders.id,
      reference: teamOrders.reference,
      teamName: teamOrders.teamName,
      designRequestId: teamOrders.designRequestId,
      discordThreadId: teamOrders.discordThreadId,
    })
    .from(teamOrders)
    .where(eq(teamOrders.id, orderId))
    .limit(1);
  if (!order) return null;
  if (order.discordThreadId) return order.discordThreadId;

  let threadId: string | null = null;
  if (order.designRequestId) {
    const [design] = await db
      .select({ discordThreadId: designRequests.discordThreadId })
      .from(designRequests)
      .where(eq(designRequests.id, order.designRequestId))
      .limit(1);
    threadId = design?.discordThreadId ?? null;
  }

  if (!threadId) {
    const { createDesignThread } = await import("@/lib/discord");
    threadId = await createDesignThread({
      title: `${order.teamName} (${order.reference})`,
      description: order.designRequestId
        ? "Custom order linked to this design request."
        : "Custom order entered without a prior website design request.",
    });
    if (threadId && order.designRequestId) {
      await db
        .update(designRequests)
        .set({ discordThreadId: threadId, updatedAt: new Date() })
        .where(eq(designRequests.id, order.designRequestId));
    }
  }

  if (threadId) {
    await db
      .update(teamOrders)
      .set({ discordThreadId: threadId, updatedAt: new Date() })
      .where(eq(teamOrders.id, order.id));
  }
  return threadId;
}

/** The team order (if any) that fulfills a given design request. Used by the
 *  designer-facing print-file QA so they can verify against the roster the
 *  team submitted, without exposing the QA tool to the coach. */
/** Duplicate/related-order guard: other (non-cancelled) team orders that share
 *  this order's contact (email OR last-10 phone). Self-serve customers often
 *  re-run the order form instead of editing, spinning up duplicates - this
 *  surfaces them so staff can merge or delete. Not a hard block: some teams
 *  legitimately place separate orders (e.g. jerseys + pullovers), so we flag
 *  rather than prevent. `likelyDuplicate` marks the high-signal case (same
 *  team, unpaid). */
export type RelatedOrder = {
  id: string;
  reference: string;
  teamName: string;
  status: string;
  createdAt: Date | null;
  players: number;
  hasDesign: boolean;
  paid: boolean;
  likelyDuplicate: boolean;
};

export async function findRelatedOrdersByContact(opts: {
  excludeId: string;
  email?: string | null;
  phone?: string | null;
  teamName?: string | null;
}): Promise<RelatedOrder[]> {
  const db = getDb();
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const email = norm(opts.email);
  const phone10 = (opts.phone ?? "").replace(/\D/g, "").slice(-10);
  const team = norm(opts.teamName);
  if (!email && !phone10) return [];

  const rows = await db.select().from(teamOrders);
  const matches = rows.filter(
    (o) =>
      o.id !== opts.excludeId &&
      o.status !== "cancelled" &&
      ((email && norm(o.contactEmail) === email) ||
        (phone10 && (o.contactPhone ?? "").replace(/\D/g, "").slice(-10) === phone10)),
  );

  const out: RelatedOrder[] = [];
  for (const o of matches) {
    const roster = await getRoster(o.id);
    const paid = Boolean(o.depositPaidAt || o.invoicePaidAt);
    out.push({
      id: o.id,
      reference: o.reference,
      teamName: o.teamName,
      status: o.status,
      createdAt: o.createdAt,
      players: roster.length,
      hasDesign: Boolean(o.designRequestId),
      paid,
      // High-signal duplicate: same team name, not paid yet.
      likelyDuplicate: !paid && Boolean(team) && norm(o.teamName) === team,
    });
  }
  return out.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

const ORDER_STAGE_RANK = ["draft", "collecting", "submitted", "quoted", "in_production", "paid", "shipped"];

export async function getByDesignRequestId(designRequestId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(teamOrders)
    .where(and(eq(teamOrders.designRequestId, designRequestId), isNull(teamOrders.archivedAt)));
  if (!rows.length) return null;
  // A design can accidentally have more than one linked order (e.g. a stray
  // early duplicate + the real one). Return the order FURTHEST along - by
  // pipeline stage, then by having an invoice, then most recent - so a
  // collecting duplicate never hides the invoiced order on the customer's page.
  return [...rows].sort((a, b) => {
    const r = ORDER_STAGE_RANK.indexOf(b.status) - ORDER_STAGE_RANK.indexOf(a.status);
    if (r) return r;
    const inv = Number(Boolean(b.invoiceUrl)) - Number(Boolean(a.invoiceUrl));
    if (inv) return inv;
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  })[0];
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
      const hasPrinted = (r.size ?? "").trim() || Object.entries(r.sizes ?? {}).some(([k, v]) => !notDesignerMade(k) && (v ?? "").trim());
      const personalized = (r.playerName ?? "").trim() || (r.playerNumber ?? "").trim();
      return hasPrinted && personalized;
    })
    .map((r) => {
      const sized = Object.entries(r.sizes ?? {}).find(([k, v]) => !notDesignerMade(k) && (v ?? "").trim());
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

/** Other active team orders that share this order's design (same physical
 *  print sheet - e.g. coaches ordered on their own order). Lets the print-file
 *  QA UI surface "these sibling orders also need verifying" so no piece on the
 *  shared sheet gets missed. Returns only orders that have printable jerseys. */
export async function getSiblingPrintOrders(designRequestId: string, excludeId: string) {
  const db = getDb();
  const sibs = await db
    .select({ id: teamOrders.id, reference: teamOrders.reference, teamName: teamOrders.teamName, contactName: teamOrders.contactName, status: teamOrders.status })
    .from(teamOrders)
    .where(and(eq(teamOrders.designRequestId, designRequestId), ne(teamOrders.id, excludeId), isNull(teamOrders.archivedAt)));
  const out: { id: string; reference: string; label: string; status: string; total: number; verified: number }[] = [];
  for (const s of sibs) {
    const jerseys = await getPrintableJerseys(s.id);
    if (jerseys.length === 0) continue;
    out.push({
      id: s.id,
      reference: s.reference,
      label: s.teamName.trim() || s.contactName,
      status: s.status,
      total: jerseys.length,
      verified: jerseys.filter((j) => j.verifiedAt).length,
    });
  }
  return out;
}

/** Full per-order print checklists for every OTHER active order on a design
 *  (identified only by its internal id + printable jerseys), so the designer's
 *  checklist page can verify the whole shared print sheet - players and the
 *  coaches/extras that were ordered separately - all in one place. */
export async function getSiblingChecklists(designRequestId: string, excludeId: string) {
  const db = getDb();
  const sibs = await db
    .select()
    .from(teamOrders)
    .where(and(eq(teamOrders.designRequestId, designRequestId), ne(teamOrders.id, excludeId), isNull(teamOrders.archivedAt)))
    .orderBy(asc(teamOrders.createdAt));
  const out: { id: string; reference: string; label: string; jerseys: Awaited<ReturnType<typeof getPrintableJerseys>> }[] = [];
  for (const s of sibs) {
    const jerseys = await getPrintableJerseys(s.id);
    if (!jerseys.length) continue;
    out.push({ id: s.id, reference: s.reference, label: s.teamName.trim() || s.contactName, jerseys });
  }
  return out;
}

/** Coach edits an existing roster row (size correction, name/number fix). Any
 *  change clears that jersey's print-file verification so QA re-checks it, and
 *  recomputes the order's overall print gate. Scoped to the order so a token
 *  can only touch its own rows. */
export async function updateRosterRow(teamOrderId: string, rowId: string, patch: RosterInput): Promise<boolean> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(teamOrderRoster)
    .where(and(eq(teamOrderRoster.id, rowId), eq(teamOrderRoster.teamOrderId, teamOrderId)))
    .limit(1);
  if (!existing) return false;
  const sizes = patch.sizes ? { ...(existing.sizes ?? {}), ...patch.sizes } : existing.sizes;
  await db
    .update(teamOrderRoster)
    .set({
      playerName: patch.playerName ?? existing.playerName,
      playerNumber: patch.playerNumber ?? existing.playerNumber,
      sizes,
      size: sizes?.jersey ?? patch.size ?? existing.size,
      notes: patch.notes ?? existing.notes,
      design: patch.design ?? existing.design,
      quantity: patch.quantity != null ? Math.max(1, patch.quantity) : existing.quantity,
      // A corrected jersey must be re-verified against the print sheet.
      printVerifiedAt: null,
      printVerifiedSheet: null,
    })
    .where(eq(teamOrderRoster.id, rowId));
  // Recompute the order-wide print gate (a now-unverified row un-sets it).
  const all = await getPrintableJerseys(teamOrderId);
  const allVerified = all.length > 0 && all.every((j) => j.verifiedAt);
  await db.update(teamOrders).set({ printFileVerifiedAt: allVerified ? new Date() : null, updatedAt: new Date() }).where(eq(teamOrders.id, teamOrderId));
  return true;
}

export type BulkRosterUpdate = { rowId: string; patch: RosterInput };

/** Staff-only bulk correction path. It validates every target first, applies
 * all requested rows, resets print QA through updateRosterRow, then sends ONE
 * consolidated Discord summary instead of one @here alert per jersey. */
export async function updateRosterRowsBulkAndNotify(
  teamOrderId: string,
  updates: BulkRosterUpdate[],
): Promise<{ updated: number; notified: boolean; summary: string[] }> {
  if (!updates.length) return { updated: 0, notified: false, summary: [] };
  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, teamOrderId)).limit(1);
  if (!order) throw new Error("Team order not found.");

  const roster = await getRoster(teamOrderId);
  const byId = new Map(roster.map((row) => [row.id, row]));
  const uniqueIds = new Set(updates.map((update) => update.rowId));
  if (uniqueIds.size !== updates.length) throw new Error("A roster row was included more than once.");
  for (const update of updates) {
    if (!byId.has(update.rowId)) throw new Error("A requested roster row does not belong to this order.");
  }

  const summary = updates.map(({ rowId, patch }) => {
    const before = byId.get(rowId)!;
    const who = [
      before.playerNumber ? `#${before.playerNumber}` : before.playerName || "Player",
      before.design ? `(${before.design})` : null,
    ].filter(Boolean).join(" ");
    const parts: string[] = [];
    if (patch.playerName !== undefined && patch.playerName !== before.playerName) {
      parts.push(`name: ${before.playerName || "-"} → ${patch.playerName || "-"}`);
    }
    if (patch.playerNumber !== undefined && patch.playerNumber !== before.playerNumber) {
      parts.push(`number: #${before.playerNumber || "-"} → #${patch.playerNumber || "-"}`);
    }
    for (const [key, value] of Object.entries(patch.sizes ?? {})) {
      const oldValue = before.sizes?.[key] ?? (key === "jersey" ? before.size : null);
      if (value !== oldValue) parts.push(`${itemLabel(key)}: ${formatSize(oldValue)} → ${formatSize(value)}`);
    }
    if (patch.design !== undefined && patch.design !== before.design) {
      parts.push(`design: ${before.design || "-"} → ${patch.design || "-"}`);
    }
    if (patch.notes !== undefined && patch.notes !== before.notes) parts.push("notes updated");
    return `• **${who}** — ${parts.join(" · ") || "details reviewed"}`;
  });

  for (const update of updates) {
    const ok = await updateRosterRow(teamOrderId, update.rowId, update.patch);
    if (!ok) throw new Error("A roster row disappeared during the bulk update.");
  }

  const { postDesignThreadUpdate } = await import("@/lib/discord");
  const threadId = await ensureTeamOrderDiscordThread(teamOrderId);
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  const fullDescription = [
    `**${updates.length} roster ${updates.length === 1 ? "change" : "changes"} applied in one batch.** Use this summary instead of the earlier roster snapshot:`,
    "",
    ...summary,
    "",
    "Print-file QA was reset for every affected jersey. Update the print file and re-run verification before printing.",
    `🔗 [Open order](${SITE}/team-order/manage/${order.manageToken})`,
  ].join("\n");
  const notified = await postDesignThreadUpdate({
    threadId,
    title: `⚠️ BULK ROSTER UPDATE — ${order.teamName} (${order.reference})`,
    description: fullDescription.slice(0, 4000),
    mention: true,
    username: "Slugger Custom Orders",
  });
  return { updated: updates.length, notified, summary };
}

/** Coach removes a roster row. Scoped to the order. */
export async function deleteRosterRow(teamOrderId: string, rowId: string): Promise<boolean> {
  const db = getDb();
  const res = await db
    .delete(teamOrderRoster)
    .where(and(eq(teamOrderRoster.id, rowId), eq(teamOrderRoster.teamOrderId, teamOrderId)))
    .returning({ id: teamOrderRoster.id });
  if (res.length) {
    await db.update(teamOrders).set({ updatedAt: new Date() }).where(eq(teamOrders.id, teamOrderId));
  }
  return res.length > 0;
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
  approvedAt: Date | null;
  neededBy: Date | null;
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
  const currentProofs = d.proofReviewUrls?.length ? d.proofReviewUrls : d.proofImages ?? [];
  const latestProof = currentProofs.length ? currentProofs[currentProofs.length - 1] : null;
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
    approvedAt: d.approvedAt,
    neededBy: d.neededBy,
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

/** Coach submits the order; records delivery-policy acceptance, locks
 * self-entry, and marks it submitted. Requiring the timestamp here prevents a
 * future submission path from silently skipping the acknowledgment. */
export async function submitTeamOrder(
  teamOrderId: string,
  deliveryTermsAcceptedAt: Date,
  specSnapshot: CustomerOrderSpec,
) {
  const db = getDb();
  await db
    .update(teamOrders)
    .set({
      status: "submitted",
      selfEntryOpen: false,
      deliveryTermsAcceptedAt,
      specConfirmedAt: new Date(),
      specSnapshot,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(teamOrders.id, teamOrderId));
}

import { itemLabel as _itemLabel } from "@/lib/order-items";

/** Roster rows -> invoice recap lines with the RIGHT size per item (not just
 *  jersey) and the colorway. A row can cover several items (jersey + hat);
 *  each sized item becomes its own recap line. Falls back to the legacy
 *  single `size` field / a plain jersey line. */
export function invoiceRosterEntries(
  roster: { playerName?: string | null; playerNumber?: string | null; size?: string | null; sizes?: Record<string, string> | null; design?: string | null; notes?: string | null; quantity?: number | null }[],
): { name: string; number: string; item: string; size: string; color: string }[] {
  const out: { name: string; number: string; item: string; size: string; color: string }[] = [];
  for (const r of roster) {
    const name = (r.playerName ?? "").trim();
    const number = (r.playerNumber ?? "").trim();
    // Colorway: the structured `design` label when a team has multiple
    // approved colorways, otherwise the per-player note (coaches often type
    // the color there, e.g. "TEAL" / "BLACK").
    const color = (r.design ?? "").trim() || (r.notes ?? "").trim();
    const sized = Object.entries(r.sizes ?? {}).filter(([, v]) => (v ?? "").trim());
    if (sized.length) {
      for (const [key, size] of sized) out.push({ name, number, item: _itemLabel(key), size: (size as string).trim(), color });
    } else if ((r.size ?? "").trim()) {
      out.push({ name, number, item: "Jersey", size: (r.size as string).trim(), color });
    }
  }
  return out;
}
