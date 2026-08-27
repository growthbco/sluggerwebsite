import Image from "next/image";
import type { teamOrders } from "@/db/schema";
import { getRoster, getLinkedDesignPreview } from "@/lib/team-orders";
import { getStoreByDesignRequestId, teamRaisedCents } from "@/lib/team-stores";
import { TeamFundraiseCard } from "@/components/team-fundraise-card";
import { itemPriceCents, computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { EXTRA_ADDON_KEYS, minPiecesForItems } from "@/lib/order-items";
import { TeamOrderManage } from "@/components/team-order-manage";
import { TeamOrderAddon } from "@/components/team-order-addon";
import { TeamOrderShipping } from "@/components/team-order-shipping";
import { ManageTabs, type ManageTab } from "@/components/manage-tabs";
import { SizeChartsFor } from "@/components/size-charts";
import { carrierFor, trackingUrlFor } from "@/lib/tracking";

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
  const orderItems = order.items ?? ["jersey"];
  const canAddon = !["draft", "collecting", "cancelled"].includes(order.status);
  const addonPrices = Object.fromEntries(addonItems.map((k) => [k, itemPriceCents(k, order.jerseyStyle, order.localPricing, order.jerseyMaterial)]));
  // The "Add to this order" block: primary gold, placed right under the
  // submitted banner on the roster tab (where coaches actually look), so nobody
  // has to hunt a back tab for it. Ship-timing disclaimer always visible.
  const addonSlot = canAddon ? (
    <section className="rounded-xl border-2 border-brand/70 bg-brand/[0.06] p-5">
      <h3 className="display text-lg text-foreground">Add to this order</h3>
      <p className="text-sm text-muted mt-1">Still adding players or extras? Add them right here. You do not need a new order.</p>
      <div className="mt-4">
        <TeamOrderAddon
          token={order.manageToken!}
          items={addonItems}
          prices={addonPrices}
          designs={design?.designs ?? []}
          shipped={order.status === "shipped"}
          embedded
        />
      </div>
      <p className="mt-4 border-t border-brand/20 pt-3 text-xs text-muted">
        Adding to this order does not guarantee the original delivery date. Extra pieces may ship separately and can have their own shipping charge.
      </p>
    </section>
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
          reference={order.reference}
          teamName={order.teamName}
          jerseyStyle={order.jerseyStyle}
          jerseyMaterial={order.jerseyMaterial}
          items={orderItems}
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
          contactName={order.contactName}
          contactEmail={order.contactEmail}
          contactPhone={order.contactPhone}
          colors={design?.colors ?? null}
          placedAt={order.createdAt ? new Date(order.createdAt).toISOString() : null}
          locked={["shipped", "cancelled"].includes(order.status)}
          requiresNames={order.requiresNames}
          minPieces={minPiecesForItems(order.items)}
          quote={{ lines: quote.lines, totalCents: quote.totalCents }}
          nextIsDeposit={designState === "approved"}
          designState={designState}
          addonSlot={addonSlot}
        />
      ),
    },
    {
      key: "sizes",
      label: "Size Charts",
      content: (
        <div>
          <p className="text-sm text-muted mb-4">All measurements in inches. Jerseys run slightly large - when in doubt, size down.</p>
          <SizeChartsFor items={orderItems} />
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
  // only ever see outbound UPS/USPS tracking, never internal DHL/FedEx.
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
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
  const outboundTrack = order.trackingNumber && ["UPS", "USPS"].includes(carrierFor(order.trackingNumber)) ? order.trackingNumber : null;
  const statusLabel = paid ? "Paid" : started ? "In production" : order.status === "quoted" ? "Awaiting payment" : titleCaseStatus(order.status);
  const shipAddr = order.shippingAddress?.line1
    ? { line1: order.shippingAddress.line1 ?? "", line2: order.shippingAddress.line2 ?? "", city: order.shippingAddress.city ?? "", state: order.shippingAddress.state ?? "", postalCode: order.shippingAddress.postalCode ?? "" }
    : null;

  return (
    <div className="space-y-8">
      {/* This order at a glance: status, total (with shipping once known), and
          Pay / Pay balance / Track by state. */}
      <section className="border border-line bg-steel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="display text-foreground">{order.reference} · {statusLabel}</p>
          {totalCents > 0 && (
            <p className="text-sm text-muted mt-0.5">
              {shippingCents > 0 ? `${money(totalCents)} goods + ${money(shippingCents)} shipping = ${money(grandTotal)}` : money(totalCents)}
            </p>
          )}
          {showPayBalance && <p className="text-sm text-amber-300 mt-0.5">Balance due: {money(balanceDue)}</p>}
        </div>
        <div className="flex items-center gap-2">
          {showPayDeposit && (
            <a href={payUrl!} target="_blank" rel="noopener noreferrer" className="display text-sm bg-brand text-on-brand px-5 min-h-[44px] inline-flex items-center rounded hover:bg-brand-dark">Pay {money(totalCents)}</a>
          )}
          {showPayBalance && (
            <a href={order.balanceInvoiceUrl!} target="_blank" rel="noopener noreferrer" className="display text-sm bg-brand text-on-brand px-5 min-h-[44px] inline-flex items-center rounded hover:bg-brand-dark">Pay balance {money(balanceDue)}</a>
          )}
          {outboundTrack && (
            <a href={trackingUrlFor(outboundTrack)} target="_blank" rel="noopener noreferrer" className="display text-sm border border-brand/50 text-brand px-5 min-h-[44px] inline-flex items-center rounded hover:bg-brand/10">Track shipment</a>
          )}
        </div>
      </section>

      {/* Visual confirmation card so the coach (and screenshots they share with
          their players) make the team <-> uniform connection obvious. */}
      {design?.imageUrl && (
        <section className="rounded-xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            <a
              href={design.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Click to view full size"
              className="sm:w-72 aspect-[4/3] sm:aspect-auto sm:h-56 relative bg-white shrink-0 block hover:opacity-90 transition-opacity"
            >
              <Image
                src={design.imageUrl}
                alt={`${order.teamName} approved design`}
                fill
                sizes="(max-width: 640px) 100vw, 288px"
                className="object-contain p-1"
                unoptimized
              />
              <span className="absolute bottom-1 right-1 text-[10px] bg-ink/80 text-foreground px-1.5 py-0.5">🔍 enlarge</span>
            </a>
            <div className="px-4 py-3 flex-1">
              <p className="text-xs text-muted uppercase tracking-wider">
                {design.pending ? "Latest proof (pending approval)" : "Approved design"}
              </p>
              <p className="display text-lg text-foreground mt-1">{order.teamName}</p>
              <p className="text-xs text-muted mt-1">Design ref: <span className="font-mono">{design.reference}</span></p>
              <p className="text-xs text-muted mt-2">
                Every player entry on this roster is tied to this design.
              </p>
            </div>
          </div>
          {(design.designs?.length ?? 0) > 1 && (
            <div className="border-t border-line/60 px-4 py-3">
              <p className="text-xs text-muted uppercase tracking-wider mb-2">This team has {design.designs.length} approved designs - players pick which one(s) they want</p>
              <div className="flex flex-wrap gap-2">
                {design.designs.map((d) => (
                  <a key={d.image} href={d.image} target="_blank" rel="noopener noreferrer" className="w-24 border border-line rounded overflow-hidden hover:ring-2 hover:ring-brand" title={`View ${d.label}`}>
                    <Image src={d.image} alt={d.label} width={96} height={80} sizes="96px" className="h-20 w-full object-contain bg-white" unoptimized />
                    <span className="block px-1.5 py-1 text-[11px] text-muted leading-tight">{d.label}{d.sku ? <span className="block font-mono text-[10px] opacity-70">{d.sku}</span> : null}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Where this order ships, editable by the customer (locked once shipped). */}
      {!order.localPickup && (
        <TeamOrderShipping token={order.manageToken!} initial={shipAddr} locked={order.status === "shipped" || Boolean(order.shippedAt)} />
      )}

      <ManageTabs tabs={tabs} />
    </div>
  );
}
