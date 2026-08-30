import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, isNotNull, isNull, sql } from "drizzle-orm";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
  AdminDesignRequestWorkspace,
  type AdminDesignRequestListItem,
} from "@/components/admin-design-request-workspace";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders } from "@/db/schema";
import { adminEnabled, isAdmin } from "@/lib/admin-auth";
import { designNeedsAction } from "@/lib/design-requests";

export const metadata: Metadata = { title: "Design Requests", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminDesignRequestsPage() {
  if (!adminEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Set ADMIN_PASSWORD to enable the dashboard.</div>;
  }
  if (!(await isAdmin())) redirect("/admin/login");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const db = getDb();
  const [designs, linkedOrders] = await Promise.all([
    db
      .select({
        id: designRequests.id,
        reference: designRequests.reference,
        teamName: designRequests.teamName,
        status: designRequests.status,
        contactName: designRequests.contactName,
        contactEmail: designRequests.contactEmail,
        revisionsUsed: designRequests.revisionsUsed,
        neededBy: designRequests.neededBy,
        lastMessage: sql<{ from?: string; name?: string; at?: string } | null>`${designRequests.messages} -> -1`,
        source: designRequests.source,
        archivedAt: designRequests.archivedAt,
        archivedNote: designRequests.archivedNote,
        approvedDesignUrl: designRequests.approvedDesignUrl,
        galleryHidden: designRequests.galleryHidden,
        followedUpAt: designRequests.followedUpAt,
        proofSentAt: designRequests.proofSentAt,
        followUpsSent: designRequests.followUpsSent,
        lastFollowUpAt: designRequests.lastFollowUpAt,
        followUpSnoozedUntil: designRequests.followUpSnoozedUntil,
        updatedAt: designRequests.updatedAt,
      })
      .from(designRequests)
      .orderBy(desc(designRequests.updatedAt)),
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        status: teamOrders.status,
        designRequestId: teamOrders.designRequestId,
      })
      .from(teamOrders)
      .where(and(isNotNull(teamOrders.designRequestId), isNull(teamOrders.archivedAt)))
      .orderBy(desc(teamOrders.updatedAt)),
  ]);

  const orderByDesign = new Map<string, (typeof linkedOrders)[number]>();
  for (const order of linkedOrders) {
    if (order.designRequestId && !orderByDesign.has(order.designRequestId)) {
      orderByDesign.set(order.designRequestId, order);
    }
  }

  const items: AdminDesignRequestListItem[] = designs.map((design) => {
    const linkedOrder = orderByDesign.get(design.id);
    return {
      id: design.id,
      reference: design.reference,
      teamName: design.teamName,
      status: design.status,
      contactName: design.contactName,
      contactEmail: design.contactEmail,
      revisionsUsed: design.revisionsUsed ?? 0,
      neededBy: design.neededBy?.toISOString() ?? null,
      lastMessage: design.lastMessage,
      source: design.source,
      archivedAt: design.archivedAt?.toISOString() ?? null,
      archivedNote: design.archivedNote,
      hasApprovedDesign: Boolean(design.approvedDesignUrl),
      galleryHidden: design.galleryHidden,
      followedUpAt: design.followedUpAt?.toISOString() ?? null,
      proofSentAt: design.proofSentAt?.toISOString() ?? null,
      followUpsSent: design.followUpsSent ?? 0,
      lastFollowUpAt: design.lastFollowUpAt?.toISOString() ?? null,
      followUpSnoozedUntil: design.followUpSnoozedUntil?.toISOString() ?? null,
      updatedAt: design.updatedAt.toISOString(),
      needsAction: designNeedsAction(design),
      linkedOrder: linkedOrder
        ? { id: linkedOrder.id, reference: linkedOrder.reference, status: linkedOrder.status }
        : null,
    };
  });

  const activeCount = items.filter((item) => !item.archivedAt).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <AdminPageHeader eyebrow="Operations" title={`Design Requests (${activeCount})`} />
      <AdminDesignRequestWorkspace items={items} now={new Date().toISOString()} />
    </div>
  );
}
