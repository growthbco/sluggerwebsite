import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, designRequests, teamOrderAddons } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { getRoster, getPrintableJerseys } from "@/lib/team-orders";
import { computeTeamOrderQuote, estimateOrderWeightOz } from "@/lib/team-order-pricing";
import { itemLabel, sizeBreakdown } from "@/lib/order-items";
import { shippingCentsFor } from "@/lib/team-stores";
import { taxCents } from "@/lib/pricing";
import { inboundTrackingUrlFor } from "@/lib/tracking";
import { AdminInvoiceButton } from "@/components/admin-invoice-button";
import { AdminRecordPayment } from "@/components/admin-record-payment";
import { AdminJerseyStyle } from "@/components/admin-jersey-style";
import { AdminCustomPrice } from "@/components/admin-custom-price";
import { AdminLocalToggle } from "@/components/admin-local-toggle";
import { AdminTaxToggle } from "@/components/admin-tax-toggle";
import { AdminPickupToggle } from "@/components/admin-pickup-toggle";
import { AdminDesignerNote } from "@/components/admin-designer-note";
import { AdminLinkDesign } from "@/components/admin-link-design";
import { AdminArchiveButton } from "@/components/admin-archive-button";
import { AdminShipButton } from "@/components/admin-ship-button";
import { AdminLabelButton } from "@/components/admin-label-button";
import { TrackingInfo } from "@/components/tracking-info";
import { AdminRequote } from "@/components/admin-requote";

export const metadata: Metadata = { title: "Order Detail", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "-";

/** One clearly-labeled section card. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-steel border border-line p-5">
      <h2 className="display text-lg text-foreground">{title}</h2>
      {hint && <p className="text-sm text-muted mt-0.5">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs display text-muted uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5">{children}</dd>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  submitted: "text-amber-300 border-amber-300/40",
  quoted: "text-amber-300 border-amber-300/40",
  in_production: "text-sky-400 border-sky-400/40",
  paid: "text-green-400 border-green-400/40",
  shipped: "text-green-400 border-green-400/40",
};

export default async function AdminTeamOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!dbEnabled()) notFound();
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;

  const db = getDb();
  const [o] = await db.select().from(teamOrders).where(eq(teamOrders.id, id)).limit(1);
  if (!o) notFound();

  const [roster, jerseys, paidAddons, activeDesigns] = await Promise.all([
    getRoster(o.id),
    getPrintableJerseys(o.id),
    db.select().from(teamOrderAddons).where(and(eq(teamOrderAddons.teamOrderId, o.id), eq(teamOrderAddons.status, "paid"))),
    db.select({ id: designRequests.id, teamName: designRequests.teamName, reference: designRequests.reference }).from(designRequests),
  ]);
  const design = o.designRequestId
    ? (await db.select().from(designRequests).where(eq(designRequests.id, o.designRequestId)).limit(1))[0] ?? null
    : null;

  const quote = computeTeamOrderQuote(o, roster);
  const estimate = o.quotedTotalCents ?? (quote.totalCents > 0 ? quote.totalCents : null);
  const deposit = o.depositCents ?? (estimate ? Math.round(estimate / 2) : 0);
  const paid = Boolean(o.invoicePaidAt) || o.status === "paid" || o.status === "shipped";
  const weightOz = estimateOrderWeightOz(roster);
  const shipEstimate = o.localPickup ? 0 : weightOz > 0 ? shippingCentsFor(weightOz) : 0;
  const verified = jerseys.filter((j) => j.verifiedAt).length;
  const breakdown = sizeBreakdown(roster, o.items ?? ["jersey"]);
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

  // The single most useful next step for this order, spelled out.
  const nextStep = o.archivedAt
    ? { text: `Archived${o.archivedNote ? ` - ${o.archivedNote}` : ""}`, tone: "text-muted" }
    : o.shippedAt
      ? { text: "Shipped - nothing left to do 🎉", tone: "text-green-400" }
      : paid
        ? o.trackingNumber
          ? { text: "Label ready - mark it shipped to email the customer tracking", tone: "text-amber-300" }
          : { text: "Paid in full - buy the shipping label", tone: "text-green-400" }
        : o.depositPaidAt
          ? { text: "Deposit paid, in production - send the final invoice when it's ready", tone: "text-sky-400" }
          : estimate
            ? { text: o.invoiceUrl ? "Deposit invoice sent - waiting on payment" : "Roster in - send the 50% deposit invoice", tone: "text-amber-300" }
            : { text: "No roster yet - share the join link with the coach", tone: "text-muted" };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 space-y-6">
      {/* Header */}
      <header>
        <Link href="/admin" className="text-sm text-brand hover:underline">← Back to dashboard</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="display text-3xl text-foreground">{o.teamName}</h1>
            <p className="text-sm text-muted mt-1">
              <span className="font-mono">{o.reference}</span> · placed {fmtDate(o.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs display border px-2.5 py-1 rounded whitespace-nowrap ${STATUS_STYLE[o.status] ?? "text-muted border-line"}`}>
              {o.status.replace(/_/g, " ").toUpperCase()}
            </span>
            <AdminArchiveButton kind="team_order" id={o.id} archived={Boolean(o.archivedAt)} />
          </div>
        </div>
        {/* Next step - always visible, always one thing. */}
        <div className="mt-4 border border-brand/40 bg-brand/5 px-4 py-3">
          <span className="text-xs display text-brand uppercase tracking-wide">Next step</span>
          <p className={`display mt-0.5 ${nextStep.tone}`}>{nextStep.text}</p>
        </div>
      </header>

      {/* Customer */}
      <Section title="Customer">
        <dl className="grid sm:grid-cols-3 gap-4">
          <Field label="Name">{o.contactName}</Field>
          <Field label="Email"><a href={`mailto:${o.contactEmail}`} className="text-brand hover:underline">{o.contactEmail}</a></Field>
          <Field label="Phone">{o.contactPhone ? <a href={`tel:${o.contactPhone}`} className="text-brand hover:underline">{o.contactPhone}</a> : "-"}</Field>
          <Field label="Source">{o.source ?? "unknown (pre-tracking)"}</Field>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`/team-order/manage/${o.manageToken}`} target="_blank" rel="noopener noreferrer" className="text-sm display border border-brand/60 text-brand px-4 py-2 hover:bg-brand/10 whitespace-nowrap">Coach&apos;s page</a>
          {o.selfEntryToken && (
            <a href={`/team-order/join/${o.selfEntryToken}`} target="_blank" rel="noopener noreferrer" className="text-sm display border border-brand/60 text-brand px-4 py-2 hover:bg-brand/10 whitespace-nowrap">Player join link</a>
          )}
        </div>
      </Section>

      {/* What they ordered */}
      <Section title={`What they ordered (${roster.length} ${roster.length === 1 ? "row" : "rows"})`}>
        <dl className="grid sm:grid-cols-3 gap-4">
          <Field label="Jersey style">{o.jerseyStyle ?? "-"}</Field>
          <Field label="Material">{o.jerseyMaterial ?? "-"}</Field>
          <Field label="Items">{(o.items ?? ["jersey"]).map(itemLabel).join(" · ")}</Field>
        </dl>
        {breakdown.length > 0 && (
          <div className="mt-4 text-sm text-muted">
            {breakdown.map((b) => (
              <p key={b.key}><span className="text-foreground">{b.label}:</span> {b.parts.map((p) => `${p.n} ${p.size}`).join(" · ")} ({b.total})</p>
            ))}
          </div>
        )}
        <div className="mt-4 border border-line divide-y divide-[color:var(--line)]">
          {roster.map((r, i) => (
            <div key={r.id} className="grid grid-cols-[auto_1.4fr_0.5fr_1.4fr_1fr] gap-3 px-3 py-2 text-sm">
              <span className="text-muted">{i + 1}</span>
              <span className="text-foreground uppercase">{r.playerName || "-"}</span>
              <span className="text-muted">#{r.playerNumber || "-"}</span>
              <span className="text-muted">
                {Object.entries(r.sizes ?? {}).map(([k, v]) => `${itemLabel(k)}: ${v}`).join(" · ") || r.size || "-"}
                {r.quantity && r.quantity > 1 ? ` ×${r.quantity}` : ""}
              </span>
              <span className="text-muted">{[r.design, r.notes].filter(Boolean).join(" · ")}</span>
            </div>
          ))}
          {roster.length === 0 && <p className="px-3 py-3 text-sm text-muted">No players yet.</p>}
        </div>
        {paidAddons.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Includes {paidAddons.length} paid add-on {paidAddons.length === 1 ? "batch" : "batches"} (marked &quot;PAID ADD-ON&quot; above).
          </p>
        )}
      </Section>

      {/* Payment */}
      <Section title="Payment" hint="Two-stage invoicing: 50% deposit starts production, the balance is due before shipping.">
        {!paid && o.quotedTotalCents != null && quote.totalCents > 0 && quote.totalCents !== o.quotedTotalCents && (
          <div className="mb-4">
            <AdminRequote teamOrderId={o.id} lockedCents={o.quotedTotalCents} rosterCents={quote.totalCents} />
          </div>
        )}
        <dl className="grid sm:grid-cols-4 gap-4">
          <Field label="Order total">{estimate ? money(estimate) : "-"}{estimate && !o.quotedTotalCents ? <span className="text-xs text-muted"> est.</span> : null}</Field>
          <Field label="Deposit (50%)">{deposit ? money(deposit) : "-"} {o.depositPaidAt ? <span className="text-green-400">✓ paid {fmtDate(o.depositPaidAt)}</span> : <span className="text-muted">not paid</span>}</Field>
          <Field label="Balance">{estimate ? money(Math.max(0, estimate - (o.depositPaidAt ? deposit : 0))) : "-"} {paid ? <span className="text-green-400">✓ paid</span> : null}</Field>
          <Field label="Shipping">{paid || o.depositPaidAt ? (o.shippingChargedCents != null ? money(o.shippingChargedCents) : o.localPickup ? "pickup" : "on final invoice") : o.localPickup ? "free pickup" : `~${money(shipEstimate)} est.`}</Field>
        </dl>
        {o.paymentNote && <p className="mt-3 text-sm text-emerald-300/90">💵 {o.paymentNote}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!paid && !o.depositPaidAt && estimate ? (
            <AdminInvoiceButton teamOrderId={o.id} teamName={o.teamName} dueCents={deposit} stage="deposit" resend={Boolean(o.invoiceUrl)} warnPrintFile={false} />
          ) : null}
          {!paid && o.depositPaidAt && estimate ? (
            <AdminInvoiceButton teamOrderId={o.id} teamName={o.teamName} dueCents={estimate - deposit} stage="balance" resend={Boolean(o.balanceInvoiceUrl)} localPickup={o.localPickup} />
          ) : null}
          {!paid && <AdminRecordPayment teamOrderId={o.id} teamName={o.teamName} depositPaid={Boolean(o.depositPaidAt)} suggestedDepositCents={estimate ? deposit : null} />}
          {(o.invoiceUrl || estimate) && (
            <a href={`/api/admin/team-order/invoice-view?id=${o.id}`} target="_blank" rel="noopener noreferrer" className="text-sm display text-muted border border-line px-3 py-1.5 hover:border-brand/50 hover:text-foreground">
              {paid ? "View receipt" : "View invoice"}
            </a>
          )}
        </div>
        {/* Pricing settings, locked once an invoice is out. */}
        {!o.invoiceUrl && !paid && (
          <div className="mt-4 pt-4 border-t border-line/60 flex flex-wrap items-center gap-2">
            <span className="text-xs display text-muted uppercase tracking-wide w-full">Pricing settings</span>
            <AdminJerseyStyle teamOrderId={o.id} current={o.jerseyStyle} />
            <AdminCustomPrice teamOrderId={o.id} currentCents={o.customJerseyCents} />
            <AdminLocalToggle teamOrderId={o.id} local={o.localPricing} />
            <AdminTaxToggle teamOrderId={o.id} exempt={o.taxExempt} />
          </div>
        )}
        {estimate && !o.taxExempt && !paid && (
          <p className="mt-3 text-xs text-muted">Tax on the full order would be ~{money(taxCents(estimate))} (7% FL).</p>
        )}
      </Section>

      {/* Production */}
      <Section title="Production" hint="The design, notes for the designer, and print-file QA.">
        <div className="flex flex-col sm:flex-row gap-4">
          {design?.approvedDesignUrl && (
            <a href={design.approvedDesignUrl} target="_blank" rel="noopener noreferrer" className="relative w-40 h-32 bg-white border border-line shrink-0 block" title="Open full size">
              <Image src={design.approvedDesignUrl} alt="Approved design" fill sizes="160px" className="object-contain p-1" unoptimized />
            </a>
          )}
          <div className="flex-1 space-y-3">
            <dl className="grid sm:grid-cols-2 gap-4">
              <Field label="Design">
                {design ? (
                  <a href={`/design/manage/${design.manageToken}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                    {design.teamName} ({design.reference}) ↗
                  </a>
                ) : (
                  "Not linked to a design"
                )}
              </Field>
              <Field label="Print-file QA">
                {jerseys.length === 0 ? "No printable jerseys" : verified === jerseys.length ? (
                  <span className="text-green-400">✓ All {jerseys.length} jerseys verified</span>
                ) : (
                  <span className="text-amber-300">{verified} of {jerseys.length} jerseys verified</span>
                )}
              </Field>
            </dl>
            {o.designerNote && <p className="text-sm text-muted border-l-2 border-brand/60 pl-3">📝 {o.designerNote}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <AdminDesignerNote teamOrderId={o.id} current={o.designerNote} />
              {!o.designRequestId && <AdminLinkDesign teamOrderId={o.id} designs={activeDesigns} />}
            </div>
            {o.inboundTrackingNumber && (
              <p className="text-sm text-muted">
                Inbound (factory → shop):{" "}
                <a href={inboundTrackingUrlFor(o.inboundTrackingNumber, o.inboundCarrier)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  {o.inboundCarrier?.toUpperCase()} {o.inboundTrackingNumber}
                </a>{" "}
                <span className="text-xs">added {fmtDate(o.inboundTrackingAddedAt)}</span>
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* Shipping */}
      <Section title="Shipping">
        <dl className="grid sm:grid-cols-3 gap-4">
          <Field label="Deliver to">
            {o.localPickup ? (
              "Free local pickup (Ocala)"
            ) : o.shippingAddress?.line1 ? (
              <>
                {o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ""}<br />
                {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.postalCode}
              </>
            ) : (
              "No address yet (collected at payment)"
            )}
          </Field>
          <Field label="Est. weight">{weightOz > 0 ? `${(weightOz / 16).toFixed(1)} lb` : "-"}</Field>
          <Field label="Shipped">{o.shippedAt ? `✓ ${fmtDate(o.shippedAt)}` : "not yet"}</Field>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!o.balanceInvoiceUrl && !paid && <AdminPickupToggle teamOrderId={o.id} pickup={o.localPickup} />}
          {paid && !o.shippedAt && !o.trackingNumber && <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} />}
          {paid && !o.shippedAt && o.trackingNumber && (
            <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber} label="🚚 Mark shipped + email customer" />
          )}
          {o.trackingNumber && <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />}
        </div>
      </Section>

      <p className="text-xs text-muted">
        Order links: <a className="text-brand hover:underline" href={`${SITE}/team-order/manage/${o.manageToken}`}>coach</a>
        {o.selfEntryToken ? <> · <a className="text-brand hover:underline" href={`${SITE}/team-order/join/${o.selfEntryToken}`}>player join</a></> : null}
        {design ? <> · <a className="text-brand hover:underline" href={`${SITE}/design/manage/${design.manageToken}`}>designer</a></> : null}
      </p>
    </div>
  );
}
