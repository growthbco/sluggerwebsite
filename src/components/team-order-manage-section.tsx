import Image from "next/image";
import type { teamOrders } from "@/db/schema";
import { customerRosterLockMessage, getRoster, getLinkedDesignPreview } from "@/lib/team-orders";
import { getStoreByDesignRequestId, teamRaisedCents } from "@/lib/team-stores";
import { TeamFundraiseCard } from "@/components/team-fundraise-card";
import { itemPriceCents, computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { EXTRA_ADDON_KEYS, itemLabel, minPiecesForItems } from "@/lib/order-items";
import { TeamOrderManage } from "@/components/team-order-manage";
import { TeamOrderAddon } from "@/components/team-order-addon";
import { TeamOrderShipping } from "@/components/team-order-shipping";
import { ManageTabs, type ManageTab } from "@/components/manage-tabs";
import { SizeChartsFor } from "@/components/size-charts";
import { trackingUrlForCarrier } from "@/lib/tracking";
import { buildDeliveryTimeline, type DeliveryTier } from "@/lib/delivery-timeline";
import { CustomerDeliveryTimeline } from "@/components/customer-delivery-timeline";
import { buildCustomerOrderSpec } from "@/lib/order-spec";

type TeamOrderRow = typeof teamOrders.$inferSelect;

/** The roster/sizes + fundraiser + add-ons block for a team order, keyed by the
 *  order's manage token. Shared by the standalone /team-order/manage page and
 *  the unified customer hub (/design/status), so the coach fills their roster on
 *  whichever link they already have - same UI, one source of truth. */
export async function TeamOrderManageSection({ order }: { order: TeamOrderRow }) {
  const [roster, design] = await Promise.all([
    getRoster(order.id),
    getLinkedDesignPreview(order.designRequestId),
  ]);
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const shareUrl = `${SITE}/team-order/join/${order.selfEntryToken}`;
  const store = order.designRequestId ? await getStoreByDesignRequestId(order.designRequestId) : null;
  const raisedCents = store ? await teamRaisedCents(store.id) : 0;
  const storeUrl = store?.storeToken ? `${SITE}/store/${store.storeToken}` : null;
  const addonItems = [...new Set([...(order.items ?? ["jersey"]), ...EXTRA_ADDON_KEYS])];
  const designState: "approved" | "pending" | "missing" = order.approvedDesignUrl || (design && !design.pending && design.designs.length > 0)
    ? "approved"
    : order.designRequestId
      ? "pending"
      : "missing";
  // Live running total for the coach as the roster fills (estimate; shipping and
  // tax are added at invoice). Uses the same pricing engine as the real quote.
  const quote = computeTeamOrderQuote(order, roster);
  // Paid/submitted orders keep the exact quote the customer accepted, even if
  // the current catalog fee has changed since invoicing. This order-level
  // reconciliation also keeps legacy Rush fees from being rewritten in the
  // customer-facing breakdown.
  const lockedQuoteTotal = order.quotedTotalCents ?? null;
  const lockedBaseTotal = quote.lines.reduce((sum, line) => sum + line.totalCents, 0) + quote.priorityFeeCents;
  const customerQuote = lockedQuoteTotal && !["draft", "collecting"].includes(order.status)
    ? {
        ...quote,
        rushFeeCents: order.rushShipping ? Math.max(0, lockedQuoteTotal - lockedBaseTotal) : 0,
        totalCents: lockedQuoteTotal,
      }
    : quote;
  const liveOrderSpec = buildCustomerOrderSpec(order, roster, design, customerQuote);
  const currentOrderSpec = (order.depositPaidAt || order.invoicePaidAt) && order.specSnapshot
    ? order.specSnapshot
    : liveOrderSpec;
  const orderItems = order.items ?? ["jersey"];
  const orderMinimum = minPiecesForItems(order.items);
  const athleteCount = new Set(roster.map((row) => {
    const name = (row.playerName ?? "").trim().toLowerCase();
    const number = (row.playerNumber ?? "").trim().toLowerCase();
    return name || number ? `${name}|${number}` : `row:${row.id}`;
  })).size;
  const pieceCount = roster.reduce((total, row) => total + Math.max(1, row.quantity ?? 1), 0);
  const rosterLockMessage = customerRosterLockMessage(order);
  const hasJersey = orderItems.some((item) => item.includes("jersey"));
  const collecting = ["draft", "collecting"].includes(order.status);
  const productPrices = orderItems
    .map((key) => ({
      key,
      label: itemLabel(key),
      unitCents: key === "jersey" && order.customJerseyCents
        ? order.customJerseyCents
        : itemPriceCents(key, order.jerseyStyle, order.localPricing, order.jerseyMaterial),
    }))
    .filter((p) => p.unitCents > 0);
  const canAddon = !["draft", "collecting", "cancelled"].includes(order.status);
  const addonPrices = Object.fromEntries(addonItems.map((k) => [
    k,
    k === "jersey" && order.customJerseyCents
      ? order.customJerseyCents
      : itemPriceCents(k, order.jerseyStyle, order.localPricing, order.jerseyMaterial),
  ]));
  // The "Add to this order" block: primary gold, placed right under the
  // submitted banner on the roster tab (where coaches actually look), so nobody
  // has to hunt a back tab for it. Ship-timing disclaimer always visible.
  const addonSlot = canAddon ? (
    <details key="team-order-addon" className="group rounded-xl border border-brand/60 bg-brand/[0.05]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3">
        <span>
          <span className="display block text-base text-foreground">Add a player or item</span>
          <span className="block text-xs text-muted">Late addition? Add it here without starting a new order.</span>
        </span>
        <span className="display shrink-0 text-brand transition-transform group-open:rotate-45" aria-hidden="true">+</span>
      </summary>
      <div className="border-t border-brand/20 px-5 pb-5 pt-4">
        <TeamOrderAddon
          token={order.manageToken!}
          items={addonItems}
          prices={addonPrices}
          sport={order.sport}
          designs={design?.designs ?? []}
          shipped={order.status === "shipped"}
          embedded
        />
        <p className="mt-4 border-t border-brand/20 pt-3 text-xs text-muted">
          Late additions may ship separately and can have their own shipping charge or delivery date.
        </p>
      </div>
    </details>
  ) : null;

  // One focused panel at a time instead of a long scroll. Roster is the home
  // tab; Size Charts only lists what this order includes; Extras (fundraiser +
  // add-ons) appears once there's something to show.
  const tabs: ManageTab[] = [
    {
      key: "roster",
      label: "Roster & Sizes",
      content: (
        <TeamOrderManage
          token={order.manageToken!}
          teamName={order.teamName}
          jerseyStyle={order.jerseyStyle}
          jerseyMaterial={order.jerseyMaterial}
          items={orderItems}
          sport={order.sport}
          designs={design?.designs ?? []}
          shareUrl={shareUrl}
          roster={roster.map((r) => ({
            id: r.id,
            playerName: r.playerName,
            playerNumber: r.playerNumber,
            size: r.size,
            sizes: r.sizes,
            notes: r.notes,
            design: r.design,
            quantity: r.quantity,
          }))}
          submitted={!["draft", "collecting"].includes(order.status)}
          colors={design?.colors ?? null}
          locked={Boolean(rosterLockMessage)}
          lockMessage={rosterLockMessage}
          requiresNames={order.requiresNames}
          minPieces={orderMinimum}
          quote={{ lines: customerQuote.lines, rushFeeCents: customerQuote.rushFeeCents, priorityFeeCents: customerQuote.priorityFeeCents, totalCents: customerQuote.totalCents }}
          nextIsDeposit={designState === "approved"}
          designState={designState}
          addonSlot={addonSlot}
          orderSpec={currentOrderSpec}
        />
      ),
    },
    {
      key: "sizes",
      label: "Size Charts",
      content: (
        <div>
          <p className="text-sm text-muted mb-4">
            {hasJersey
              ? "All measurements in inches. Jerseys run slightly large - when in doubt, size down."
              : "All measurements are in inches. Use the chart for the items in this order."}
          </p>
          <SizeChartsFor items={orderItems} sport={order.sport} />
        </div>
      ),
    },
  ];

  // Add-ons now live in the gold block on the roster tab (above). The third tab
  // is only for a fundraiser store, when there is one - never lead with it.
  if (store) {
    tabs.push({
      key: "fundraiser",
      label: "Fundraiser",
      content: (
        <TeamFundraiseCard token={order.manageToken!} initialPercent={store.fundraisePercent ?? 0} raisedCents={raisedCents} storeUrl={storeUrl} />
      ),
    });
  }

  // Order-level status + pay/track for the customer's order page. Customers
  // see only the final outbound shipment, regardless of carrier; internal
  // factory-to-Slugger tracking remains private.
  const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const titleCaseStatus = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const paid = Boolean(order.invoicePaidAt);
  const started = Boolean(order.depositPaidAt);
  const payUrl = order.fullInvoiceUrl || order.invoiceUrl;
  const totalCents = order.quotedTotalCents ?? quote.totalCents;
  const shippingCents = order.shippingChargedCents ?? 0;
  const grandTotal = totalCents + shippingCents;
  const depositCents = order.depositCents ?? Math.round(totalCents / 2);
  const balanceDue = Math.max(0, totalCents - depositCents) + shippingCents;
  const showPayDeposit = !paid && !started && Boolean(payUrl);
  const showPayBalance = started && !paid && Boolean(order.balanceInvoiceUrl) && balanceDue > 0;
  const outboundTrack = order.trackingNumber && (order.status === "shipped" || order.shippedAt)
    ? { number: order.trackingNumber, url: trackingUrlForCarrier(order.trackingNumber, order.shipCarrier) }
    : null;
  const deliveryTimeline = buildDeliveryTimeline({
    approvedAt: design?.approvedAt,
    rosterSubmittedAt: order.submittedAt,
    depositPaidAt: order.depositPaidAt ?? order.invoicePaidAt,
    timelineStartAt: order.timelineStartAt,
    fallbackStartAt: (["in_production", "paid", "shipped"] as string[]).includes(order.status)
      ? (order.depositPaidAt ?? order.invoicePaidAt)
      : null,
    requestedInHandAt: order.requestedInHandAt ?? design?.neededBy,
    promisedInHandAt: order.promisedInHandAt,
    tier: (order.turnaroundTier as DeliveryTier | null) ?? undefined,
    rush: order.rushShipping,
    localPickup: order.localPickup,
  });
  const statusLabel = order.status === "shipped" || order.shippedAt
    ? "Shipped"
    : paid
      ? "Paid"
    : started
      ? "In production"
      : ["draft", "collecting"].includes(order.status)
        ? "Building roster"
        : order.status === "submitted"
          ? "Roster confirmed"
          : order.status === "quoted"
            ? "Awaiting payment"
            : titleCaseStatus(order.status);
  const nextStepHeading = outboundTrack
    ? "Your order is on the way"
    : started
      ? "Production is underway"
      : showPayBalance
        ? "Pay the remaining balance"
        : showPayDeposit
          ? "Payment starts production"
          : collecting
            ? "Complete your roster"
            : "We are reviewing your order";
  const shipAddr = order.shippingAddress?.line1
    ? { line1: order.shippingAddress.line1 ?? "", line2: order.shippingAddress.line2 ?? "", city: order.shippingAddress.city ?? "", state: order.shippingAddress.state ?? "", postalCode: order.shippingAddress.postalCode ?? "" }
    : null;

  return (
    <div className="space-y-8">
      {/* Persistent product + price identity. The customer should never have
          to infer what they are buying from a roster field or an invoice. */}
      <section className="rounded-xl border-2 border-brand/60 bg-brand/[0.07] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="display text-xs uppercase tracking-[0.16em] text-brand">Team order dashboard</p>
            <h1 className="display text-3xl text-foreground mt-1">{order.teamName} Team Order</h1>
            <p className="text-sm text-muted mt-1">
              {orderItems.map((key) => itemLabel(key)).join(" + ")}{order.jerseyStyle ? ` · ${order.jerseyStyle}` : ""}
            </p>
          </div>
          <span className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1.5 display text-xs text-brand">{statusLabel}</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="border border-line bg-ink/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted">Unit price</p>
            {productPrices.map((p) => (
              <p key={p.key} className="display text-lg text-foreground mt-0.5">{money(p.unitCents)} each</p>
            ))}
          </div>
          <div className="border border-line bg-ink/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted">Athletes</p>
            <p className="display text-lg text-foreground mt-0.5">{athleteCount}</p>
            <p className="text-xs text-muted mt-0.5">Unique players</p>
          </div>
          <div className="border border-line bg-ink/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted">Uniform pieces</p>
            <p className="display text-lg text-foreground mt-0.5">{pieceCount}</p>
            <p className="text-xs text-muted mt-0.5">{orderMinimum}-piece minimum</p>
          </div>
          <div className="border border-line bg-ink/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted">Order total</p>
            <p className="display text-lg text-foreground mt-0.5">{totalCents > 0 ? money(grandTotal) : "Add sizes"}</p>
            <p className="text-xs text-muted mt-0.5">{shippingCents > 0 ? `Includes ${money(shippingCents)} shipping` : "Tax and shipping added later"}</p>
          </div>
        </div>

        {collecting && (
          <a href="#roster-builder" className="inline-flex mt-4 clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark">
            {roster.length < orderMinimum
              ? roster.length === 0
                ? "Add your first athlete ↓"
                : `Add ${orderMinimum - roster.length} more ${orderMinimum - roster.length === 1 ? "athlete" : "athletes"} ↓`
              : "Review roster and total ↓"}
          </a>
        )}
      </section>

      {/* This order at a glance: status, total (with shipping once known), and
          Pay / Pay balance / Track by state. */}
      <section className="border border-line bg-steel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="display text-foreground">{nextStepHeading}</p>
          {shippingCents > 0 && (
            <p className="text-sm text-muted mt-0.5">
              {money(totalCents)} goods + {money(shippingCents)} shipping = {money(grandTotal)}
            </p>
          )}
          {showPayBalance && <p className="text-sm text-amber-300 mt-0.5">Balance due: {money(balanceDue)}</p>}
          {started && !outboundTrack && (
            <p className="max-w-xl text-xs text-muted mt-1.5">
              {order.rushShipping
                ? "Customer tracking appears only when the final package is on its way to you. Internal production tracking is not shown here."
                : "Customer tracking appears after the finished order reaches Slugger and we prepare the final shipment to you. Internal designer and supplier tracking is not shown here."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showPayDeposit && (
            <a href={payUrl!} target="_blank" rel="noopener noreferrer" className="display text-sm bg-brand text-on-brand px-5 min-h-[44px] inline-flex items-center rounded hover:bg-brand-dark">
              {order.fullInvoiceUrl ? `Pay in full ${money(totalCents)}` : `Pay deposit ${money(depositCents)}`}
            </a>
          )}
          {showPayBalance && (
            <a href={order.balanceInvoiceUrl!} target="_blank" rel="noopener noreferrer" className="display text-sm bg-brand text-on-brand px-5 min-h-[44px] inline-flex items-center rounded hover:bg-brand-dark">Pay balance {money(balanceDue)}</a>
          )}
          {outboundTrack && (
            <a href={outboundTrack.url} target="_blank" rel="noopener noreferrer" className="display text-sm border border-brand/50 text-brand px-5 min-h-[44px] inline-flex items-center rounded hover:bg-brand/10">Track shipment</a>
          )}
        </div>
      </section>

      <CustomerDeliveryTimeline
        timeline={deliveryTimeline}
        localPickup={order.localPickup}
        shippedAt={order.shippedAt}
      />

      {/* Visual confirmation card so the coach (and screenshots they share with
          their players) make the team <-> uniform connection obvious. */}
      {design?.imageUrl && (
        <section className="overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.02]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/60 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">{designState === "approved" ? "Approved designs" : "Design proof awaiting approval"}</p>
              <h2 className="display text-xl text-foreground mt-1">{order.teamName} Uniforms</h2>
              <p className="text-xs text-muted mt-1">Design ref: <span className="font-mono">{design.reference}</span></p>
            </div>
            <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
              {design.designs.length > 1 ? `${design.designs.length} colorways` : designState === "approved" ? "Approved" : "Review needed"}
            </span>
          </div>

          {design.designs.length > 1 ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {design.designs.map((d) => (
                <a key={d.image} href={d.image} target="_blank" rel="noopener noreferrer" className="group overflow-hidden border border-line bg-white" title={`View ${d.label}`}>
                  <div className="relative aspect-[4/3]">
                    <Image src={d.image} alt={d.label} fill sizes="(max-width: 640px) 100vw, 40vw" className="object-contain p-2 transition-transform group-hover:scale-[1.02]" unoptimized />
                  </div>
                  <span className="flex items-center justify-between border-t border-line bg-ink px-3 py-2 text-sm text-foreground">
                    <span>{d.label}</span>
                    <span className="text-xs text-brand">View larger ↗</span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <a href={design.imageUrl} target="_blank" rel="noopener noreferrer" title="Click to view full size" className="relative block aspect-[16/7] bg-white hover:opacity-90">
              <Image src={design.imageUrl} alt={`${order.teamName} design`} fill sizes="(max-width: 1024px) 100vw, 900px" className="object-contain p-2" unoptimized />
              <span className="absolute bottom-2 right-2 bg-ink/85 px-2 py-1 text-xs text-foreground">View larger ↗</span>
            </a>
          )}
        </section>
      )}

      {/* Where this order ships, editable by the customer (locked once shipped). */}
      {!order.localPickup && (
        <TeamOrderShipping token={order.manageToken!} initial={shipAddr} locked={order.status === "shipped" || Boolean(order.shippedAt)} />
      )}

      <div id="roster-builder" className="scroll-mt-6">
        <ManageTabs tabs={tabs} />
      </div>
    </div>
  );
}
