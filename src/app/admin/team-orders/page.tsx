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

export const metadata: Metadata = { title: "Team Orders", robots: { index: false } };
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

export default async function AdminTeamOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!adminEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Set ADMIN_PASSWORD to enable the dashboard.</div>;
  }
  if (!(await isAdmin())) redirect("/admin/login");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const db = getDb();
  const { status: initialStatus } = await searchParams;

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
  void stores; void recentOrders;

  // Paid add-ons grouped by their parent team order, so each order can show
  // the extra players (name / # / size) that were added after the fact.
  type AddonView = { rows: typeof paidAddons[number]["rows"]; totalCents: number; paidTotalCents: number | null };
  const addonsByOrder = new Map<string, AddonView[]>();
  for (const a of paidAddons) {
    const list = addonsByOrder.get(a.teamOrderId) ?? [];
    list.push({ rows: a.rows, totalCents: a.totalCents, paidTotalCents: a.paidTotalCents });
    addonsByOrder.set(a.teamOrderId, list);
  }

  const activeDesigns = designs.filter((d) => !d.archivedAt);
  // Designs a standalone order can be manually linked to.
  const linkableDesigns = activeDesigns.map((d) => ({ id: d.id, teamName: d.teamName, reference: d.reference }));
  const archivedDesigns = designs.filter((d) => d.archivedAt);
  const activeOrders = torders.filter((o) => !o.archivedAt);
  const archivedOrders = torders.filter((o) => o.archivedAt);

  // Price each unpaid team order from its roster so "Send invoice" can show
  // the number upfront, and count in-house pieces (hats we embroider in
  // Ocala) so they stay visible until shipped - the factory shipment won't
  // contain them. Roster fetches are per-order but the list is small.
  const orderEstimates = new Map<string, number>();
  // Shipping estimate (formula: carrier cost from roster weight + margin).
  // The real number comes from a live rate when the balance invoice is sent;
  // this keeps the expected charge visible up front. Pickup = $0.
  const shipEstimates = new Map<string, number>();
  const inHouseWork = new Map<string, string>(); // order id -> "11× Snapback Hat"
  // Orders with any name/number on the roster need print-file QA before
  // production; plain-gear orders skip that gate entirely.
  const personalizedOrders = new Set<string>();
  for (const o of activeOrders) {
    try {
      const roster = await getRoster(o.id);
      if (!roster.length) continue;
      if (roster.some((r) => (r.playerName ?? "").trim() || (r.playerNumber ?? "").trim())) {
        personalizedOrders.add(o.id);
      }
      if (!(o.status === "paid" || o.invoicePaidAt)) {
        orderEstimates.set(o.id, computeTeamOrderQuote(o, roster).totalCents);
        const weightOz = estimateOrderWeightOz(roster);
        if (weightOz > 0) shipEstimates.set(o.id, shippingCentsFor(weightOz));
      }
      if (!o.shippedAt) {
        // In-house items (hats) broken down BY SIZE so staff can order blanks:
        // e.g. "Fitted Hat: 5 S/M, 2 L/XL, 3 XXL".
        const inHouseKeys = ITEM_TYPES.filter((t) => t.inHouse).map((t) => t.key);
        const bd = sizeBreakdown(roster, inHouseKeys);
        if (bd.length) {
          inHouseWork.set(
            o.id,
            bd.map((b) => `${b.label}: ${b.parts.map((p) => `${p.n} ${p.size}`).join(", ")} (${b.total})`).join(" · "),
          );
        }
      }
    } catch {}
  }

  // Live carrier status for inbound (factory -> shop) shipments, fetched
  // in parallel and cached a few minutes in the Shippo lib. Best-effort:
  // a miss just means the row shows the link without a status line.
  const inboundLive = new Map<string, LiveTracking>();
  await Promise.all(
    activeOrders
      .filter((o) => o.inboundTrackingNumber)
      .map(async (o) => {
        const t = await getLiveTracking(o.inboundCarrier, o.inboundTrackingNumber!);
        if (t) inboundLive.set(o.id, t);
      }),
  );


  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">📦 Team Orders ({activeOrders.length})</h1>
      <p className="mt-2 text-muted">Quote-first team orders through the whole pipeline: roster → invoice → production → shipped.</p>

      <div className="mt-6">
        <AdminPipeline
          counts={activeOrders.reduce((acc, o) => {
            acc[o.status] = (acc[o.status] ?? 0) + 1;
            return acc;
          }, {} as Record<string, number>)}
        />
      </div>

      <AdminSearch statuses={Array.from(new Set(activeOrders.map((o) => o.status)))} initialStatus={initialStatus} />

      <section className="mt-6 scroll-mt-16" id="team-orders">
        <h2 className="display text-xl text-foreground">Team orders ({activeOrders.length})</h2>
        <div className="mt-3 overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-steel text-left text-xs text-muted uppercase">
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {activeOrders.map((o) => {
                const estimate = o.quotedTotalCents ?? orderEstimates.get(o.id);
                const paid = Boolean(o.invoicePaidAt) || o.status === "paid" || o.status === "shipped";
                const deposit = o.depositCents ?? (estimate ? Math.round(estimate / 2) : 0);
                return (
                  <tr
                    key={o.reference}
                    className="hover:bg-steel/60"
                    data-section="orders"
                    data-status={o.status}
                    data-search={`${o.teamName} ${o.reference} ${o.contactEmail}`.toLowerCase()}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/admin/team-order/${o.id}`} className="text-brand hover:underline" title="Open the full order detail page">
                        {o.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/team-order/${o.id}`} className="hover:text-brand hover:underline" title="Open the full order detail page">{o.teamName}</Link>
                        {addonsByOrder.has(o.id) && (
                          <AdminAddonDetails addons={addonsByOrder.get(o.id)!} teamName={o.teamName} />
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2"><Badge label={o.status} /></td>
                    <td className="px-3 py-2 text-muted">{o.contactEmail}</td>
                    <td className="px-3 py-2 text-muted whitespace-nowrap" title={o.source ?? "unknown (pre-tracking)"}>{srcShort(o.source)}</td>
                    <td className="px-3 py-2 text-foreground">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="whitespace-nowrap">
                          {estimate ? money(estimate) : "-"}
                          {estimate && !o.quotedTotalCents ? <span className="text-xs text-muted"> est.</span> : null}
                        </span>
                        {/* Quote drift: roster changed after the quote locked. */}
                        {!paid && o.quotedTotalCents && orderEstimates.has(o.id) && orderEstimates.get(o.id) !== o.quotedTotalCents ? (
                          <Link
                            href={`/admin/team-order/${o.id}`}
                            className="text-xs text-amber-300 whitespace-nowrap hover:underline"
                            title={`Roster now prices at ${money(orderEstimates.get(o.id)!)} but the locked quote is ${money(o.quotedTotalCents)} - open to update`}
                          >
                            ⚠️ requote
                          </Link>
                        ) : null}
                        {/* Shipping rides on the FINAL invoice: show the
                            charged amount once known, else the weight-based
                            estimate so the full number is visible up front. */}
                        {o.localPickup ? (
                          <span className="text-xs text-muted whitespace-nowrap" title="Local order - customer picks up in Ocala, no shipping">
                            + pickup
                          </span>
                        ) : o.shippingChargedCents != null ? (
                          <span className="text-xs text-muted whitespace-nowrap" title="Shipping charged on the final invoice">
                            + {o.shippingChargedCents === 0 ? "pickup" : `${money(o.shippingChargedCents)} ship`}
                          </span>
                        ) : estimate && shipEstimates.has(o.id) ? (
                          <span
                            className="text-xs text-muted whitespace-nowrap"
                            title="Estimated shipping, charged on the final balance invoice (live rate at that point; $0 if local pickup)"
                          >
                            + ~{money(shipEstimates.get(o.id)!)} ship
                          </span>
                        ) : null}
                        {o.customJerseyCents ? (
                          <span className="text-xs display text-brand" title="Negotiated per-jersey price for this order">
                            ${(o.customJerseyCents / 100).toFixed(0)}/JERSEY
                          </span>
                        ) : (
                          o.localPricing && <span className="text-xs display text-brand">OCALA</span>
                        )}
                        {o.taxExempt && <span className="text-xs display text-brand">TAX-EXEMPT</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 min-w-[16rem]">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {/* Pieces we embroider in-house (hats): the factory
                            shipment won't contain these, so keep them in view
                            until the order ships. */}
                        {inHouseWork.has(o.id) && (
                          <span
                            title="Embroidered in-house in Ocala - not part of the factory shipment"
                            className="text-xs display text-amber-300 border border-amber-300/40 px-1.5 py-0.5 whitespace-nowrap"
                          >
                            🧢 IN-HOUSE: {inHouseWork.get(o.id)}
                          </span>
                        )}
                        {/* Inbound leg (factory -> shop). Always shown while
                            tracking exists - redo shipments can arrive after
                            the original order shipped. Internal only. */}
                        {o.inboundTrackingNumber && (
                          <a
                            href={inboundTrackingUrlFor(o.inboundTrackingNumber, o.inboundCarrier)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Inbound from production${o.inboundTrackingAddedAt ? ` - entered ${fmtDate(o.inboundTrackingAddedAt)}` : ""} - click for live carrier tracking`}
                            className="text-xs display text-violet-400 underline decoration-dotted underline-offset-2 hover:text-violet-300 whitespace-nowrap"
                          >
                            ✈ INBOUND · {o.inboundCarrier ?? "?"} {o.inboundTrackingNumber}
                          </a>
                        )}
                        {inboundLive.has(o.id) && (
                          <span
                            className="text-xs text-violet-300/90 whitespace-nowrap"
                            title={inboundLive.get(o.id)!.detail ?? "Latest carrier scan"}
                          >
                            {inboundLive.get(o.id)!.status}
                            {inboundLive.get(o.id)!.location ? ` - ${inboundLive.get(o.id)!.location}` : ""}
                            {inboundLive.get(o.id)!.at ? ` (${fmtDate(inboundLive.get(o.id)!.at!)})` : ""}
                          </span>
                        )}
                        {o.paymentNote && (
                          <span className="text-xs text-emerald-300/90 whitespace-nowrap" title={o.paymentNote}>
                            💵 {o.paymentNote.split(";").pop()?.trim()}
                          </span>
                        )}
                        {/* ONE primary action per state - everything else
                            lives in the ⋯ menu so rows stay scannable. */}
                        {o.shippedAt ? (
                          <>
                            <span className="text-xs display text-green-400 whitespace-nowrap">🚚 SHIPPED</span>
                            {o.trackingNumber && <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />}
                          </>
                        ) : paid ? (
                          o.trackingNumber ? (
                            <>
                              <span className="text-xs display text-amber-400 whitespace-nowrap" title="Label/tracking ready - customer not emailed yet">READY TO SHIP</span>
                              <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber} label="🚚 Mark shipped + email" />
                            </>
                          ) : (
                            <>
                              <span className="text-xs display text-green-400 whitespace-nowrap">PAID</span>
                              <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} />
                            </>
                          )
                        ) : o.depositPaidAt && estimate ? (
                          <>
                            <span className="text-xs display text-sky-400 whitespace-nowrap">DEPOSIT ✓</span>
                            <AdminInvoiceButton
                              teamOrderId={o.id}
                              teamName={o.teamName}
                              dueCents={estimate - deposit}
                              stage="balance"
                              resend={Boolean(o.balanceInvoiceUrl)}
                              localPickup={o.localPickup}
                            />
                          </>
                        ) : estimate ? (
                          <AdminInvoiceButton
                            teamOrderId={o.id}
                            teamName={o.teamName}
                            dueCents={deposit}
                            stage="deposit"
                            resend={Boolean(o.invoiceUrl)}
                            warnPrintFile={Boolean(o.designRequestId) && !o.printFileVerifiedAt && personalizedOrders.has(o.id)}
                          />
                        ) : (
                          <span className="text-xs text-muted">no roster</span>
                        )}
                        {/* Secondary actions in a floating dropdown. */}
                        <AdminRowMenu>
                            <AdminDesignerNote teamOrderId={o.id} current={o.designerNote} />
                            {!o.designRequestId && (
                              <AdminLinkDesign teamOrderId={o.id} designs={linkableDesigns} />
                            )}
                            {!paid && (
                              <AdminRecordPayment
                                teamOrderId={o.id}
                                teamName={o.teamName}
                                depositPaid={Boolean(o.depositPaidAt)}
                                suggestedDepositCents={estimate ? deposit : null}
                              />
                            )}
                            {(o.invoiceUrl || estimate) && (
                              <a
                                href={`/api/admin/team-order/invoice-view?id=${o.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={paid ? "View the paid receipt (itemized, incl. shipping) - no Stripe login needed" : o.invoiceUrl ? "See a copy of the invoice the customer received" : "Preview the deposit invoice before sending it"}
                                className="text-xs display text-muted whitespace-nowrap"
                              >
                                {paid ? "View receipt" : "View invoice"}
                              </a>
                            )}
                            {!o.balanceInvoiceUrl && !paid && (
                              <AdminPickupToggle teamOrderId={o.id} pickup={o.localPickup} />
                            )}
                            {!o.invoiceUrl && !paid && (
                              <>
                                <AdminJerseyStyle teamOrderId={o.id} current={o.jerseyStyle} />
                                <AdminCustomPrice teamOrderId={o.id} currentCents={o.customJerseyCents} />
                                <AdminLocalToggle teamOrderId={o.id} local={o.localPricing} />
                                <AdminTaxToggle teamOrderId={o.id} exempt={o.taxExempt} />
                              </>
                            )}
                            {o.depositPaidAt && !o.shippedAt && !paid && (
                              o.trackingNumber ? (
                                <>
                                  <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />
                                  <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber} label="Mark shipped + email" />
                                </>
                              ) : (
                                <>
                                  <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} />
                                  <AdminShipButton kind="team_order" id={o.id} who={o.teamName} label="Add tracking" />
                                </>
                              )
                            )}
                            {paid && !o.shippedAt && (
                              <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber ?? undefined} label="Add tracking" />
                            )}
                            {paid && !o.shippedAt && o.trackingNumber && (
                              <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />
                            )}
                            {!o.shippedAt && o.manageToken && (
                              <AdminInboundTracking
                                manageToken={o.manageToken}
                                initialCarrier={o.inboundCarrier}
                                initialNumber={o.inboundTrackingNumber}
                              />
                            )}
                            <AdminArchiveButton kind="team_order" id={o.id} archived={false} />
                        </AdminRowMenu>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">{fmtDate(o.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>


      {archivedOrders.length > 0 && (
        <details className="mt-6 border border-line bg-steel/50 group">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 list-none">
            <span className="display text-sm text-muted">Archived team orders ({archivedOrders.length})</span>
            <span className="text-brand transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="divide-y divide-[color:var(--line)] border-t border-line">
            {archivedOrders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <Link href={`/team-order/manage/${o.manageToken}`} className="font-mono text-xs text-brand hover:underline">
                    {o.reference}
                  </Link>
                  <span className="ml-2 text-foreground">{o.teamName}</span>
                  <span className="ml-2 text-muted">{o.contactEmail}</span>
                  {o.archivedNote && <span className="ml-2 text-xs text-amber-400/90">"{o.archivedNote}"</span>}
                  <span className="ml-2 text-xs text-muted">archived {fmtDate(o.archivedAt)}</span>
                </div>
                <AdminArchiveButton kind="team_order" id={o.id} archived={true} />
              </div>
            ))}
          </div>
        </details>
      )}

    </div>
  );
}
