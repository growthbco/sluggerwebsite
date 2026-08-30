import Link from "next/link";
import type { Metadata } from "next";
import { readPortalToken, getCustomerOrdersCached, type PortalData } from "@/lib/portal";
import { trackingUrlFor, trackingUrlForCarrier } from "@/lib/tracking";
import { PortalOrderList, type OrderRow } from "@/components/portal-order-list";
import { claimDeadlineFromDelivery } from "@/lib/customer-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Orders", robots: { index: false } };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const shortDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

type TeamOrder = PortalData["teamOrders"][number];

// Outstanding balance = remaining goods + shipping, once a balance invoice is
// out and the order isn't paid in full.
function balanceDueCents(o: TeamOrder): number {
  if (o.invoicePaidAt || !o.depositPaidAt || !o.balanceInvoiceUrl) return 0;
  const dep = o.depositCents ?? Math.round(o.totalCents / 2);
  return Math.max(0, o.totalCents - dep) + o.shippingCents;
}

function statusFor(o: TeamOrder): { label: string; tone: "green" | "amber" | "gold" } {
  if (o.deliveredAt) return { label: "Delivered", tone: "green" };
  if (o.status === "shipped") return { label: "Shipped", tone: "green" };
  if (o.invoicePaidAt) return { label: "Paid", tone: "green" };
  if (balanceDueCents(o) > 0) return { label: "Balance due", tone: "amber" };
  if (o.depositPaidAt) return { label: "In production", tone: "gold" };
  if (o.status === "quoted") return { label: "Quoted · unpaid", tone: "amber" };
  if (o.status === "submitted") return { label: "Awaiting invoice", tone: "amber" };
  return { label: titleCase(o.status), tone: "gold" };
}

function Expired() {
  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-20 text-center">
      <h1 className="display text-3xl text-foreground">This link expired</h1>
      <p className="mt-3 text-muted">Portal links are valid for a short time for your security. Request a fresh one.</p>
      <Link href="/portal" className="inline-block mt-6 rounded bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark">Get a new link</Link>
    </div>
  );
}

export default async function PortalOrdersPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const email = readPortalToken(token);
  if (!email) return <Expired />;

  const data = await getCustomerOrdersCached(email);

  // Needs-your-money first: unpaid deposits and outstanding balances lead.
  const rank = (o: TeamOrder) => ((!o.depositPaidAt && !o.invoicePaidAt && ["quoted", "submitted"].includes(o.status)) || balanceDueCents(o) > 0 ? 0 : 1);
  const rows: OrderRow[] = data.teamOrders
    .filter((o) => o.status !== "cancelled")
    .sort((a, b) => rank(a) - rank(b) || +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((o) => {
      const s = statusFor(o);
      return {
        reference: o.reference,
        teamName: o.teamName.trim(),
        summary: o.pieceLabel,
        statusLabel: s.label,
        statusTone: s.tone,
        totalCents: o.totalCents + o.shippingCents,
        dateLabel: o.createdAt ? shortDate(o.createdAt) : "",
        timelineLabel: o.deliveredAt
          ? `Delivered ${shortDate(o.deliveredAt)} · report issues by ${shortDate(claimDeadlineFromDelivery(o.deliveredAt))}`
          : o.deliveryTargetAt
            ? `${o.deliveryTargetKind === "pickup" ? "Pickup target" : "Ready to ship target"} ${shortDate(o.deliveryTargetAt)}`
            : undefined,
        href: `/portal/${token}/o/${o.reference}`,
      };
    });

  return (
    <div className="space-y-8">
      <h2 className="display text-2xl text-foreground">Your orders</h2>
      <PortalOrderList orders={rows} />

      {data.shop.length > 0 && (
        <section className="space-y-2">
          <h3 className="display text-sm uppercase tracking-wide text-muted">Store &amp; shop orders</h3>
          {data.shop.map((s) => {
            const track = s.trackingNumber || null;
            return (
              <div key={s.reference} className="border border-line bg-steel px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="display text-foreground">{s.reference}</span>
                    <p className="text-sm text-foreground/90 mt-1">{titleCase(s.type)} order</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="display text-foreground tabular-nums">{money(s.totalCents)}</p>
                    <p className="text-xs text-muted mt-0.5">{shortDate(s.createdAt)}</p>
                  </div>
                </div>
                {track && (
                  <a href={trackingUrlFor(track)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-brand underline underline-offset-2">Tracking: {track}</a>
                )}
                {s.additionalShipments.map((shipment, index) => (
                  <div key={shipment.trackingNumber}>
                    <a href={trackingUrlForCarrier(shipment.trackingNumber, shipment.carrier)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-brand underline underline-offset-2">Package {index + 2}: {shipment.trackingNumber}</a>
                  </div>
                ))}
                {s.deliveredAt && (
                  <div className="mt-3 border-l-2 border-brand bg-brand/[0.06] px-3 py-2 text-sm">
                    <p className="text-foreground">Delivered {shortDate(s.deliveredAt)}</p>
                    <p className="mt-0.5 text-muted">Inspect every item and report a problem by {shortDate(claimDeadlineFromDelivery(s.deliveredAt))}.</p>
                    <Link href={`/contact?topic=delivery&order=${encodeURIComponent(s.reference)}`} className="mt-1 inline-block text-brand underline underline-offset-2">Report an order issue</Link>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {data.invoices.length > 0 && (
        <section className="space-y-2">
          <h3 className="display text-sm uppercase tracking-wide text-muted">Invoices</h3>
          {data.invoices.map((i) => (
            <div key={i.reference} className="border border-line bg-steel px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <span className="display text-foreground">{i.reference}</span>
                <p className="text-sm text-muted mt-0.5">{money(i.totalCents)} · {shortDate(i.createdAt)}</p>
              </div>
              {i.status !== "paid" && i.payUrl && (
                <a href={i.payUrl} target="_blank" rel="noopener noreferrer" className="display text-sm bg-brand text-on-brand px-4 min-h-[44px] inline-flex items-center rounded hover:bg-brand-dark">Pay {money(i.totalCents)}</a>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
