import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests, smsContacts, smsMessages, teamOrders } from "@/db/schema";
import { toE164 } from "@/lib/sms";

export type FollowUpCategory = "due" | "scheduled" | "needs_gary" | "closed";
export type FollowUpReasonKind = "deposit" | "design_fee" | "proof_review" | "approved_no_order";

export type FollowUpReason = {
  kind: FollowUpReasonKind;
  label: string;
  detail: string;
  reference: string;
  sourceAt: string;
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
  notes: Array<{ id: string; body: string; staff: string | null; createdAt: string }>;
};

type Candidate = {
  phone: string;
  name: string;
  teams: Set<string>;
  reasons: FollowUpReason[];
};

const HOUR = 3_600_000;

function sourceAt(value: Date | null | undefined, fallback: Date): Date {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : fallback;
}

function addCandidate(
  map: Map<string, Candidate>,
  input: { phone: string | null; name: string; team: string; reason: FollowUpReason },
) {
  const phone = toE164(input.phone);
  if (!phone) return;
  const existing = map.get(phone);
  if (existing) {
    if (input.team.trim()) existing.teams.add(input.team.trim());
    existing.reasons.push(input.reason);
    return;
  }
  map.set(phone, {
    phone,
    name: input.name.trim() || input.team.trim() || phone,
    teams: new Set(input.team.trim() ? [input.team.trim()] : []),
    reasons: [input.reason],
  });
}

/** Build the human call queue from real stalled customer states. It purposely
 * excludes work waiting on Slugger (submitted/in-design/changes requested) so
 * a caller never chases a customer for something our team still owes them. */
export async function getContactFollowUps(now = new Date()): Promise<ContactFollowUp[]> {
  const db = getDb();
  const [orders, designs, contacts] = await Promise.all([
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        status: teamOrders.status,
        teamName: teamOrders.teamName,
        contactName: teamOrders.contactName,
        contactPhone: teamOrders.contactPhone,
        invoiceUrl: teamOrders.invoiceUrl,
        depositPaidAt: teamOrders.depositPaidAt,
        invoicePaidAt: teamOrders.invoicePaidAt,
        archivedAt: teamOrders.archivedAt,
        designRequestId: teamOrders.designRequestId,
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
        contactPhone: designRequests.contactPhone,
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
    orders
      .filter((order) => !order.archivedAt && order.status !== "cancelled" && order.designRequestId)
      .map((order) => order.designRequestId!),
  );
  const candidates = new Map<string, Candidate>();

  for (const order of orders) {
    if (
      order.archivedAt ||
      order.status !== "quoted" ||
      !order.invoiceUrl ||
      order.depositPaidAt ||
      order.invoicePaidAt ||
      now.getTime() - order.updatedAt.getTime() < 48 * HOUR
    ) continue;
    addCandidate(candidates, {
      phone: order.contactPhone,
      name: order.contactName,
      team: order.teamName,
      reason: {
        kind: "deposit",
        label: "Deposit not finished",
        detail: "Deposit link was sent at least 2 days ago",
        reference: order.reference,
        sourceAt: order.updatedAt.toISOString(),
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
      addCandidate(candidates, {
        phone: design.contactPhone,
        name: design.contactName,
        team: design.teamName,
        reason: {
          kind: "design_fee",
          label: "Design fee not finished",
          detail: "Design intake is waiting for payment",
          reference: design.reference,
          sourceAt: design.updatedAt.toISOString(),
        },
      });
    } else if (design.status === "proof_sent") {
      const at = sourceAt(design.proofSentAt, design.updatedAt);
      if (now.getTime() - at.getTime() < 48 * HOUR) continue;
      addCandidate(candidates, {
        phone: design.contactPhone,
        name: design.contactName,
        team: design.teamName,
        reason: {
          kind: "proof_review",
          label: "Proof needs feedback",
          detail: "Design proof has been waiting at least 2 days",
          reference: design.reference,
          sourceAt: at.toISOString(),
        },
      });
    } else if (design.status === "approved" && !activeOrderDesignIds.has(design.id)) {
      const at = sourceAt(design.approvedAt, design.updatedAt || design.createdAt);
      if (now.getTime() - at.getTime() < 48 * HOUR) continue;
      addCandidate(candidates, {
        phone: design.contactPhone,
        name: design.contactName,
        team: design.teamName,
        reason: {
          kind: "approved_no_order",
          label: "Approved design, no order",
          detail: "Artwork is approved but the team order was not started",
          reference: design.reference,
          sourceAt: at.toISOString(),
        },
      });
    }
  }

  const phones = [...candidates.keys()];
  if (phones.length === 0) return [];
  const internalNotes = await db
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
    .limit(500);

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

  const categoryRank: Record<FollowUpCategory, number> = { due: 0, needs_gary: 1, scheduled: 2, closed: 3 };
  const result = [...candidates.values()].map((candidate): ContactFollowUp => {
    const contact = contactByPhone.get(candidate.phone);
    const hasNewSource = Boolean(
      contact?.followUpUpdatedAt &&
      candidate.reasons.some((reason) => new Date(reason.sourceAt).getTime() > contact.followUpUpdatedAt!.getTime()),
    );
    const savedStatus = contact?.followUpStatus ?? "active";
    const status = contact?.doNotCallAt ? "do_not_call" : savedStatus === "closed" && hasNewSource ? "active" : savedStatus;
    const category: FollowUpCategory =
      status === "closed" || status === "do_not_call"
        ? "closed"
        : status === "needs_gary"
          ? "needs_gary"
          : contact?.nextFollowUpAt && contact.nextFollowUpAt.getTime() > now.getTime()
            ? "scheduled"
            : "due";
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
