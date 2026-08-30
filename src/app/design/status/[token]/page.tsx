import type { Metadata } from "next";
import Link from "next/link";
import { dbEnabled } from "@/db";
import { getByStatusToken, MAX_REVISIONS } from "@/lib/design-requests";
import { getByDesignRequestId } from "@/lib/team-orders";
import { DesignStatusPanel } from "@/components/design-status-panel";
import { DesignMessages } from "@/components/design-messages";
import { TeamOrderManageSection } from "@/components/team-order-manage-section";
import { OrderStageTracker, type Stage } from "@/components/order-stage-tracker";
import { trackingUrlFor, trackingUrlForCarrier } from "@/lib/tracking";

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

  const reviewProofs = request.proofReviewUrls?.length ? request.proofReviewUrls : request.proofImages ?? [];
  const approvedProofs = request.approvedDesignUrls?.length
    ? request.approvedDesignUrls
    : request.approvedDesignUrl
      ? [request.approvedDesignUrl]
      : [];
  const isApproved = (request.status === "approved" || request.status === "ordered")
    && approvedProofs.length > 0
    && approvedProofs.every((url) => reviewProofs.includes(url));
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
    { label: shipped ? "Shipped" : "Final shipment", state: st(shipped, Boolean(depositDone && !shipped)) },
  ];

  const feeLabel =
    request.designFeeWaivedReason === "returning_customer"
      ? "Free design - welcome back, the mockup is on us"
      : "Free design - the mockup is on us";

  const nextStep = !isApproved
    ? request.proofImages?.length
      ? { title: "Review your proof", body: "Approve the design or request changes.", href: "#design", action: "Review design ↓" }
      : { title: "Your proof is being created", body: "We’ll email you when it’s ready to review.", href: null, action: null }
    : !order
      ? { title: "Your order page is being prepared", body: "Refresh in a moment to continue to roster and pricing.", href: null, action: null }
      : !submitted
      ? { title: "Finish your roster and review the price", body: "Add every athlete’s size, confirm the total, then submit.", href: "#roster", action: "Continue to roster ↓" }
      : !depositDone
        ? order.invoiceUrl
          ? { title: "Pay the deposit", body: "Your roster is confirmed. The deposit starts production.", href: order.invoiceUrl, action: "Pay deposit →" }
          : { title: "Deposit invoice is next", body: "Your roster is confirmed. We’ll email the invoice and place it here.", href: "#deposit", action: "View payment status ↓" }
        : shipped
          ? { title: "Your order shipped", body: "Use your carrier link to follow the delivery.", href: order?.trackingNumber ? trackingUrlForCarrier(order.trackingNumber, order.shipCarrier) : "#shipment", action: "Track shipment →" }
          : {
              title: "Your order is in production",
              body: request.rushApprovedAt
                ? "Customer tracking appears here only when your final package is on its way to you. Internal production tracking isn’t displayed."
                : "We’ll post tracking only after we receive the finished order and send the final package to you. Internal designer and supplier tracking isn’t displayed.",
              href: null,
              action: null,
            };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 space-y-6">
      {/* One link, whole order: the progress tracker orients the customer no
          matter which stage they land on. */}
      <div className="border border-line bg-foreground/[0.02] px-4 py-4">
        <OrderStageTracker stages={stages} />
      </div>

      <section className="border-2 border-brand/60 bg-brand/[0.08] px-5 py-4">
        <p className="display text-xs uppercase tracking-[0.16em] text-brand">Next step</p>
        <h2 className="display text-xl text-foreground mt-1">{nextStep.title}</h2>
        <p className="text-sm text-muted mt-1">{nextStep.body}</p>
        {nextStep.href && nextStep.action && (
          <Link href={nextStep.href} className="inline-flex mt-3 clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark">
            {nextStep.action}
          </Link>
        )}
      </section>

      <div className="text-sm px-4 py-2 border border-brand/40 bg-brand/5 text-foreground">{feeLabel}</div>

      {request.rush && (
        <div className={`text-sm px-4 py-3 border ${request.rushApprovedAt ? "border-brand/40 bg-brand/5" : "border-amber-500/40 bg-amber-500/5"} text-foreground`}>
          {request.rushApprovedAt ? (
            <>
              <strong>🚨 Two-week rush confirmed</strong>
              {request.neededBy
                ? ` - your requested in-hand date is ${request.neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" })}.`
                : "."}{" "}
              The flat $100 fee covers a two-week production target after final approval, roster, and deposit. Shipping time is additional.
            </>
          ) : (
            <>
              <strong>🚨 Rush requested</strong>
              {request.neededBy
                ? ` - needed by ${request.neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" })}.`
                : "."}{" "}
              We&apos;re reviewing the full timeline and will let you know shortly. Two-week rush is a flat $100 fee; shorter deadlines require a custom priority quote.
            </>
          )}
        </div>
      )}

      <section id="design" className="scroll-mt-6">
        <DesignStatusPanel
          token={token}
          teamName={request.teamName}
          productTypes={request.productTypes ?? []}
          status={request.status}
          proofImages={reviewProofs}
          supersededProofImages={(request.supersededProofUrls ?? []).filter((url) => !reviewProofs.includes(url))}
          proofLabels={request.proofLabels ?? {}}
          initialApprovedUrl={request.approvedDesignUrl}
          approvedUrls={approvedProofs}
          teamOrderUrl={order ? "#roster" : `/team-order?design=${token}`}
          revisionsUsed={request.revisionsUsed ?? 0}
          maxRevisions={MAX_REVISIONS}
        />
      </section>

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
        <section id="deposit" className="pt-6 border-t border-line scroll-mt-6">
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
        <section id="shipment" className="pt-6 border-t border-line scroll-mt-6">
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
                  <a href={trackingUrlForCarrier(order.trackingNumber, order.shipCarrier)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
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
            <p className="mt-2 text-sm text-muted">
              Your order is in production. {request.rushApprovedAt
                ? "Customer tracking will appear here only when the final package is on its way to you. Internal production tracking is not displayed."
                : "We’ll post and email tracking after the finished order reaches Slugger and we send the final package to you. Internal designer and supplier tracking is not displayed."}
            </p>
          )}
        </section>
      )}

      <div className="pt-6 border-t border-line">
        <DesignMessages token={token} role="client" initialMessages={request.messages ?? []} />
      </div>
    </div>
  );
}
