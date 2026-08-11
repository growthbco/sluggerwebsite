import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, sql, eq, isNotNull, isNull } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders, teams, orders, teamOrderAddons, assistantFacts, customInvoices, designLabVisitors } from "@/db/schema";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
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
import { AdminLocalToggle } from "@/components/admin-local-toggle";
import { AdminTaxToggle } from "@/components/admin-tax-toggle";
import { AdminSearch } from "@/components/admin-search";
import { AdminNewStore } from "@/components/admin-new-store";
import { AdminRecordPayment } from "@/components/admin-record-payment";
import { AdminPickupToggle } from "@/components/admin-pickup-toggle";
import { AdminRowMenu } from "@/components/admin-row-menu";
import { AdminCustomPrice } from "@/components/admin-custom-price";
import { AdminInboundTracking } from "@/components/admin-inbound-tracking";
import { MarkStaffDevice } from "@/components/mark-staff-device";
import { STORE_ITEM_PRESETS } from "@/lib/team-stores";

export const metadata: Metadata = { title: "Awaiting Payment", robots: { index: false } };
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
    <span className={`inline-block border px-2 py-0.5 text-xs display ${STATUS_TONE[label] ?? "border-line text-muted"}`}>
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

export default async function AdminAwaitingPaymentPage() {
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
        messages: designRequests.messages,
        source: designRequests.source,
        manageToken: designRequests.manageToken,
        archivedAt: designRequests.archivedAt,
        archivedNote: designRequests.archivedNote,
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
  void stores; void recentOrders; void designs; void paidAddons;

  const activeOrders = torders.filter((o) => !o.archivedAt);
  const now = new Date();
  // Outstanding invoices: an invoice was sent but the money isn't fully in.
  const outstanding = activeOrders
    .filter((o) => o.invoiceUrl && !o.invoicePaidAt)
    .map((o) => {
      const total = o.quotedTotalCents ?? 0;
      const deposit = o.depositCents ?? Math.round(total / 2);
      const stage = o.depositPaidAt ? "balance" : "deposit";
      const goodsDue = stage === "deposit" ? deposit : total - deposit;
      const due = o.taxExempt ? goodsDue : goodsDue + Math.round(goodsDue * 0.07);
      return { id: o.id, ref: o.reference, team: o.teamName.trim(), stage, due, token: o.manageToken, since: o.updatedAt };
    })
    .filter((o) => o.due > 0);
  const outstandingTotal = outstanding.reduce((s, o) => s + o.due, 0);
  const daysAgo = (d: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">💸 Awaiting Payment ({outstanding.length})</h1>
      <p className="mt-2 text-muted">Every invoice that's out the door with money still due - {money(outstandingTotal)} total.</p>

      <div className="mt-6 border border-amber-500/40 divide-y divide-[color:var(--line)]">
        {outstanding.length === 0 && <p className="px-4 py-6 text-sm text-muted">Nothing outstanding - everyone's paid up. 🎉</p>}
        {outstanding.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span>
              <Link href={`/admin/team-order/${o.id}`} className="font-mono text-xs text-brand hover:underline">{o.ref}</Link>
              <span className="ml-2 text-foreground">{o.team}</span>
              <span className="ml-2 text-xs text-muted">{o.stage} · sent {daysAgo(o.since)}d ago</span>
            </span>
            <span className="display text-foreground">{money(o.due)} due</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Reminder emails/texts go out automatically after 3 days, then 4 more (max 2 per invoice).</p>
    </div>
  );
}
