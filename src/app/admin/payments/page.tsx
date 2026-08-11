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

export const metadata: Metadata = { title: "Payments", robots: { index: false } };
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

export default async function AdminPaymentsPage() {
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

  const invoices = await db.select().from(customInvoices).orderBy(desc(customInvoices.createdAt)).limit(30);

  // Unified recent-payments feed: team-order deposits/balances (Stripe or
  // recorded offline) and paid add-ons. The old "Recent paid orders" list
  // only read the shop-orders table, so it said "no orders yet" while team
  // invoices were getting paid.
  type PaymentEvent = { at: Date; label: string; sub: string; amountCents: number };
  const paymentEvents: PaymentEvent[] = [];
  const orderById = new Map(torders.map((t) => [t.id, t]));
  for (const t of torders) {
    const offline = t.paymentNote ? " · 💵 offline" : "";
    const total = t.quotedTotalCents ?? 0;
    const dep = t.depositCents ?? Math.round(total / 2);
    const paidInFull = Boolean(
      t.invoicePaidAt && t.depositPaidAt && Math.abs(+t.invoicePaidAt - +t.depositPaidAt) < 60000,
    );
    if (t.depositPaidAt && !paidInFull) {
      paymentEvents.push({ at: t.depositPaidAt, label: t.teamName, sub: `50% deposit · ${t.reference}${offline}`, amountCents: dep });
    }
    if (t.invoicePaidAt) {
      paymentEvents.push({
        at: t.invoicePaidAt,
        label: t.teamName,
        sub: `${paidInFull ? "paid in full" : "final balance"} · ${t.reference}${offline}`,
        amountCents: paidInFull ? total : Math.max(0, total - dep),
      });
    }
  }
  for (const a of paidAddons) {
    if (!a.paidAt) continue;
    const t = orderById.get(a.teamOrderId);
    paymentEvents.push({
      at: a.paidAt,
      label: t?.teamName ?? "Add-on",
      sub: `paid add-on${t ? ` · ${t.reference}` : ""}`,
      amountCents: a.paidTotalCents ?? a.totalCents,
    });
  }
  for (const inv of invoices) {
    if (inv.status === "paid" && inv.paidAt) {
      paymentEvents.push({ at: inv.paidAt, label: inv.customerName, sub: `custom invoice · ${inv.reference}`, amountCents: inv.totalCents });
    }
  }
  // Shop / team-store / buy-in orders (from the orders table) also count as
  // money moments - they were previously invisible in this feed.
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  for (const o of recentOrders) {
    if (o.status !== "paid" && o.status !== "fulfilled") continue;
    const who = o.teamId ? (storeNameById.get(o.teamId) ?? o.customerName ?? "Store order") : (o.customerName ?? "Order");
    const kind = o.type === "team_store" ? "team store" : o.type === "buy_in" ? "buy-in" : "shop";
    paymentEvents.push({ at: o.createdAt, label: who, sub: `${kind} · ${o.reference}`, amountCents: o.totalCents });
  }
  paymentEvents.sort((a, b) => +b.at - +a.at);
  const recentPayments = paymentEvents.slice(0, 40);


  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">💳 Payments</h1>
      <p className="mt-2 text-muted">Every dollar in: deposits, balances, add-ons, custom invoices, and store purchases.</p>
      <div className="mt-6">
        <section className="scroll-mt-16" id="payments">
          <h2 className="display text-xl text-foreground">Recent payments</h2>
          <div className="mt-3 border border-line divide-y divide-[color:var(--line)]">
            {recentPayments.length === 0 && <p className="px-3 py-3 text-sm text-muted">No payments yet.</p>}
            {recentPayments.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <span className="text-foreground">{p.label}</span>
                  <span className="ml-2 text-xs text-muted">{p.sub}</span>
                </div>
                <span className="text-foreground whitespace-nowrap">
                  {money(p.amountCents)} <span className="text-muted text-xs">{fmtDate(p.at)}</span>
                </span>
              </div>
            ))}
          </div>

          {invoices.length > 0 && (
            <>
              <div className="flex items-center justify-between mt-8">
                <h2 className="display text-xl text-foreground">Custom invoices</h2>
                <Link href="/admin/invoice/new" className="text-xs display text-brand hover:underline">+ New invoice</Link>
              </div>
              <div className="mt-3 border border-line divide-y divide-[color:var(--line)]">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div>
                      <span className="font-mono text-xs text-foreground">{inv.reference}</span>
                      <span className="ml-2 text-foreground">{inv.customerName}</span>
                      <span className={`ml-2 text-xs display ${inv.status === "paid" ? "text-green-400" : "text-amber-400"}`}>
                        {inv.status === "paid" ? "PAID" : "SENT"}
                      </span>
                    </div>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-foreground">{money(inv.totalCents)}</span>
                      {inv.status !== "paid" && inv.payUrl && (
                        <a href={inv.payUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted hover:text-foreground">
                          payment link
                        </a>
                      )}
                      <span className="text-muted text-xs">{fmtDate(inv.createdAt)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
