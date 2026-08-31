import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  designRequests,
  orderItems,
  orders,
  smsContacts,
  smsMessages,
  teamOrderRoster,
  teamOrders,
} from "@/db/schema";
import { toE164 } from "@/lib/sms";

export type FollowUpCategory = "due" | "scheduled" | "needs_gary" | "closed" | "archived";
export type FollowUpReasonKind = "roster_incomplete" | "deposit" | "design_fee" | "proof_review" | "approved_no_order";

export type FollowUpReason = {
  kind: FollowUpReasonKind;
  label: string;
  detail: string;
  reference: string;
  sourceAt: string;
  resumeUrl: string | null;
  textMessage: string | null;
};

export type FollowUpOrderHistory = {
  id: string;
  kind: "team" | "shop";
  reference: string;
  status: string;
  teamName: string | null;
  sport: string | null;
  items: string[];
  quantity: number;
  paymentState: string;
  requestedInHandAt: string | null;
  shippedAt: string | null;
  createdAt: string;
  archived: boolean;
};

export type FollowUpDesignHistory = {
  id: string;
  reference: string;
  status: string;
  teamName: string;
  sport: string | null;
  products: string[];
  estimatedPieces: string | null;
  colors: string | null;
  vision: string | null;
  feeState: string;
  neededBy: string | null;
  proofSentAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  archived: boolean;
};

export type ContactFollowUp = {
  phone: string;
  name: string;
  teams: string[];
  category: FollowUpCategory;
  status: string;
  nextFollowUpAt: string | null;
  followUpUpdatedAt: string | null;
  followUpUpdatedBy: string | null;
  doNotCall: boolean;
  reasons: FollowUpReason[];
  orderHistory: FollowUpOrderHistory[];
  designHistory: FollowUpDesignHistory[];
  notes: Array<{ id: string; body: string; staff: string | null; createdAt: string }>;
};

type Candidate = {
  phone: string;
  name: string;
  teams: Set<string>;
  emails: Set<string>;
  reasons: FollowUpReason[];
};

const HOUR = 3_600_000;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com").replace(/\/$/, "");

function pickupText(input: {
  kind: FollowUpReasonKind;
  name: string;
  team: string;
  reference: string;
  url: string | null;
}) {
  if (!input.url) return null;
  const first = input.name.trim().split(/\s+/)[0] || "there";
  const context = input.kind === "roster_incomplete"
    ? `Your ${input.team} design is approved, but the roster for ${input.reference} still needs to be finished.`
    : input.kind === "deposit"
      ? `Your ${input.team} order (${input.reference}) is ready for the deposit.`
      : input.kind === "proof_review"
        ? `Your ${input.team} design proof (${input.reference}) is ready to review.`
        : input.kind === "approved_no_order"
          ? `Your ${input.team} design (${input.reference}) is approved and ready to turn into an order.`
          : `Your ${input.team} design request (${input.reference}) is saved.`;
  return `Hi ${first}, this is Slugger Athletics. ${context} Pick up where you left off here: ${input.url}\nReply STOP to opt out.`;
}

function sourceAt(value: Date | null | undefined, fallback: Date): Date {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : fallback;
}

function addCandidate(
  map: Map<string, Candidate>,
  input: { phone: string | null; email?: string | null; name: string; team: string; reason: FollowUpReason },
) {
  const phone = toE164(input.phone);
  if (!phone) return;
  const email = input.email?.trim().toLowerCase();
  const existing = map.get(phone);
  if (existing) {
    if (input.team.trim()) existing.teams.add(input.team.trim());
    if (email) existing.emails.add(email);
    existing.reasons.push(input.reason);
    return;
  }
  map.set(phone, {
    phone,
    name: input.name.trim() || input.team.trim() || phone,
    teams: new Set(input.team.trim() ? [input.team.trim()] : []),
    emails: new Set(email ? [email] : []),
    reasons: [input.reason],
  });
}

function matchesCandidate(candidate: Candidate, phone: string | null, email: string | null) {
  const normalizedPhone = toE164(phone);
  const normalizedEmail = email?.trim().toLowerCase();
  return normalizedPhone === candidate.phone || Boolean(normalizedEmail && candidate.emails.has(normalizedEmail));
}

/** Build the human call queue from real stalled customer states. It purposely
 * excludes work waiting on Slugger (submitted/in-design/changes requested) so
 * a caller never chases a customer for something our team still owes them. */
export async function getContactFollowUps(now = new Date()): Promise<ContactFollowUp[]> {
  const db = getDb();
  const [teamOrderRows, designs, shopOrders, contacts] = await Promise.all([
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        status: teamOrders.status,
        teamName: teamOrders.teamName,
        contactName: teamOrders.contactName,
        contactEmail: teamOrders.contactEmail,
        contactPhone: teamOrders.contactPhone,
        sport: teamOrders.sport,
        items: teamOrders.items,
        approvedDesignUrl: teamOrders.approvedDesignUrl,
        manageToken: teamOrders.manageToken,
        invoiceUrl: teamOrders.invoiceUrl,
        depositPaidAt: teamOrders.depositPaidAt,
        invoicePaidAt: teamOrders.invoicePaidAt,
        requestedInHandAt: teamOrders.requestedInHandAt,
        shippedAt: teamOrders.shippedAt,
        archivedAt: teamOrders.archivedAt,
        designRequestId: teamOrders.designRequestId,
        submittedAt: teamOrders.submittedAt,
        createdAt: teamOrders.createdAt,
        updatedAt: teamOrders.updatedAt,
      })
      .from(teamOrders),
    db
      .select({
        id: designRequests.id,
        reference: designRequests.reference,
        status: designRequests.status,
        teamName: designRequests.teamName,
        contactName: designRequests.contactName,
        contactEmail: designRequests.contactEmail,
        contactPhone: designRequests.contactPhone,
        statusToken: designRequests.statusToken,
        sport: designRequests.sport,
        productTypes: designRequests.productTypes,
        estimatedPieces: designRequests.estimatedPieces,
        colors: designRequests.colors,
        vision: designRequests.vision,
        neededBy: designRequests.neededBy,
        designFeePaidAt: designRequests.designFeePaidAt,
        designFeeWaivedReason: designRequests.designFeeWaivedReason,
        proofSentAt: designRequests.proofSentAt,
        approvedAt: designRequests.approvedAt,
        archivedAt: designRequests.archivedAt,
        createdAt: designRequests.createdAt,
        updatedAt: designRequests.updatedAt,
      })
      .from(designRequests),
    db
      .select({
        id: orders.id,
        reference: orders.reference,
        type: orders.type,
        status: orders.status,
        customerEmail: orders.customerEmail,
        customerPhone: orders.customerPhone,
        shippedAt: orders.shippedAt,
        archivedAt: orders.archivedAt,
        createdAt: orders.createdAt,
      })
      .from(orders),
    db
      .select({
        phone: smsContacts.phone,
        name: smsContacts.name,
        followUpStatus: smsContacts.followUpStatus,
        nextFollowUpAt: smsContacts.nextFollowUpAt,
        followUpUpdatedAt: smsContacts.followUpUpdatedAt,
        followUpUpdatedBy: smsContacts.followUpUpdatedBy,
        doNotCallAt: smsContacts.doNotCallAt,
      })
      .from(smsContacts),
  ]);

  const activeOrderDesignIds = new Set(
    teamOrderRows
      .filter((order) => !order.archivedAt && order.status !== "cancelled" && order.designRequestId)
      .map((order) => order.designRequestId!),
  );
  const designById = new Map(designs.map((design) => [design.id, design]));
  const candidates = new Map<string, Candidate>();

  for (const order of teamOrderRows) {
    const linkedDesign = order.designRequestId ? designById.get(order.designRequestId) : null;
    const hasApprovedDesign = Boolean(
      order.approvedDesignUrl ||
      linkedDesign?.approvedAt ||
      linkedDesign?.status === "approved" ||
      linkedDesign?.status === "ordered"
    );
    const rosterSourceAt = sourceAt(linkedDesign?.approvedAt, order.updatedAt).getTime() > order.updatedAt.getTime()
      ? linkedDesign!.approvedAt!
      : order.updatedAt;
    if (
      !order.archivedAt &&
      order.status !== "cancelled" &&
      (order.status === "draft" || order.status === "collecting") &&
      !order.submittedAt &&
      hasApprovedDesign &&
      now.getTime() - rosterSourceAt.getTime() >= 24 * HOUR
    ) {
      const resumeUrl = linkedDesign?.statusToken
        ? `${SITE}/design/status/${encodeURIComponent(linkedDesign.statusToken)}#roster`
        : order.manageToken
          ? `${SITE}/team-order/manage/${encodeURIComponent(order.manageToken)}`
          : null;
      addCandidate(candidates, {
        phone: order.contactPhone,
        email: order.contactEmail,
        name: order.contactName,
        team: order.teamName,
        reason: {
          kind: "roster_incomplete",
          label: "Roster not submitted",
          detail: "The design is approved and the order was started, but the final roster has not been submitted",
          reference: order.reference,
          sourceAt: rosterSourceAt.toISOString(),
          resumeUrl,
          textMessage: pickupText({ kind: "roster_incomplete", name: order.contactName, team: order.teamName, reference: order.reference, url: resumeUrl }),
        },
      });
    }
    if (
      order.archivedAt ||
      order.status !== "quoted" ||
      !order.invoiceUrl ||
      order.depositPaidAt ||
      order.invoicePaidAt ||
      now.getTime() - order.updatedAt.getTime() < 48 * HOUR
    ) continue;
    const resumeUrl = order.invoiceUrl;
    addCandidate(candidates, {
      phone: order.contactPhone,
      email: order.contactEmail,
      name: order.contactName,
      team: order.teamName,
      reason: {
        kind: "deposit",
        label: "Deposit not finished",
        detail: "Deposit link was sent at least 2 days ago",
        reference: order.reference,
        sourceAt: order.updatedAt.toISOString(),
        resumeUrl,
        textMessage: pickupText({ kind: "deposit", name: order.contactName, team: order.teamName, reference: order.reference, url: resumeUrl }),
      },
    });
  }

  for (const design of designs) {
    if (design.archivedAt) continue;
    if (
      design.status === "pending_payment" &&
      !design.designFeePaidAt &&
      !design.designFeeWaivedReason &&
      now.getTime() - design.updatedAt.getTime() >= 24 * HOUR
    ) {
      const resumeUrl = design.statusToken
        ? `${SITE}/design/status/${encodeURIComponent(design.statusToken)}`
        : null;
      addCandidate(candidates, {
        phone: design.contactPhone,
        email: design.contactEmail,
        name: design.contactName,
        team: design.teamName,
        reason: {
          kind: "design_fee",
          label: "Design fee not finished",
          detail: "Design intake is waiting for payment",
          reference: design.reference,
          sourceAt: design.updatedAt.toISOString(),
          resumeUrl,
          textMessage: pickupText({ kind: "design_fee", name: design.contactName, team: design.teamName, reference: design.reference, url: resumeUrl }),
        },
      });
    } else if (design.status === "proof_sent") {
      const at = sourceAt(design.proofSentAt, design.updatedAt);
      if (now.getTime() - at.getTime() < 48 * HOUR) continue;
      const resumeUrl = design.statusToken
        ? `${SITE}/design/status/${encodeURIComponent(design.statusToken)}#design`
        : null;
      addCandidate(candidates, {
        phone: design.contactPhone,
        email: design.contactEmail,
        name: design.contactName,
        team: design.teamName,
        reason: {
          kind: "proof_review",
          label: "Proof needs feedback",
          detail: "Design proof has been waiting at least 2 days",
          reference: design.reference,
          sourceAt: at.toISOString(),
          resumeUrl,
          textMessage: pickupText({ kind: "proof_review", name: design.contactName, team: design.teamName, reference: design.reference, url: resumeUrl }),
        },
      });
    } else if (design.status === "approved" && !activeOrderDesignIds.has(design.id)) {
      const at = sourceAt(design.approvedAt, design.updatedAt || design.createdAt);
      if (now.getTime() - at.getTime() < 48 * HOUR) continue;
      const resumeUrl = design.statusToken
        ? `${SITE}/team-order?design=${encodeURIComponent(design.statusToken)}`
        : null;
      addCandidate(candidates, {
        phone: design.contactPhone,
        email: design.contactEmail,
        name: design.contactName,
        team: design.teamName,
        reason: {
          kind: "approved_no_order",
          label: "Approved design, no order",
          detail: "Artwork is approved but the team order was not started",
          reference: design.reference,
          sourceAt: at.toISOString(),
          resumeUrl,
          textMessage: pickupText({ kind: "approved_no_order", name: design.contactName, team: design.teamName, reference: design.reference, url: resumeUrl }),
        },
      });
    }
  }

  const phones = [...candidates.keys()];
  if (phones.length === 0) return [];
  const candidateList = [...candidates.values()];
  const relevantTeamOrderIds = teamOrderRows
    .filter((order) => candidateList.some((candidate) => matchesCandidate(candidate, order.contactPhone, order.contactEmail)))
    .map((order) => order.id);
  const relevantShopOrderIds = shopOrders
    .filter((order) => candidateList.some((candidate) => matchesCandidate(candidate, order.customerPhone, order.customerEmail)))
    .map((order) => order.id);
  const [internalNotes, rosterRows, shopItemRows] = await Promise.all([
    db
      .select({
        id: smsMessages.id,
        phone: smsMessages.phone,
        body: smsMessages.body,
        staff: smsMessages.staff,
        createdAt: smsMessages.createdAt,
      })
      .from(smsMessages)
      .where(and(inArray(smsMessages.phone, phones), eq(smsMessages.direction, "note")))
      .orderBy(desc(smsMessages.createdAt))
      .limit(500),
    relevantTeamOrderIds.length
      ? db
          .select({ teamOrderId: teamOrderRoster.teamOrderId, quantity: teamOrderRoster.quantity })
          .from(teamOrderRoster)
          .where(inArray(teamOrderRoster.teamOrderId, relevantTeamOrderIds))
      : Promise.resolve([]),
    relevantShopOrderIds.length
      ? db
          .select({ orderId: orderItems.orderId, name: orderItems.name, quantity: orderItems.quantity })
          .from(orderItems)
          .where(inArray(orderItems.orderId, relevantShopOrderIds))
      : Promise.resolve([]),
  ]);

  const rosterQuantityByOrder = new Map<string, number>();
  for (const row of rosterRows) {
    rosterQuantityByOrder.set(row.teamOrderId, (rosterQuantityByOrder.get(row.teamOrderId) ?? 0) + row.quantity);
  }
  const shopItemsByOrder = new Map<string, { names: Set<string>; quantity: number }>();
  for (const row of shopItemRows) {
    const item = shopItemsByOrder.get(row.orderId) ?? { names: new Set<string>(), quantity: 0 };
    item.names.add(row.name);
    item.quantity += row.quantity;
    shopItemsByOrder.set(row.orderId, item);
  }

  const contactByPhone = new Map(contacts.map((contact) => [contact.phone, contact]));
  const notesByPhone = new Map<string, ContactFollowUp["notes"]>();
  for (const note of internalNotes) {
    const list = notesByPhone.get(note.phone) ?? [];
    if (list.length < 8) {
      list.push({
        id: note.id,
        body: note.body,
        staff: note.staff,
        createdAt: note.createdAt.toISOString(),
      });
      notesByPhone.set(note.phone, list);
    }
  }

  const categoryRank: Record<FollowUpCategory, number> = { due: 0, needs_gary: 1, scheduled: 2, closed: 3, archived: 4 };
  const result = [...candidates.values()].map((candidate): ContactFollowUp => {
    const contact = contactByPhone.get(candidate.phone);
    const hasNewSource = Boolean(
      contact?.followUpUpdatedAt &&
      candidate.reasons.some((reason) => new Date(reason.sourceAt).getTime() > contact.followUpUpdatedAt!.getTime()),
    );
    const savedStatus = contact?.followUpStatus ?? "active";
    const status = contact?.doNotCallAt ? "do_not_call" : savedStatus === "closed" && hasNewSource ? "active" : savedStatus;
    const category: FollowUpCategory =
      status === "archived"
        ? "archived"
        : status === "closed" || status === "do_not_call"
        ? "closed"
        : status === "needs_gary"
          ? "needs_gary"
          : contact?.nextFollowUpAt && contact.nextFollowUpAt.getTime() > now.getTime()
            ? "scheduled"
            : "due";
    const orderHistory: FollowUpOrderHistory[] = [
      ...teamOrderRows
        .filter((order) => matchesCandidate(candidate, order.contactPhone, order.contactEmail))
        .map((order): FollowUpOrderHistory => ({
          id: order.id,
          kind: "team",
          reference: order.reference,
          status: order.status,
          teamName: order.teamName,
          sport: order.sport,
          items: order.items ?? [],
          quantity: rosterQuantityByOrder.get(order.id) ?? 0,
          paymentState: order.invoicePaidAt || order.status === "paid" || order.status === "shipped"
            ? "Paid in full"
            : order.depositPaidAt
              ? "Deposit paid"
              : order.invoiceUrl
                ? "Awaiting deposit"
                : "Not invoiced",
          requestedInHandAt: order.requestedInHandAt?.toISOString() ?? null,
          shippedAt: order.shippedAt?.toISOString() ?? null,
          createdAt: order.createdAt.toISOString(),
          archived: Boolean(order.archivedAt),
        })),
      ...shopOrders
        .filter((order) => matchesCandidate(candidate, order.customerPhone, order.customerEmail))
        .map((order): FollowUpOrderHistory => {
          const item = shopItemsByOrder.get(order.id);
          return {
            id: order.id,
            kind: "shop",
            reference: order.reference,
            status: order.status,
            teamName: null,
            sport: null,
            items: item ? [...item.names] : [order.type.replaceAll("_", " ")],
            quantity: item?.quantity ?? 0,
            paymentState: order.status === "paid" || order.status === "fulfilled"
              ? "Paid"
              : order.status === "pending"
                ? "Payment pending"
                : order.status.replaceAll("_", " "),
            requestedInHandAt: null,
            shippedAt: order.shippedAt?.toISOString() ?? null,
            createdAt: order.createdAt.toISOString(),
            archived: Boolean(order.archivedAt),
          };
        }),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const designHistory: FollowUpDesignHistory[] = designs
      .filter((design) => matchesCandidate(candidate, design.contactPhone, design.contactEmail))
      .map((design) => ({
        id: design.id,
        reference: design.reference,
        status: design.status,
        teamName: design.teamName,
        sport: design.sport,
        products: design.productTypes ?? [],
        estimatedPieces: design.estimatedPieces,
        colors: design.colors,
        vision: design.vision?.trim().slice(0, 500) || null,
        feeState: design.designFeePaidAt
          ? "Design fee paid"
          : design.designFeeWaivedReason
            ? "Design fee waived"
            : "Design fee unpaid",
        neededBy: design.neededBy?.toISOString() ?? null,
        proofSentAt: design.proofSentAt?.toISOString() ?? null,
        approvedAt: design.approvedAt?.toISOString() ?? null,
        createdAt: design.createdAt.toISOString(),
        archived: Boolean(design.archivedAt),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      phone: candidate.phone,
      name: candidate.name || contact?.name || candidate.phone,
      teams: [...candidate.teams],
      category,
      status,
      nextFollowUpAt: contact?.nextFollowUpAt?.toISOString() ?? null,
      followUpUpdatedAt: contact?.followUpUpdatedAt?.toISOString() ?? null,
      followUpUpdatedBy: contact?.followUpUpdatedBy ?? null,
      doNotCall: Boolean(contact?.doNotCallAt),
      reasons: candidate.reasons.sort((a, b) => a.sourceAt.localeCompare(b.sourceAt)),
      orderHistory,
      designHistory,
      notes: notesByPhone.get(candidate.phone) ?? [],
    };
  });

  return result.sort((a, b) => {
    const category = categoryRank[a.category] - categoryRank[b.category];
    if (category) return category;
    if (a.category === "scheduled") return (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? "");
    return a.reasons[0].sourceAt.localeCompare(b.reasons[0].sourceAt);
  });
}
