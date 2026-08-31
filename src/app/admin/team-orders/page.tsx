import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders, teamOrderAddons } from "@/db/schema";
import { getAdminSession, adminEnabled } from "@/lib/admin-auth";
import { getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote, estimateOrderWeightOz, estimateOrderParcelsOz } from "@/lib/team-order-pricing";
import { sizeBreakdown, ITEM_TYPES } from "@/lib/order-items";
import { shippingCentsFor } from "@/lib/team-stores";
import { getLiveTracking, type LiveTracking } from "@/lib/shippo";
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
import { AdminRecordPayment } from "@/components/admin-record-payment";
import { AdminPickupToggle } from "@/components/admin-pickup-toggle";
import { AdminCustomerPickupButton } from "@/components/admin-customer-pickup-button";
import { AdminRowMenu } from "@/components/admin-row-menu";
import { AdminCustomPrice } from "@/components/admin-custom-price";
import { AdminInboundTracking } from "@/components/admin-inbound-tracking";
import { AdminFinalMockup } from "@/components/admin-final-mockup";
import { AdminPickupReadyText } from "@/components/admin-pickup-ready-text";
import {
  buildDeliveryTimeline,
  type DeliveryRisk,
  type DeliveryTier,
} from "@/lib/delivery-timeline";

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
  picked_up: "border-green-500/50 text-green-400",
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

const DATE_RISK_TONE: Record<DeliveryRisk, string> = {
  no_date: "text-muted",
  waiting: "text-amber-300",
  on_track: "text-green-400",
  tight: "text-amber-300",
  rush_needed: "text-orange-300",
  priority_review: "text-orange-300",
  not_feasible: "text-red-400",
};

function fmtRequestedDate(d: Date | null) {
  return d
    ? d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })
    : "-";
}

export default async function AdminTeamOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; sort?: string }> }) {
  if (!adminEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Set ADMIN_PASSWORD to enable the dashboard.</div>;
  }
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const db = getDb();
  const { status: initialStatus, sort } = await searchParams;

  const [designs, torders, paidAddons] = await Promise.all([
    db
      .select({
        id: designRequests.id,
        reference: designRequests.reference,
        teamName: designRequests.teamName,
        approvedAt: designRequests.approvedAt,
        neededBy: designRequests.neededBy,
        approvedDesignUrl: designRequests.approvedDesignUrl,
        approvedDesignUrls: designRequests.approvedDesignUrls,
        archivedAt: designRequests.archivedAt,
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
        contactName: teamOrders.contactName,
        contactEmail: teamOrders.contactEmail,
        contactPhone: teamOrders.contactPhone,
        smsOptInAt: teamOrders.smsOptInAt,
        manageToken: teamOrders.manageToken,
        jerseyStyle: teamOrders.jerseyStyle,
        rushShipping: teamOrders.rushShipping,
        approvedDesignUrl: teamOrders.approvedDesignUrl,
        timelineStartAt: teamOrders.timelineStartAt,
        turnaroundTier: teamOrders.turnaroundTier,
        requestedInHandAt: teamOrders.requestedInHandAt,
        promisedInHandAt: teamOrders.promisedInHandAt,
        submittedAt: teamOrders.submittedAt,
        localPricing: teamOrders.localPricing,
        embroideryFeeWaived: teamOrders.embroideryFeeWaived,
        taxExempt: teamOrders.taxExempt,
        designRequestId: teamOrders.designRequestId,
        designerNote: teamOrders.designerNote,
        source: teamOrders.source,
        printFileUrl: teamOrders.printFileUrl,
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
        deliveredAt: teamOrders.deliveredAt,
        shippingChargedCents: teamOrders.shippingChargedCents,
        shippingProtectionCents: teamOrders.shippingProtectionCents,
        shippingProtectionValueCents: teamOrders.shippingProtectionValueCents,
        shippingProtectionCoveredCents: teamOrders.shippingProtectionCoveredCents,
        paymentNote: teamOrders.paymentNote,
        localPickup: teamOrders.localPickup,
        customJerseyCents: teamOrders.customJerseyCents,
        inboundCarrier: teamOrders.inboundCarrier,
        inboundTrackingNumber: teamOrders.inboundTrackingNumber,
        inboundTrackingAddedAt: teamOrders.inboundTrackingAddedAt,
        archivedAt: teamOrders.archivedAt,
        archivedNote: teamOrders.archivedNote,
        createdAt: teamOrders.createdAt,
        updatedAt: teamOrders.updatedAt,
      })
      .from(teamOrders)
      .orderBy(desc(teamOrders.updatedAt)),
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
  const finalMockupsByDesign = new Map(
    designs.map((design) => [
      design.id,
      Array.from(new Set([
        ...(design.approvedDesignUrls ?? []),
        ...(design.approvedDesignUrl ? [design.approvedDesignUrl] : []),
      ])),
    ]),
  );
  // Designs a standalone order can be manually linked to.
  const linkableDesigns = activeDesigns.map((d) => ({ id: d.id, teamName: d.teamName, reference: d.reference }));
  const activeOrders = torders.filter((o) => !o.archivedAt);
  const designsById = new Map(activeDesigns.map((design) => [design.id, design]));
  const orderTimelines = new Map(
    activeOrders.map((order) => {
      const design = order.designRequestId ? designsById.get(order.designRequestId) : null;
      return [
        order.id,
        buildDeliveryTimeline({
          approvedAt: design?.approvedAt ?? (order.approvedDesignUrl ? order.submittedAt : null),
          rosterSubmittedAt: order.submittedAt ?? (order.depositPaidAt ? order.depositPaidAt : null),
          depositPaidAt: order.depositPaidAt ?? order.invoicePaidAt,
          timelineStartAt: order.timelineStartAt,
          fallbackStartAt: (["in_production", "paid", "shipped"] as string[]).includes(order.status)
            ? (order.depositPaidAt ?? order.invoicePaidAt ?? order.createdAt)
            : null,
          requestedInHandAt: order.requestedInHandAt ?? design?.neededBy,
          promisedInHandAt: order.promisedInHandAt,
          tier: (order.turnaroundTier as DeliveryTier | null) ?? undefined,
          rush: order.rushShipping,
          localPickup: order.localPickup,
        }),
      ] as const;
    }),
  );
  // Sort by who made a deposit: orders with a deposit paid float to the top,
  // most recent deposit first; orders with no deposit fall to the bottom.
  if (sort === "deposit") {
    activeOrders.sort((a, b) => {
      const ad = a.depositPaidAt ? new Date(a.depositPaidAt).getTime() : 0;
      const bd = b.depositPaidAt ? new Date(b.depositPaidAt).getTime() : 0;
      return bd - ad;
    });
  } else if (sort === "target") {
    activeOrders.sort((a, b) => {
      const aComplete = a.shippedAt ? 2 : (a.invoicePaidAt || a.status === "paid" ? 1 : 0);
      const bComplete = b.shippedAt ? 2 : (b.invoicePaidAt || b.status === "paid" ? 1 : 0);
      if (aComplete !== bComplete) return aComplete - bComplete;
      const at = orderTimelines.get(a.id)?.selectedTargetAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const bt = orderTimelines.get(b.id)?.selectedTargetAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return at - bt;
    });
  }
  const sortHref = (s?: string) => {
    const p = new URLSearchParams();
    if (initialStatus) p.set("status", initialStatus);
    if (s) p.set("sort", s);
    const qs = p.toString();
    return `/admin/team-orders${qs ? `?${qs}` : ""}#team-orders`;
  };
  const archivedOrders = torders.filter((o) => o.archivedAt);

  if (session.role === "designer") {
    const productionOrders = activeOrders.filter((order) => order.status === "in_production" || order.status === "paid" || order.status === "shipped");
    const needsQa = productionOrders.filter((order) => Boolean(order.printFileUrl) && !order.printFileVerifiedAt).length;
    const needsTracking = productionOrders.filter((order) => order.status !== "shipped" && !order.inboundTrackingNumber).length;
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <AdminPageHeader eyebrow="Designer portal" title={`Production Orders (${productionOrders.length})`}>
          <Link href="/admin/designer-tracking" className="clip-slant bg-brand px-4 py-2 display text-sm text-on-brand hover:bg-brand-dark">
            Tracking workspace
          </Link>
        </AdminPageHeader>
        <p className="-mt-3 text-sm text-muted">Production readiness only — customer billing and Slugger financial controls stay in the staff workspace.</p>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-line bg-steel p-4"><p className="text-xs text-muted">Active production</p><p className="display text-3xl text-brand mt-1">{productionOrders.filter((order) => order.status !== "shipped").length}</p></div>
          <div className="rounded-xl border border-line bg-steel p-4"><p className="text-xs text-muted">Print QA needed</p><p className="display text-3xl text-sky-300 mt-1">{needsQa}</p></div>
          <div className="rounded-xl border border-line bg-steel p-4 col-span-2 sm:col-span-1"><p className="text-xs text-muted">Tracking needed</p><p className="display text-3xl text-violet-300 mt-1">{needsTracking}</p></div>
        </div>

        <AdminSearch statuses={Array.from(new Set(productionOrders.map((order) => order.status)))} initialStatus={initialStatus} />
        <section id="team-orders" className="mt-4 rounded-xl border border-line bg-steel overflow-hidden scroll-mt-16">
          <div className="hidden md:grid grid-cols-[minmax(0,1.3fr)_8rem_minmax(0,1.2fr)_7rem] gap-4 px-4 py-2.5 border-b border-line text-[10px] uppercase tracking-wider text-muted">
            <span>Team / order</span><span>Stage</span><span>Production handoff</span><span>Updated</span>
          </div>
          <div className="divide-y divide-line">
            {productionOrders.map((order) => (
              <article
                key={order.id}
                className="grid md:grid-cols-[minmax(0,1.3fr)_8rem_minmax(0,1.2fr)_7rem] gap-3 md:gap-4 px-4 py-4 items-center"
                data-section="orders"
                data-status={order.status}
                data-search={`${order.teamName} ${order.reference}`.toLowerCase()}
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{order.teamName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-muted">{order.reference}</span>
                    {order.designRequestId ? (
                      <Link href={`/admin/design-requests/${order.designRequestId}`} className="text-brand hover:underline">Open design</Link>
                    ) : (
                      <span className="text-amber-300">No linked design</span>
                    )}
                  </div>
                </div>
                <div><Badge label={order.status === "paid" ? "ready_to_ship" : order.status} /></div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {order.printFileUrl ? (
                    order.printFileVerifiedAt ? <span className="text-green-300">Print file verified</span> : <span className="text-amber-300">Print QA needed</span>
                  ) : <span className="text-muted">Print file not uploaded</span>}
                  {order.inboundTrackingNumber ? (
                    <a href={inboundTrackingUrlFor(order.inboundTrackingNumber, order.inboundCarrier)} target="_blank" rel="noopener noreferrer" className="text-violet-300 underline decoration-dotted underline-offset-2">
                      {order.inboundCarrier ?? "Inbound"} · {order.inboundTrackingNumber}
                    </a>
                  ) : order.status !== "shipped" ? (
                    <span className="text-violet-300">Tracking not entered</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted">{fmtDate(order.updatedAt)}</p>
              </article>
            ))}
            <p data-empty-for="orders" className="hidden px-5 py-10 text-center text-sm text-muted">No production orders match those filters.</p>
          </div>
        </section>
      </div>
    );
  }

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
  // Pre-fill the shipping-label weight from the roster so the label dialog never
  // falls back to its 2 lb default. Hats ship in their own box, so the primary
  // label suggests the apparel weight and the second label the hat weight.
  const labelWeights = new Map<string, { primaryLb: number; hatLb?: number }>();
  // Orders with any name/number on the roster need print-file QA before
  // production; plain-gear orders skip that gate entirely.
  const personalizedOrders = new Set<string>();
  await Promise.all(activeOrders.map(async (o) => {
    try {
      const roster = await getRoster(o.id);
      if (!roster.length) return;
      if (roster.some((r) => (r.playerName ?? "").trim() || (r.playerNumber ?? "").trim())) {
        personalizedOrders.add(o.id);
      }
      const parcels = estimateOrderParcelsOz(roster);
      if (parcels.apparelOz + parcels.hatOz > 0) {
        const twoBoxes = parcels.apparelOz > 0 && parcels.hatOz > 0;
        labelWeights.set(o.id, {
          primaryLb: Math.max(1, Math.round(((parcels.apparelOz || parcels.hatOz) / 16) * 10) / 10),
          hatLb: twoBoxes ? Math.max(1, Math.round((parcels.hatOz / 16) * 10) / 10) : undefined,
        });
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
  }));

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
      <AdminPageHeader eyebrow="Operations" title={`Team Orders (${activeOrders.length})`}>
        <Link href="/admin/team-order/new" className="clip-slant bg-brand px-4 py-2 display text-sm text-on-brand hover:bg-brand-dark">
          Enter manual order
        </Link>
      </AdminPageHeader>
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

      <div className="mt-4 flex items-center gap-3 text-xs">
        <span className="text-muted">Sort:</span>
        <Link href={sortHref(undefined)} className={!sort ? "text-brand display" : "text-muted hover:text-foreground"}>Recent</Link>
        <Link href={sortHref("target")} className={sort === "target" ? "text-brand display" : "text-muted hover:text-foreground"}>Production target</Link>
        <Link href={sortHref("deposit")} className={sort === "deposit" ? "text-brand display" : "text-muted hover:text-foreground"}>Deposit made</Link>
      </div>

      <section className="mt-4 scroll-mt-16" id="team-orders">
        <div className="overflow-x-auto rounded-xl border border-line bg-steel/30">
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="bg-steel text-left text-[10px] tracking-wider text-muted uppercase">
                <th className="w-[24%] px-4 py-3">Team / order</th>
                <th className="w-[8%] px-3 py-3">Final</th>
                <th className="w-[12%] px-3 py-3">Stage</th>
                <th className="w-[17%] px-3 py-3">Order value</th>
                <th className="w-[32%] px-3 py-3">Next action / fulfillment</th>
                <th className="w-[7%] px-3 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {activeOrders.map((o) => {
                const estimate = o.quotedTotalCents ?? orderEstimates.get(o.id);
                const paid = Boolean(o.invoicePaidAt) || o.status === "paid" || o.status === "shipped";
                const deposit = o.depositCents ?? (estimate ? Math.round(estimate / 2) : 0);
                const timeline = orderTimelines.get(o.id)!;
                const customerDate = timeline.promisedInHandAt ?? timeline.requestedInHandAt;
                const finalMockups = Array.from(new Set([
                  ...(o.designRequestId ? finalMockupsByDesign.get(o.designRequestId) ?? [] : []),
                  ...(o.approvedDesignUrl ? [o.approvedDesignUrl] : []),
                ]));
                return (
                  <tr
                    key={o.reference}
                    className="align-top hover:bg-steel/60"
                    data-section="orders"
                    data-status={o.status}
                    data-search={`${o.teamName} ${o.reference} ${o.contactEmail} ${srcShort(o.source)} ${timeline.tierLabel} ${timeline.riskLabel}`.toLowerCase()}
                  >
                    <td className="px-4 py-3 text-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/team-order/${o.id}`} className="font-medium hover:text-brand hover:underline line-clamp-2" title="Open the full order detail page">{o.teamName}</Link>
                        {addonsByOrder.has(o.id) && (
                          <AdminAddonDetails addons={addonsByOrder.get(o.id)!} teamName={o.teamName} />
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                        <Link href={`/admin/team-order/${o.id}`} className="font-mono text-brand hover:underline">{o.reference}</Link>
                        <span className="truncate max-w-[15rem]">{o.contactEmail}</span>
                        <span title={o.source ?? "unknown (pre-tracking)"}>{srcShort(o.source)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <AdminFinalMockup teamName={o.teamName} images={finalMockups} />
                    </td>
                    <td className="px-3 py-3"><Badge label={o.localPickup && o.deliveredAt ? "picked_up" : o.status} /></td>
                    <td className="px-3 py-3 text-foreground">
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
                            requote
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
                        {o.shippingProtectionCents > 0 && (
                          <span
                            className="text-xs display text-green-400"
                            title={`${money(o.shippingProtectionCoveredCents)} of ${money(o.shippingProtectionValueCents)} assigned to purchased labels`}
                          >
                            PROTECTED
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 min-w-[18rem]">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {/* Pieces we embroider in-house (hats): the factory
                            shipment won't contain these, so keep them in view
                            until the order ships. */}
                        {inHouseWork.has(o.id) && (
                          <span
                            title="Embroidered in-house in Ocala - not part of the factory shipment"
                            className="text-xs display text-amber-300 border border-amber-300/40 px-1.5 py-0.5 break-words"
                          >
                            IN-HOUSE: {inHouseWork.get(o.id)}
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
                            INBOUND · {o.inboundCarrier ?? "?"} {o.inboundTrackingNumber}
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
                          <span className="min-w-0 max-w-full text-xs text-emerald-300/90 break-words line-clamp-2" title={o.paymentNote}>
                            {o.paymentNote.split(";").pop()?.trim()}
                          </span>
                        )}
                        {/* ONE primary action per state - everything else
                            lives in the ⋯ menu so rows stay scannable. */}
                        {o.shippedAt ? (
                          o.localPickup && !o.deliveredAt ? (
                            <>
                              <span className="text-xs display text-amber-400 whitespace-nowrap">PICKUP NEEDS CONFIRMATION</span>
                              <AdminPickupReadyText
                                teamOrderId={o.id}
                                teamName={o.teamName}
                                reference={o.reference}
                                contactName={o.contactName}
                                phoneLast4={o.contactPhone?.replace(/\D/g, "").slice(-4) || null}
                                disabledReason={!o.contactPhone ? "No customer phone number on this order." : !o.smsOptInAt ? "Customer did not opt in to SMS updates." : undefined}
                              />
                              <AdminCustomerPickupButton teamOrderId={o.id} teamName={o.teamName} />
                            </>
                          ) : (
                            <>
                              <span className="text-xs display text-green-400 whitespace-nowrap">{o.localPickup ? "PICKED UP" : "SHIPPED"}</span>
                              {!o.localPickup && o.trackingNumber && <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />}
                            </>
                          )
                        ) : paid ? (
                          o.localPickup ? (
                            <>
                              <span className="text-xs display text-green-400 whitespace-nowrap">PAID · LOCAL PICKUP</span>
                              <AdminPickupReadyText
                                teamOrderId={o.id}
                                teamName={o.teamName}
                                reference={o.reference}
                                contactName={o.contactName}
                                phoneLast4={o.contactPhone?.replace(/\D/g, "").slice(-4) || null}
                                disabledReason={!o.contactPhone ? "No customer phone number on this order." : !o.smsOptInAt ? "Customer did not opt in to SMS updates." : undefined}
                              />
                              <AdminCustomerPickupButton teamOrderId={o.id} teamName={o.teamName} />
                            </>
                          ) : o.trackingNumber ? (
                            <>
                              <span className="text-xs display text-amber-400 whitespace-nowrap" title="Label/tracking ready - customer not emailed yet">READY TO SHIP</span>
                              <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber} label="Mark shipped + email" />
                            </>
                          ) : (
                            <>
                              <span className="text-xs display text-green-400 whitespace-nowrap">PAID</span>
                              <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} suggestedLb={labelWeights.get(o.id)?.primaryLb} />
                            </>
                          )
                        ) : o.depositPaidAt && estimate ? (
                          <>
                            <span className="text-xs display text-sky-400 whitespace-nowrap">DEPOSIT </span>
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
                            {!o.invoiceUrl && !o.depositPaidAt && !paid && (
                              <>
                                <AdminJerseyStyle teamOrderId={o.id} current={o.jerseyStyle} />
                                <AdminCustomPrice teamOrderId={o.id} currentCents={o.customJerseyCents} />
                                <AdminLocalToggle teamOrderId={o.id} local={o.localPricing} />
                                <AdminTaxToggle teamOrderId={o.id} exempt={o.taxExempt} />
                              </>
                            )}
                            {!o.localPickup && o.depositPaidAt && !o.shippedAt && !paid && (
                              o.trackingNumber ? (
                                <>
                                  <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />
                                  <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber} label="Mark shipped + email" />
                                </>
                              ) : (
                                <>
                                  <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} suggestedLb={labelWeights.get(o.id)?.primaryLb} />
                                  <AdminShipButton kind="team_order" id={o.id} who={o.teamName} label="Add tracking" />
                                </>
                              )
                            )}
                            {!o.localPickup && paid && !o.shippedAt && (
                              <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber ?? undefined} label="Add tracking" />
                            )}
                            {!o.localPickup && paid && !o.shippedAt && o.trackingNumber && (
                              <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />
                            )}
                            {!o.shippedAt && o.manageToken && (
                              <AdminInboundTracking
                                orderKey={o.id}
                                initialCarrier={o.inboundCarrier}
                                initialNumber={o.inboundTrackingNumber}
                                canShipDirect={Boolean(o.invoicePaidAt)}
                              />
                            )}
                            {/* Buy an extra parcel's label once the primary one
                                exists - emails the customer that tracking. */}
                            {!o.localPickup && paid && o.trackingNumber && (
                              <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} additional suggestedLb={labelWeights.get(o.id)?.hatLb} label="Buy another label + email" />
                            )}
                            <AdminArchiveButton kind="team_order" id={o.id} archived={false} />
                        </AdminRowMenu>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted whitespace-nowrap">{fmtDate(o.updatedAt)}</td>
                  </tr>
                );
              })}
              <tr data-empty-for="orders" className="hidden">
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted">No team orders match those filters.</td>
              </tr>
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
                  {o.archivedNote && <span className="ml-2 text-xs text-amber-400/90">&ldquo;{o.archivedNote}&rdquo;</span>}
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
