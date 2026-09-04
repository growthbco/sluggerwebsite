import { randomUUID } from "node:crypto";
import { eq, ne, and, or, asc, desc, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests, teamOrders, designLabVisitors, designLabRenders } from "@/db/schema";
import { UNRESPONSIVE_ARCHIVE_NOTE, isUnresponsiveArchiveNote } from "@/lib/proof-follow-up-policy";

/** Human-readable "what to mock up" line: "Jersey (Two-button), Shorts, Hat".
 *  The jersey cut rides along on the jersey/shirt entry. */
export function formatProducts(productTypes?: string[] | null, jerseyStyle?: string | null): string {
  return (productTypes ?? [])
    .map((p) => (/jersey|shirt/i.test(p) && jerseyStyle ? `${p} (${jerseyStyle})` : p))
    .join(", ");
}

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
  /** What the customer wants mocked up (product labels) + jersey cut. */
  productTypes?: string[];
  jerseyStyle?: string;
  /** Exact hex colors picked from the wheel. */
  colorHexes?: string[];
  /** When the customer needs the uniforms in hand. ISO date string. */
  neededBy?: string;
  /** They ticked the required delivery-delay acknowledgment on the intake. */
  delaysAck?: boolean;
  /** Approximate total piece count the client expects ("3-9", "25+", ...). */
  estimatedPieces?: string;
  /** Fee state - set by the create-request route based on returning-customer
   *  detection. Defaults to "pending_payment" if not provided. */
  feeWaivedReason?: string | null;
  feeWaivedRef?: string | null;
};

const RUSH_DAYS = 21;
export const RUSH_FEE_NOTE = "Two-week rush service is a flat $100 fee; staff must confirm the timeline. Dates inside two weeks require a manual priority review.";

/** The approved mockup graphic(s) for a design, in priority order: the approved
 *  set, then the single approved URL, then the latest proof as a fallback. Used
 *  to attach the artwork to production posts so the designer always sees what to
 *  build - whether the customer approved it or staff processed the order. */
export function approvedMockupImages(design: {
  approvedDesignUrls?: string[] | null;
  approvedDesignUrl?: string | null;
  proofImages?: string[] | null;
}): string[] {
  if (design.approvedDesignUrls?.length) return design.approvedDesignUrls;
  if (design.approvedDesignUrl) return [design.approvedDesignUrl];
  const proofs = design.proofImages ?? [];
  return proofs.length ? [proofs[proofs.length - 1]] : [];
}

const DESIGN_DONE_STATUSES = new Set(["approved", "ordered", "cancelled"]);

/** Whether a design still needs an action FROM US on the admin dashboard: it's
 *  not archived or finished, and either it's a fresh/changes-requested request
 *  or the customer spoke last. A staff "followed up" mark (set when we reach out
 *  by text/call outside the thread) clears it - until the customer messages
 *  again AFTER that mark, which re-flags it. */
export function designNeedsAction(d: {
  status: string;
  archivedAt?: Date | null;
  followedUpAt?: Date | null;
  messages?: { from?: string; at?: string }[] | null;
  /** The last thread message alone - lets list pages avoid loading the whole
   *  `messages` array just to check who spoke last. Takes precedence when set. */
  lastMessage?: { from?: string; at?: string } | null;
}): boolean {
  if (d.archivedAt) return false;
  if (DESIGN_DONE_STATUSES.has(d.status)) return false;
  const lastMsg = d.lastMessage ?? d.messages?.[d.messages.length - 1];
  const flagged = d.status === "changes_requested" || d.status === "submitted" || lastMsg?.from === "client";
  if (!flagged) return false;
  if (d.followedUpAt) {
    const lastAt = lastMsg?.at ? new Date(lastMsg.at) : null;
    if (!lastAt || lastAt <= new Date(d.followedUpAt)) return false;
  }
  return true;
}

/** Record that staff followed up on a design (clears the "waiting on us" flag
 *  until the customer replies again). Pass null to un-mark. */
export async function markFollowedUp(id: string, at: Date | null = new Date()) {
  const { getDb } = await import("@/db");
  const { designRequests } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await getDb().update(designRequests).set({ followedUpAt: at, updatedAt: new Date() }).where(eq(designRequests.id, id));
}

/** Returns true when the requested date falls inside the standard 3-week window. */
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
 *  auto-waive the design fee for returning customers - we don't want to
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

/** Find this email's active design request. Safety net for coaches who skip
 *  their design link and fill the plain /team-order form by hand - we still
 *  want their roster attached to the design's Discord thread. Returns null
 *  unless exactly ONE non-cancelled design matches: guessing between two
 *  active designs would post a roster into the wrong team's thread. */
export async function findActiveDesignByEmail(email: string) {
  if (!email) return null;
  const db = getDb();
  const e = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(designRequests)
    .where(and(sql`lower(${designRequests.contactEmail}) = ${e}`, ne(designRequests.status, "cancelled")))
    .orderBy(desc(designRequests.createdAt))
    .limit(2);
  return rows.length === 1 ? rows[0] : null;
}

/** Client submits the intake form -> create a request, mint tokens. */
export async function createDesignRequest(input: NewDesignRequest) {
  const db = getDb();
  const reference = makeRef();
  const statusToken = token();
  const manageToken = token();

  const neededByDate = input.neededBy ? new Date(input.neededBy) : null;
  const rush = isRush(neededByDate);

  // Design is free (the $35 fee was retired), so every request goes straight
  // to 'submitted' and the designer pipeline kicks in immediately. `waived` is
  // kept true for callers that branch on it.
  const waived = true;

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
      productTypes: input.productTypes ?? [],
      jerseyStyle: input.jerseyStyle ?? null,
      colorHexes: input.colorHexes ?? [],
      inspirationImages: input.inspirationImages ?? [],
      neededBy: neededByDate && !isNaN(neededByDate.getTime()) ? neededByDate : null,
      estimatedPieces: input.estimatedPieces ?? null,
      rush,
      delaysAckAt: input.delaysAck ? new Date() : null,
      statusToken,
      manageToken,
      designFeeAmountCents: 0,
      designFeePaidAt: new Date(),
      designFeeWaivedReason: input.feeWaivedReason ?? "no_fee",
      designFeeWaivedRef: input.feeWaivedRef ?? null,
    })
    .returning();

  return { id: row.id, reference, statusToken, manageToken, rush, neededBy: row.neededBy, waived };
}

/** Convert an AI Jersey Maker lead into a design request so staff can pick up
 *  their saved designs in the editable AI studio. Seeds aiDesignState.versions
 *  from the lead's saved renders, carries over their contact, and does NOT
 *  notify the designer (this is staff continuing an existing design, not a
 *  fresh intake). Idempotent: if the lead's email already has a request, that
 *  one is returned instead of creating a duplicate. */
export async function convertLeadToDesignRequest(
  visitorId: string,
): Promise<{ ok: boolean; manageToken?: string; reference?: string; error?: string }> {
  const db = getDb();
  const [v] = await db.select().from(designLabVisitors).where(eq(designLabVisitors.id, visitorId)).limit(1);
  if (!v) return { ok: false, error: "Lead not found" };
  if (!v.email) return { ok: false, error: "This lead has no email on file yet, so it can't be converted." };

  // Already has a design request (matched by email)? Reuse it - no duplicate.
  const email = v.email.trim().toLowerCase();
  const [existing] = await db
    .select({ manageToken: designRequests.manageToken, reference: designRequests.reference })
    .from(designRequests)
    .where(sql`lower(${designRequests.contactEmail}) = ${email}`)
    .limit(1);
  if (existing?.manageToken) return { ok: true, manageToken: existing.manageToken, reference: existing.reference };

  const renders = await db
    .select()
    .from(designLabRenders)
    .where(eq(designLabRenders.visitorId, visitorId))
    .orderBy(asc(designLabRenders.createdAt));
  const versions = renders.map((r) => ({ url: r.url, note: r.note ?? "", at: (r.createdAt ?? new Date()).toISOString() }));

  const name = [v.firstName, v.lastName].map((s) => (s ?? "").trim()).filter(Boolean).join(" ") || "Design Lab Lead";
  const reference = makeRef();
  const statusToken = token();
  const manageToken = token();
  const teamName = `${name}'s Design`;
  const [row] = await db
    .insert(designRequests)
    .values({
      reference,
      status: "in_design", // staff is actively working the design
      teamName,
      contactName: name,
      contactEmail: v.email,
      contactPhone: v.phone ?? null,
      // The lead gave their phone at the lab's email gate (with the SMS consent
      // note), so carry that consent over - otherwise proof/notification texts
      // silently skip them and never reach the Texts inbox.
      smsOptInAt: v.phone ? new Date() : null,
      // Keep the lab as the origin, but carry the first-touch traffic source so
      // "AI Design Lab" also shows HOW they reached it (e.g.
      // "AI Design Lab · Instagram (ad)").
      source: v.source ? `AI Design Lab · ${v.source}` : "AI Design Lab",
      productTypes: ["Jersey / Shirt"],
      aiDesignState: { versions },
      statusToken,
      manageToken,
      designFeeAmountCents: 0,
      designFeePaidAt: new Date(),
      designFeeWaivedReason: "design_lab_lead",
    })
    .returning({ id: designRequests.id });

  // Open ONE home thread in #design-requests and save it, so every later event
  // (proof/changes/reply) nests there instead of spawning a new post each time.
  try {
    const { createDesignThread } = await import("@/lib/discord");
    const threadId = await createDesignThread({
      title: `${teamName} (${reference})`,
      description: "Continuing a Jersey Maker lead's design in the studio.",
    });
    if (threadId) await setDiscordThreadId(row.id, threadId);
  } catch (e) {
    console.error("convert: design thread create failed", e);
  }

  return { ok: true, manageToken, reference };
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

/** Move a quiet proof out of the working queue without deleting it. A linked
 *  funded/production order is a hard stop: money on an order always keeps it
 *  visible for staff. Discord is tagged before it is archived because Discord
 *  rejects tag edits on already archived threads. */
export async function markDesignUnresponsive(id: string): Promise<{ ok: boolean; reason?: "not_found" | "funded" }> {
  const db = getDb();
  const [request] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  if (!request) return { ok: false, reason: "not_found" };

  const linked = await db
    .select({ status: teamOrders.status, depositPaidAt: teamOrders.depositPaidAt, invoicePaidAt: teamOrders.invoicePaidAt })
    .from(teamOrders)
    .where(eq(teamOrders.designRequestId, id));
  const funded = linked.some((order) =>
    Boolean(order.depositPaidAt || order.invoicePaidAt || ["in_production", "paid", "shipped"].includes(order.status)),
  );
  if (funded) return { ok: false, reason: "funded" };

  const now = new Date();
  await db
    .update(designRequests)
    .set({ archivedAt: now, archivedNote: UNRESPONSIVE_ARCHIVE_NOTE, followUpSnoozedUntil: null, updatedAt: now })
    .where(eq(designRequests.id, id));

  const [{ postDesignThreadUpdate }, { setThreadStageTag, archiveDiscordThread }] = await Promise.all([
    import("@/lib/discord"),
    import("@/lib/discord-bot"),
  ]);
  await postDesignThreadUpdate({
    threadId: request.discordThreadId,
    title: `💤 Moved to Unresponsive - ${request.teamName} (${request.reference})`,
    description: "Three scheduled proof reminders were sent with no response. The request is preserved and will automatically reopen if the customer replies, approves, or requests changes.",
    username: "Slugger Design Requests",
  });
  await setThreadStageTag(request.discordThreadId, "💤 Unresponsive");
  await archiveDiscordThread(request.discordThreadId);
  return { ok: true };
}

/** Reopen only records the automation classified as unresponsive. Other
 *  archive reasons (lost, on hold, duplicate) remain deliberate staff choices. */
export async function reactivateUnresponsiveDesignRequest(id: string): Promise<boolean> {
  const db = getDb();
  const [request] = await db
    .select({
      status: designRequests.status,
      archivedAt: designRequests.archivedAt,
      archivedNote: designRequests.archivedNote,
      discordThreadId: designRequests.discordThreadId,
    })
    .from(designRequests)
    .where(eq(designRequests.id, id))
    .limit(1);
  if (!request?.archivedAt || !isUnresponsiveArchiveNote(request.archivedNote)) return false;

  const now = new Date();
  await db
    .update(designRequests)
    .set({
      archivedAt: null,
      archivedNote: null,
      followUpsSent: 0,
      lastFollowUpAt: null,
      followUpSnoozedUntil: null,
      updatedAt: now,
    })
    .where(eq(designRequests.id, id));

  const { unarchiveDiscordThread, setThreadStageTag } = await import("@/lib/discord-bot");
  await unarchiveDiscordThread(request.discordThreadId);
  await setThreadStageTag(
    request.discordThreadId,
    request.status === "approved" || request.status === "ordered" ? "✅ Approved" : "🎨 Designing",
  );
  return true;
}

/** A stable product key for matching a revised proof to the proof it replaces.
 * Designers commonly append "rev 2" to a label, which should not turn the
 * prior version into a separate customer-approvable product. */
function proofProductKey(label?: string): string | null {
  const key = (label ?? "")
    .toLowerCase()
    .replace(/\brev(?:ision)?\s*\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return key || null;
}

/**
 * Add a labeled product proof without retiring the other products in the same
 * uniform project. A new proof with the same product label replaces only that
 * product's current version. Unlabeled uploads append by default, so a
 * designer must explicitly choose to replace the entire current proof set.
 */
export function nextProofReviewUrls(input: {
  previousReview: string[];
  incoming: string[];
  labels: Record<string, string>;
}): { reviewUrls: string[]; supersededUrls: string[] } {
  const incomingAreLabeled = input.incoming.length > 0
    && input.incoming.every((url) => proofProductKey(input.labels[url]));
  if (!incomingAreLabeled || input.previousReview.length === 0) {
    return {
      reviewUrls: [...new Set([...input.previousReview, ...input.incoming])],
      supersededUrls: [],
    };
  }

  const incomingKeys = new Set(input.incoming.map((url) => proofProductKey(input.labels[url])));
  const supersededUrls = input.previousReview.filter((url) => {
    const key = proofProductKey(input.labels[url]);
    return key !== null && incomingKeys.has(key);
  });
  return {
    reviewUrls: [
      ...input.previousReview.filter((url) => !supersededUrls.includes(url)),
      ...input.incoming,
    ],
    supersededUrls,
  };
}

/**
 * Designer uploads proof image(s); auto-bumps status to proof_sent.
 *
 * Adding a different product (jersey, practice shirt, hat, etc.) must not
 * quietly make the team's other current proofs unapprovable. That is the
 * normal path, so new proofs append to the active review set by default. A
 * designer explicitly opts into replacement when a new proof supersedes the
 * entire current review batch. A labeled revision still replaces its matching
 * product only.
 */
export async function addProofImages(
  id: string,
  urls: string[],
  labels?: Record<string, string>,
  options: { replaceCurrentReview?: boolean } = {},
) {
  const db = getDb();
  const [existing] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  if (!existing) return null;
  if (existing.archivedAt && isUnresponsiveArchiveNote(existing.archivedNote)) {
    await reactivateUnresponsiveDesignRequest(id);
  }
  const incoming = [...new Set(urls.filter(Boolean))];
  const merged = [...new Set([...(existing.proofImages ?? []), ...incoming])];
  const previousReview = existing.proofReviewUrls?.length
    ? existing.proofReviewUrls
    : existing.status === "proof_sent" || existing.status === "changes_requested"
      ? existing.proofImages ?? []
      : [];
  const existingApproved = existing.approvedDesignUrls ?? (existing.approvedDesignUrl ? [existing.approvedDesignUrl] : []);
  // Older approved proof records predate proofReviewUrls. Keep them active
  // whenever a new product proof is added, rather than treating them as an
  // obsolete version solely because they were uploaded earlier.
  const activeBeforeUpload = [...new Set([...previousReview, ...existingApproved])];
  const mergedLabels = { ...(existing.proofLabels ?? {}) };
  for (const [url, label] of Object.entries(labels ?? {})) {
    if (label?.trim()) mergedLabels[url] = label.trim().slice(0, 60);
  }
  const { reviewUrls, supersededUrls } = options.replaceCurrentReview
    ? {
        reviewUrls: incoming,
        supersededUrls: activeBeforeUpload.filter((url) => !incoming.includes(url)),
      }
    : nextProofReviewUrls({
        previousReview: activeBeforeUpload,
        incoming,
        labels: mergedLabels,
      });
  const supersededProofUrls = [...new Set([
    ...(existing.supersededProofUrls ?? []),
    ...supersededUrls,
    ...activeBeforeUpload.filter((url) => !reviewUrls.includes(url)),
  ])].filter((url) => !reviewUrls.includes(url));
  const approvedDesignUrls = options.replaceCurrentReview
    ? []
    : existingApproved.filter((url) => !supersededProofUrls.includes(url));
  const approvedDesignUrl = approvedDesignUrls[0] ?? null;
  const now = new Date();
  await db
    .update(designRequests)
    .set({
      proofImages: merged,
      proofReviewUrls: reviewUrls,
      supersededProofUrls,
      proofLabels: mergedLabels,
      approvedDesignUrl,
      approvedDesignUrls,
      ...(options.replaceCurrentReview ? { approvedAt: null } : {}),
      status: "proof_sent",
      proofSentAt: now,
      followUpsSent: 0,
      lastFollowUpAt: null,
      followUpSnoozedUntil: null,
      updatedAt: now,
    })
    .where(eq(designRequests.id, id));
  await db
    .update(teamOrders)
    .set({ approvedDesignUrl, updatedAt: now })
    .where(eq(teamOrders.designRequestId, id));
  return merged;
}

/** Remove a single proof image (and its label + any approval of it). */
export async function removeProofImage(id: string, url: string) {
  const db = getDb();
  const [existing] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  if (!existing) return null;
  const proofImages = (existing.proofImages ?? []).filter((u) => u !== url);
  const proofReviewUrls = (existing.proofReviewUrls ?? []).filter((u) => u !== url);
  const supersededProofUrls = (existing.supersededProofUrls ?? []).filter((u) => u !== url);
  const proofLabels = { ...(existing.proofLabels ?? {}) };
  delete proofLabels[url];
  const approvedDesignUrls = (existing.approvedDesignUrls ?? []).filter((u) => u !== url);
  const approvedDesignUrl = existing.approvedDesignUrl === url ? (approvedDesignUrls[0] ?? null) : existing.approvedDesignUrl;
  await db
    .update(designRequests)
    .set({ proofImages, proofReviewUrls, supersededProofUrls, proofLabels, approvedDesignUrls, approvedDesignUrl, updatedAt: new Date() })
    .where(eq(designRequests.id, id));
  return proofImages;
}

/** Client approves one OR MORE proofs (e.g. a jersey + hat + pants set, or
 *  several practice jerseys). The first stays in approvedDesignUrl for older
 *  single-URL surfaces; all of them go in approvedDesignUrls. */
export async function approveDesign(id: string, approvedUrls?: string | string[]) {
  const db = getDb();
  await reactivateUnresponsiveDesignRequest(id);
  const now = new Date();
  const requested = (Array.isArray(approvedUrls) ? approvedUrls : approvedUrls ? [approvedUrls] : []).filter(Boolean);
  const [existing] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  if (!existing) return null;
  // A later product proof can reopen a review while other pieces remain
  // approved. Customer approval of the new piece adds to that set; it never
  // silently unapproves the already-final jersey or hat.
  const current = existing.approvedDesignUrls ?? (existing.approvedDesignUrl ? [existing.approvedDesignUrl] : []);
  const approvedSet = new Set([...current, ...requested]);
  const proofOrder = existing.proofImages ?? [];
  const urls = [...proofOrder.filter((url) => approvedSet.has(url)), ...[...approvedSet].filter((url) => !proofOrder.includes(url))];
  await db
    .update(designRequests)
    .set({
      status: "approved",
      approvedAt: now,
      approvedDesignUrl: urls[0] ?? null,
      approvedDesignUrls: urls.length ? urls : null,
      updatedAt: now,
    })
    .where(eq(designRequests.id, id));
  await db
    .update(teamOrders)
    .set({ approvedDesignUrl: urls[0] ?? null, updatedAt: now })
    .where(eq(teamOrders.designRequestId, id));
}

/** Staff/designer marks a proof as approved (or removes the mark). A project
 *  can have SEVERAL approved designs - jersey, hat, hoodie, pants each get
 *  their own final mockup - so this toggles membership in the approved set
 *  rather than replacing a single value. The set keeps proofImages order;
 *  the first one stays in approvedDesignUrl for older single-URL surfaces
 *  (and is synced onto any linked team orders). */
export async function toggleApprovedDesign(id: string, url: string, approved: boolean) {
  const db = getDb();
  const now = new Date();
  const [existing] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  if (!existing) return null;
  // Staff may intentionally choose an older proof. Keep the customer endpoint
  // current-version-only, but accept any URL that is already known to this
  // request here—never an arbitrary external image.
  const knownProofs = new Set([
    ...(existing.proofImages ?? []),
    ...(existing.proofReviewUrls ?? []),
    ...(existing.supersededProofUrls ?? []),
  ]);
  if (!knownProofs.has(url)) return null;

  const current = existing.approvedDesignUrls ?? (existing.approvedDesignUrl ? [existing.approvedDesignUrl] : []);
  const set = new Set(current);
  if (approved) set.add(url);
  else set.delete(url);
  // Stable order: follow the sent-proofs order, with any strays appended.
  const proofOrder = existing.proofImages ?? [];
  const urls = [...proofOrder.filter((u) => set.has(u)), ...[...set].filter((u) => !proofOrder.includes(u))];
  const primary = urls[0] ?? null;

  await db
    .update(designRequests)
    .set({
      approvedDesignUrls: urls,
      approvedDesignUrl: primary,
      ...(approved ? { approvedAt: existing.approvedAt ?? now } : {}),
      // Approving moves the design forward; never walk "ordered" backwards.
      ...(approved && existing.status !== "ordered" ? { status: "approved" as const } : {}),
      updatedAt: now,
    })
    .where(eq(designRequests.id, id));
  await db
    .update(teamOrders)
    .set({ approvedDesignUrl: primary, updatedAt: now })
    .where(eq(teamOrders.designRequestId, id));
  return { request: existing, urls };
}

/** Max free revision rounds a client gets before the Request Changes
 *  button locks. Cap exists to keep designs from spiraling. */
export const MAX_REVISIONS = 5;

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

  await reactivateUnresponsiveDesignRequest(id);

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

export type DesignMessage = { at: string; from: "designer" | "client"; text: string; name?: string; attachments?: string[] };

/** Append a message to the designer <-> client Q&A thread. Returns the full
 *  updated thread. Messages don't burn a revision. `name` personalizes
 *  designer-side messages ("Gary · Slugger Athletics"). */
export async function addDesignMessage(
  id: string,
  from: DesignMessage["from"],
  text: string,
  name?: string,
  attachments?: string[],
): Promise<DesignMessage[] | null> {
  const db = getDb();
  const [existing] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
  if (!existing) return null;
  if (from === "client") await reactivateUnresponsiveDesignRequest(id);

  const now = new Date();
  const messages = [
    ...(existing.messages ?? []),
    { at: now.toISOString(), from, text, ...(name ? { name } : {}), ...(attachments?.length ? { attachments } : {}) },
  ];
  await db.update(designRequests).set({ messages, updatedAt: now }).where(eq(designRequests.id, id));
  return messages;
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
