import type { Metadata } from "next";
import Link from "next/link";
import { dbEnabled } from "@/db";
import { getByStatusToken, MAX_REVISIONS } from "@/lib/design-requests";
import { getByDesignRequestId } from "@/lib/team-orders";
import { DesignStatusPanel } from "@/components/design-status-panel";
import { DesignMessages } from "@/components/design-messages";
import { TeamOrderManageSection } from "@/components/team-order-manage-section";
import { OrderStageTracker, type Stage } from "@/components/order-stage-tracker";
import { trackingUrlFor } from "@/lib/tracking";

export const metadata: Metadata = { title: "Your Order", robots: { index: false } };

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}

export default async function DesignStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!dbEnabled()) return <Centered title="Not available yet">Design requests aren&apos;t turned on yet.</Centered>;

  const request = await getByStatusToken(token);
  if (!request) return <Centered title="Link not found">This link is invalid or has expired.</Centered>;

  const isApproved = request.status === "approved" || request.status === "ordered";
  // The order this design turned into (auto-provisioned on approval). Drives the
  // roster / deposit / tracking stages of the hub.
  const order = isApproved ? await getByDesignRequestId(request.id) : null;

  // Lifecycle flags off the team order.
  const submitted = order ? !["draft", "collecting"].includes(order.status) : false;
  const depositDone = Boolean(order?.depositPaidAt || order?.invoicePaidAt) || ["in_production", "shipped"].includes(order?.status ?? "");
  const shipped = order?.status === "shipped" || Boolean(order?.shippedAt);
  const inProduction = order?.status === "in_production";
  // A deposit invoice can be sent from admin before the coach formally submits
  // the roster - the pay link must show on this page the moment it exists, or
  // the "Deposit" step is a dead end.
  const hasDepositInvoice = Boolean(order?.invoiceUrl);
  const depositReady = submitted || hasDepositInvoice || depositDone;

  // Build the four-stage tracker.
  const st = (done: boolean, active: boolean): Stage["state"] => (done ? "done" : active ? "active" : "todo");
  const stages: Stage[] = [
    { label: "Approve design", state: st(isApproved, !isApproved) },
    { label: "Roster & sizes", state: st(submitted, Boolean(isApproved && !submitted)) },
    { label: "Deposit", state: st(depositDone, Boolean(depositReady && !depositDone)) },
    { label: shipped ? "Shipped" : "Track", state: st(shipped, Boolean(depositDone && !shipped)) },
  ];

  const feeLabel =
    request.designFeeWaivedReason === "returning_customer"
      ? "Free design - welcome back, the mockup is on us"
      : "Free design - the mockup is on us";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 space-y-6">
      {/* One link, whole order: the progress tracker orients the customer no
          matter which stage they land on. */}
      <div className="border border-line bg-foreground/[0.02] px-4 py-4">
        <OrderStageTracker stages={stages} />
      </div>

      <div className="text-sm px-4 py-2 border border-brand/40 bg-brand/5 text-foreground">{feeLabel}</div>

      {request.rush && (
        <div className={`text-sm px-4 py-3 border ${request.rushApprovedAt ? "border-brand/40 bg-brand/5" : "border-amber-500/40 bg-amber-500/5"} text-foreground`}>
          {request.rushApprovedAt ? (
            <>
              <strong>🚨 Rush confirmed</strong>
              {request.neededBy
                ? ` - we'll have your order in hand by ${request.neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" })}.`
                : "."}{" "}
              A flat $100 rush order fee will be on your invoice and your order ships direct.
            </>
          ) : (
            <>
              <strong>🚨 Rush requested</strong>
              {request.neededBy
                ? ` - needed by ${request.neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" })}.`
                : "."}{" "}
              We&apos;re confirming we can meet your date and will let you know shortly. Rush orders carry a flat
              $100 rush order fee and ship direct.
            </>
          )}
        </div>
      )}

      <DesignStatusPanel
        token={token}
        reference={request.reference}
        teamName={request.teamName}
        status={request.status}
        proofImages={request.proofImages ?? []}
        proofLabels={request.proofLabels ?? {}}
        initialApprovedUrl={request.approvedDesignUrl}
        approvedUrls={request.approvedDesignUrls ?? []}
        teamOrderUrl={order ? "#roster" : `/team-order?design=${token}`}
        revisionsUsed={request.revisionsUsed ?? 0}
        maxRevisions={MAX_REVISIONS}
      />

      {/* STAGE 2 - Roster & sizes, on the same link once the design is approved. */}
      {isApproved && order && (
        <section id="roster" className="pt-6 border-t border-line space-y-6 scroll-mt-6">
          <h2 className="display text-2xl text-foreground">Your roster &amp; sizes</h2>
          <TeamOrderManageSection order={order} />
        </section>
      )}

      {/* STAGE 3 - Deposit. Visible the moment a deposit invoice exists (even
          before the coach formally submits the roster), so the pay link never
          dies into email. */}
      {isApproved && order && depositReady && (
        <section className="pt-6 border-t border-line">
          <h2 className="display text-2xl text-foreground">Deposit</h2>
          {depositDone ? (
            <p className="mt-2 text-sm text-foreground bg-brand/10 border border-brand/40 px-4 py-3">
              ✓ {order.invoicePaidAt ? "Paid in full" : "Deposit received"} - thank you! We&apos;re moving your order into production.
            </p>
          ) : order.invoiceUrl ? (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-muted">A 50% deposit gets your order into production. Balance is due before we ship.</p>
              <Link
                href={order.invoiceUrl}
                className="inline-block clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors"
              >
                Pay your deposit →
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Once your roster is finalized, we&apos;ll email your deposit invoice - it will show up here too.</p>
          )}
        </section>
      )}

      {/* STAGE 4 - Track. */}
      {isApproved && order && (shipped || inProduction) && (
        <section className="pt-6 border-t border-line">
          <h2 className="display text-2xl text-foreground">{shipped ? "Shipment" : "Production"}</h2>
          {shipped ? (
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-foreground">
                📦 Shipped
                {order.shippedAt ? ` on ${new Date(order.shippedAt).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric" })}` : ""}
                {order.shipCarrier ? ` via ${order.shipCarrier}` : ""}.
              </p>
              {order.trackingNumber && (
                <p>
                  <a href={trackingUrlFor(order.trackingNumber)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                    Track {order.trackingNumber} →
                  </a>
                </p>
              )}
              {(order.additionalShipments ?? []).map((s) => (
                <p key={s.trackingNumber}>
                  <a href={trackingUrlFor(s.trackingNumber)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                    Track {s.trackingNumber}{s.carrier ? ` (${s.carrier})` : ""} →
                  </a>
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Your order is in production. We&apos;ll post tracking here (and email it) the moment it ships.</p>
          )}
        </section>
      )}

      <div className="pt-6 border-t border-line">
        <DesignMessages token={token} role="client" initialMessages={request.messages ?? []} />
      </div>
    </div>
  );
}
