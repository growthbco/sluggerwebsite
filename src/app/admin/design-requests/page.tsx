import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin-page-header";
import { desc, sql, eq, isNotNull, isNull } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders, teams, orders, teamOrderAddons, assistantFacts, customInvoices, designLabVisitors } from "@/db/schema";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { designNeedsAction } from "@/lib/design-requests";
import { FollowedUpButton } from "@/components/admin-followed-up-button";
import { getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote, estimateOrderWeightOz } from "@/lib/team-order-pricing";
import { sizeBreakdown, ITEM_TYPES } from "@/lib/order-items";
import { shippingCentsFor } from "@/lib/team-stores";
import { getLiveTracking, type LiveTracking } from "@/lib/shippo";
import { AdminLogout } from "@/components/admin-logout";
import { AdminInvoiceButton } from "@/components/admin-invoice-button";
import { AdminJerseyStyle } from "@/components/admin-jersey-style";
import { AdminPipeline } from "@/components/admin-pipeline";
import { AdminLinkDesign } from "@/components/admin-link-design";
import { AdminDesignerNote } from "@/components/admin-designer-note";
import { AdminShipButton } from "@/components/admin-ship-button";
import { AdminLabelButton } from "@/components/admin-label-button";
import { TrackingInfo } from "@/components/tracking-info";
import { inboundTrackingUrlFor } from "@/lib/tracking";
import { AdminAddonDetails } from "@/components/admin-addon-details";
import { AdminArchiveButton } from "@/components/admin-archive-button";
import { AdminGalleryToggle } from "@/components/admin-gallery-toggle";
import { AdminLocalToggle } from "@/components/admin-local-toggle";
import { AdminTaxToggle } from "@/components/admin-tax-toggle";
import { DesignRequestFilter } from "@/components/design-request-filter";
import { AdminNewStore } from "@/components/admin-new-store";
import { AdminRecordPayment } from "@/components/admin-record-payment";
import { AdminPickupToggle } from "@/components/admin-pickup-toggle";
import { AdminRowMenu } from "@/components/admin-row-menu";
import { AdminCustomPrice } from "@/components/admin-custom-price";
import { AdminInboundTracking } from "@/components/admin-inbound-tracking";
import { MarkStaffDevice } from "@/components/mark-staff-device";
import { STORE_ITEM_PRESETS } from "@/lib/team-stores";

export const metadata: Metadata = { title: "Design Requests", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  pending_payment: "border-amber-500/50 text-amber-400",
  submitted: "border-brand/50 text-brand",
  in_design: "border-brand/50 text-brand",
  proof_sent: "border-sky-500/50 text-sky-400",
  changes_requested: "border-amber-500/50 text-amber-400",
  approved: "border-green-500/50 text-green-400",
  ordered: "border-green-500/50 text-green-400",
  cancelled: "border-line text-muted",
  // team orders
  draft: "border-line text-muted",
  collecting: "border-brand/50 text-brand",
  quoted: "border-amber-500/50 text-amber-400",
  in_production: "border-sky-500/50 text-sky-400",
  paid: "border-green-500/50 text-green-400",
  shipped: "border-green-500/50 text-green-400",
};

function Badge({ label }: { label: string }) {
  return (
    <span className={`inline-block border rounded-full px-2.5 py-0.5 text-xs display whitespace-nowrap ${STATUS_TONE[label] ?? "border-line text-muted"}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
// Compact source for table cells ("Google (ad) → /pricing" -> "Google (ad)");
// the full string stays in the hover tooltip.
const srcShort = (s: string | null | undefined) => (s ? s.split(" → ")[0] : "-");

export default async function AdminDesignRequestsPage() {
  if (!adminEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Set ADMIN_PASSWORD to enable the dashboard.</div>;
  }
  if (!(await isAdmin())) redirect("/admin/login");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const db = getDb();
  const [designs, torders, stores, recentOrders, paidAddons] = await Promise.all([
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
        // Just the last thread message (jsonb `-> -1`), not the whole array -
        // all this list needs is who spoke last.
        lastMessage: sql<{ from?: string; name?: string; at?: string } | null>`${designRequests.messages} -> -1`,
        source: designRequests.source,
        manageToken: designRequests.manageToken,
        archivedAt: designRequests.archivedAt,
        archivedNote: designRequests.archivedNote,
        approvedDesignUrl: designRequests.approvedDesignUrl,
        galleryHidden: designRequests.galleryHidden,
        followedUpAt: designRequests.followedUpAt,
        updatedAt: designRequests.updatedAt,
      })
      .from(designRequests)
      .orderBy(desc(designRequests.updatedAt)),
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        teamName: teamOrders.teamName,
        status: teamOrders.status,
        contactEmail: teamOrders.contactEmail,
        manageToken: teamOrders.manageToken,
        jerseyStyle: teamOrders.jerseyStyle,
        rushShipping: teamOrders.rushShipping,
        localPricing: teamOrders.localPricing,
        embroideryFeeWaived: teamOrders.embroideryFeeWaived,
        taxExempt: teamOrders.taxExempt,
        designRequestId: teamOrders.designRequestId,
        designerNote: teamOrders.designerNote,
        source: teamOrders.source,
        printFileVerifiedAt: teamOrders.printFileVerifiedAt,
        quotedTotalCents: teamOrders.quotedTotalCents,
        invoiceUrl: teamOrders.invoiceUrl,
        depositCents: teamOrders.depositCents,
        depositPaidAt: teamOrders.depositPaidAt,
        balanceInvoiceUrl: teamOrders.balanceInvoiceUrl,
        invoicePaidAt: teamOrders.invoicePaidAt,
        trackingNumber: teamOrders.trackingNumber,
        labelUrl: teamOrders.labelUrl,
        shippedAt: teamOrders.shippedAt,
        shippingChargedCents: teamOrders.shippingChargedCents,
        paymentNote: teamOrders.paymentNote,
        localPickup: teamOrders.localPickup,
        customJerseyCents: teamOrders.customJerseyCents,
        inboundCarrier: teamOrders.inboundCarrier,
        inboundTrackingNumber: teamOrders.inboundTrackingNumber,
        inboundTrackingAddedAt: teamOrders.inboundTrackingAddedAt,
        archivedAt: teamOrders.archivedAt,
        archivedNote: teamOrders.archivedNote,
        updatedAt: teamOrders.updatedAt,
      })
      .from(teamOrders)
      .orderBy(desc(teamOrders.updatedAt)),
    db
      .select({
        id: teams.id,
        name: teams.name,
        storeActive: teams.storeActive,
        storeToken: teams.storeToken,
      })
      .from(teams)
      .orderBy(desc(teams.createdAt)),
    db
      .select({
        id: orders.id,
        reference: orders.reference,
        type: orders.type,
        status: orders.status,
        customerName: orders.customerName,
        totalCents: orders.totalCents,
        trackingNumber: orders.trackingNumber,
        labelUrl: orders.labelUrl,
        shippedAt: orders.shippedAt,
        createdAt: orders.createdAt,
        teamId: orders.teamId,
        source: orders.source,
      })
      .from(orders)
      .where(isNull(orders.archivedAt))
      .orderBy(desc(orders.createdAt))
      .limit(60),
    db
      .select({
        teamOrderId: teamOrderAddons.teamOrderId,
        rows: teamOrderAddons.rows,
        totalCents: teamOrderAddons.totalCents,
        paidTotalCents: teamOrderAddons.paidTotalCents,
        paidAt: teamOrderAddons.paidAt,
      })
      .from(teamOrderAddons)
      .where(eq(teamOrderAddons.status, "paid"))
      .orderBy(desc(teamOrderAddons.paidAt)),
  ]);
  void stores; void recentOrders; void torders; void paidAddons;

  const activeDesigns = designs.filter((d) => !d.archivedAt);
  // Designs a standalone order can be manually linked to.
  const linkableDesigns = activeDesigns.map((d) => ({ id: d.id, teamName: d.teamName, reference: d.reference }));
  const archivedDesigns = designs.filter((d) => d.archivedAt);
  const activeOrders = torders.filter((o) => !o.archivedAt);
  const archivedOrders = torders.filter((o) => o.archivedAt);

  // "Waiting on us" = the design work still needs Slugger (shared rule; a staff
  // "followed up" mark clears it until the customer replies again).
  const needsAction = activeDesigns.filter((d) => designNeedsAction(d));

  // Status chips for the filter, in pipeline order, only those present.
  const STATUS_ORDER = ["submitted", "proof_sent", "changes_requested", "approved", "ordered", "draft", "cancelled"];
  const statusTally = activeDesigns.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const statusCounts = Object.keys(statusTally)
    .sort((a, b) => {
      const ia = STATUS_ORDER.indexOf(a), ib = STATUS_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map((value) => ({ value, label: value.replace(/_/g, " "), count: statusTally[value] }));


  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <AdminPageHeader eyebrow="Operations" title={`Design Requests (${activeDesigns.length})`} />
      {needsAction.length > 0 && (
        <p className="mt-3 text-sm text-amber-400">
          {needsAction.length} design{needsAction.length === 1 ? "" : "s"} waiting on us:{" "}
          {needsAction.map((d) => d.teamName.trim()).join(", ")}
        </p>
      )}

      <DesignRequestFilter total={activeDesigns.length} statuses={statusCounts} />

      <section className="mt-6 scroll-mt-16" id="design-requests">
        <div className="overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-steel text-left text-xs text-muted uppercase tracking-wide">
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2 text-muted/60">Rev</th>
                <th className="px-3 py-2 whitespace-nowrap">Needed by</th>
                <th className="px-3 py-2 whitespace-nowrap">Last msg</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {activeDesigns.map((d) => {
                const lastMsg = d.lastMessage;
                return (
                  <tr
                    key={d.reference}
                    className="hover:bg-steel/60"
                    data-section="designs"
                    data-status={d.status}
                    data-search={`${d.teamName} ${d.reference} ${d.contactName} ${d.contactEmail}`.toLowerCase()}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/admin/design-requests/${d.id}`} className="text-brand hover:underline">
                        {d.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">{d.teamName}</td>
                    <td className="px-3 py-2"><Badge label={d.status} /></td>
                    <td className="px-3 py-2 text-muted">{d.contactName}</td>
                    <td className="px-3 py-2 text-muted whitespace-nowrap" title={d.source ?? "unknown (pre-tracking)"}>{srcShort(d.source)}</td>
                    <td className="px-3 py-2 text-xs text-muted/50 tabular-nums">{d.revisionsUsed ?? 0}/5</td>
                    <td className="px-3 py-2 text-muted">{fmtDate(d.neededBy)}</td>
                    <td className="px-3 py-2 text-muted">
                      {lastMsg ? (lastMsg.from === "client" ? "client waiting" : lastMsg.name ?? "staff") : "-"}
                    </td>
                    <td className="px-3 py-2 text-muted">{fmtDate(d.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 justify-end">
                        {(designNeedsAction(d) || d.followedUpAt) && (
                          <FollowedUpButton id={d.id} followedUp={Boolean(d.followedUpAt)} />
                        )}
                        {d.status === "approved" && d.approvedDesignUrl && (
                          <AdminGalleryToggle designId={d.id} hidden={d.galleryHidden} />
                        )}
                        <AdminArchiveButton kind="design_request" id={d.id} archived={false} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>


      {archivedDesigns.length > 0 && (
        <details className="mt-6 border border-line bg-steel/50 group">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 list-none">
            <span className="display text-sm text-muted">Archived design requests ({archivedDesigns.length})</span>
            <span className="text-brand transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="divide-y divide-[color:var(--line)] border-t border-line">
            {archivedDesigns.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <Link href={`/admin/design-requests/${d.id}`} className="font-mono text-xs text-brand hover:underline">
                    {d.reference}
                  </Link>
                  <span className="ml-2 text-foreground">{d.teamName}</span>
                  <span className="ml-2 text-muted">{d.contactName}</span>
                  {d.archivedNote && <span className="ml-2 text-xs text-amber-400/90">&quot;{d.archivedNote}&quot;</span>}
                  <span className="ml-2 text-xs text-muted">archived {fmtDate(d.archivedAt)}</span>
                </div>
                <AdminArchiveButton kind="design_request" id={d.id} archived={true} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
