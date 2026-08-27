import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, designRequests, teamOrderAddons } from "@/db/schema";
import { getAdminSession, canAccess } from "@/lib/admin-auth";
import { getRoster, getPrintableJerseys, getSiblingPrintOrders, findRelatedOrdersByContact } from "@/lib/team-orders";
import { computeTeamOrderQuote, estimateOrderParcelsOz } from "@/lib/team-order-pricing";
import { itemLabel, sizeBreakdown, formatSize } from "@/lib/order-items";
import { quoteShippingCents } from "@/lib/ship-quote";
import { taxCents } from "@/lib/pricing";
import { inboundTrackingUrlFor } from "@/lib/tracking";
import { AdminInvoiceButton } from "@/components/admin-invoice-button";
import { AdminRecordPayment } from "@/components/admin-record-payment";
import { AdminJerseyStyle } from "@/components/admin-jersey-style";
import { AdminCustomPrice } from "@/components/admin-custom-price";
import { AdminLocalToggle } from "@/components/admin-local-toggle";
import { AdminEmbroideryToggle } from "@/components/admin-embroidery-toggle";
import { AdminRushToggle } from "@/components/admin-rush-toggle";
import { AdminTaxToggle } from "@/components/admin-tax-toggle";
import { AdminWhiteLabel } from "@/components/admin-white-label";
import { AdminMargin } from "@/components/admin-margin";
import { estimatedDesignerCostCents } from "@/lib/designer-invoices";
import { AdminPickupToggle } from "@/components/admin-pickup-toggle";
import { AdminDesignerNote } from "@/components/admin-designer-note";
import { AdminLinkDesign } from "@/components/admin-link-design";
import { AdminArchiveButton } from "@/components/admin-archive-button";
import { AdminShipButton } from "@/components/admin-ship-button";
import { AdminLabelButton } from "@/components/admin-label-button";
import { AdminPickupButton } from "@/components/admin-pickup-button";
import { AdminPendingAddons } from "@/components/admin-pending-addons";
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
    <section className="bg-steel border border-line rounded-xl p-5">
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
  const { id } = await params;
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, `/admin/team-order/${id}`)) redirect("/admin");

  const db = getDb();
  const [o] = await db.select().from(teamOrders).where(eq(teamOrders.id, id)).limit(1);
  if (!o) notFound();

  const [roster, jerseys, paidAddons, pendingAddonsRaw, activeDesigns, siblingPrintOrders] = await Promise.all([
    getRoster(o.id),
    getPrintableJerseys(o.id),
    db.select().from(teamOrderAddons).where(and(eq(teamOrderAddons.teamOrderId, o.id), eq(teamOrderAddons.status, "paid"))),
    db.select().from(teamOrderAddons).where(and(eq(teamOrderAddons.teamOrderId, o.id), eq(teamOrderAddons.status, "pending"))),
    db.select({ id: designRequests.id, teamName: designRequests.teamName, reference: designRequests.reference }).from(designRequests),
    o.designRequestId ? getSiblingPrintOrders(o.designRequestId, o.id) : Promise.resolve([]),
  ]);
  // Resolve each pending add-on's live Stripe payment link (new batches store
  // plink_ ids; legacy ones used expiring cs_ sessions with no reusable link).
  const pendingAddons = await Promise.all(
    pendingAddonsRaw.map(async (p) => {
      let payUrl: string | null = null;
      const sid = p.stripeCheckoutSessionId;
      if (sid?.startsWith("plink_")) {
        try {
          const { getStripe } = await import("@/lib/stripe");
          const pl = await getStripe().paymentLinks.retrieve(sid);
          if (pl.active) payUrl = pl.url;
        } catch {}
      }
      return { id: p.id, rows: p.rows, totalCents: p.totalCents, payUrl };
    }),
  );
  const design = o.designRequestId
    ? (await db.select().from(designRequests).where(eq(designRequests.id, o.designRequestId)).limit(1))[0] ?? null
    : null;
  const hasApprovedDesign = Boolean(
    o.approvedDesignUrl ||
      (design &&
        (design.status === "approved" || design.status === "ordered") &&
        (design.approvedDesignUrls?.length || design.approvedDesignUrl)),
  );

  // Duplicate guard: other non-cancelled orders sharing this contact.
  const relatedOrders = await findRelatedOrdersByContact({ excludeId: o.id, email: o.contactEmail, phone: o.contactPhone, teamName: o.teamName });

  const quote = computeTeamOrderQuote(o, roster);
  const estimate = o.quotedTotalCents ?? (quote.totalCents > 0 ? quote.totalCents : null);
  const deposit = o.depositCents ?? (estimate ? Math.round(estimate / 2) : 0);
  const paid = Boolean(o.invoicePaidAt) || o.status === "paid" || o.status === "shipped";
  const designBlocksOrder = !hasApprovedDesign && !paid && !o.depositPaidAt;
  const parcels = estimateOrderParcelsOz(roster);
  const weightOz = parcels.apparelOz + parcels.hatOz;
  const twoBoxes = parcels.apparelOz > 0 && parcels.hatOz > 0;
  // Hats ship in their own box: a mixed order is two parcels, charged twice.
  // Match what the invoice actually charges: a live carrier quote per parcel
  // for the ship-to ZIP (falls back to the weight formula when no ZIP on file),
  // so the admin estimate no longer under-reads far-away/heavy orders.
  const shipEstimate = o.localPickup
    ? 0
    : (
        await Promise.all(
          [parcels.apparelOz, parcels.hatOz]
            .filter((w) => w > 0)
            .map((w) => quoteShippingCents(o.shippingAddress?.postalCode ?? "", w)),
        )
      ).reduce((sum, q) => sum + q.chargedCents, 0);
  const verified = jerseys.filter((j) => j.verifiedAt).length;
  const breakdown = sizeBreakdown(roster, o.items ?? ["jersey"]);
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

  // The single most useful next step for this order, spelled out.
  const nextStep = o.archivedAt
    ? { text: `Archived${o.archivedNote ? ` - ${o.archivedNote}` : ""}`, tone: "text-muted" }
    : o.shippedAt
      ? { text: "Shipped - nothing left to do", tone: "text-green-400" }
      : paid
        ? o.trackingNumber
          ? { text: "Label ready - mark it shipped to email the customer tracking", tone: "text-amber-300" }
          : { text: "Paid in full - buy the shipping label", tone: "text-green-400" }
        : designBlocksOrder
          ? {
              text: design
                ? "Do not invoice - this design still needs approval"
                : "Do not invoice - link or create an approved design first",
              tone: "text-amber-300",
            }
        : o.depositPaidAt
          ? { text: "Deposit paid, in production - send the final invoice when it's ready", tone: "text-sky-400" }
          : estimate
            ? { text: o.invoiceUrl ? "Deposit invoice sent - waiting on payment" : "Roster in - send the 50% deposit invoice", tone: "text-amber-300" }
            : { text: "No roster yet - share the join link with the coach", tone: "text-muted" };

  // The ONE primary action for the current stage, surfaced in the Next step
  // banner so staff never hunt for it. The same components render here; the
  // sections below keep only secondary / edge controls to avoid a second big
  // button for the same stage.
  const nextAction =
    o.archivedAt || o.shippedAt ? null
      : designBlocksOrder
        ? design
          ? <Link href={`/admin/design-requests/${design.id}`} className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark whitespace-nowrap">Open design</Link>
          : null
      : paid
        ? o.trackingNumber
          ? <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber} label="Mark shipped + email customer" />
          : <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} suggestedLb={Math.max(1, Math.round(((parcels.apparelOz || parcels.hatOz) / 16) * 10) / 10)} />
        : o.depositPaidAt
          ? (estimate ? <AdminInvoiceButton teamOrderId={o.id} teamName={o.teamName} dueCents={estimate - deposit} stage="balance" resend={Boolean(o.balanceInvoiceUrl)} localPickup={o.localPickup} /> : null)
          : estimate
            ? o.invoiceUrl
              ? <AdminRecordPayment teamOrderId={o.id} teamName={o.teamName} depositPaid={false} suggestedDepositCents={deposit} />
              : <AdminInvoiceButton teamOrderId={o.id} teamName={o.teamName} dueCents={deposit} stage="deposit" resend={false} warnPrintFile={false} />
            : <a href={`/team-order/manage/${o.manageToken}`} target="_blank" rel="noopener noreferrer" className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark whitespace-nowrap">Open coach&apos;s page</a>;

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
        {/* Next step - always visible, always one thing, with the single big
            button for this stage right here so it's never hunted for. */}
        <div className="mt-4 border border-brand/40 bg-brand/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs display text-brand uppercase tracking-wide">Next step</span>
            <p className={`display mt-0.5 ${nextStep.tone}`}>{nextStep.text}</p>
          </div>
          {nextAction && <div className="shrink-0">{nextAction}</div>}
        </div>
      </header>

      {/* Duplicate guard: same-contact orders. Highlights likely duplicates
          (same team, unpaid) so staff can merge/delete instead of hunting. */}
      {relatedOrders.length > 0 && (
        <div className={`border px-4 py-3 ${relatedOrders.some((r) => r.likelyDuplicate) ? "border-[#e5533c]/50 bg-[#e5533c]/5" : "border-amber-300/40 bg-amber-300/5"}`}>
          <div className="text-xs display uppercase tracking-wide text-foreground">
            {relatedOrders.some((r) => r.likelyDuplicate) ? "Possible duplicate order" : "Other orders from this contact"}
          </div>
          <p className="text-sm text-muted mt-0.5">
            This customer has {relatedOrders.length} other {relatedOrders.length === 1 ? "order" : "orders"} on file. If any is an accidental restart, delete it so this team stays as one order.
          </p>
          <ul className="mt-2 space-y-1">
            {relatedOrders.map((r) => (
              <li key={r.id} className="text-sm">
                <Link href={`/admin/team-order/${r.id}`} className="text-brand hover:underline font-mono">{r.reference}</Link>
                <span className="text-muted">
                  {" "}· {r.teamName} · {r.players} {r.players === 1 ? "player" : "players"} · {r.status.replace(/_/g, " ")}
                  {r.hasDesign ? " · design linked" : " · no design"}
                  {r.paid ? " · paid" : ""}
                  {r.likelyDuplicate ? " · looks like a duplicate" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Customer */}
      <Section title="Customer">
        <dl className="grid sm:grid-cols-3 gap-4">
          <Field label="Name">{o.contactName}</Field>
          <Field label="Email"><a href={`mailto:${o.contactEmail}`} className="text-brand hover:underline break-all">{o.contactEmail}</a></Field>
          <Field label="Phone">
            {o.contactPhone ? (
              <span className="inline-flex items-center gap-2">
                <a href={`tel:${o.contactPhone}`} className="text-brand hover:underline">{o.contactPhone}</a>
                <a
                  href={`/admin/texts?to=${encodeURIComponent(o.contactPhone)}&name=${encodeURIComponent(o.contactName)}`}
                  className="text-xs display border border-brand/50 text-brand px-2 py-0.5 hover:bg-brand/10 whitespace-nowrap"
                  title="Open this customer in the Texts inbox"
                >
                  Text client
                </a>
              </span>
            ) : (
              "-"
            )}
          </Field>
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
        {roster.length > 0 && (
          <p className="mb-4 text-sm">
            <a href={`/api/admin/team-order/packing-view?id=${o.id}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Printable packing sheet (check off as you pack) </a>
          </p>
        )}
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
            <div key={r.id} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1.4fr_0.5fr_1.4fr_1fr] gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
              <span className="text-muted row-span-2 sm:row-span-1">{i + 1}</span>
              <span className="text-foreground uppercase truncate">{r.playerName || "-"}</span>
              <span className="text-muted">#{r.playerNumber || "-"}</span>
              <span className="text-muted col-start-2 sm:col-start-auto">
                {Object.entries(r.sizes ?? {}).map(([k, v]) => `${itemLabel(k)}: ${formatSize(v)}`).join(" · ") || formatSize(r.size) || "-"}
                {r.quantity && r.quantity > 1 ? ` ×${r.quantity}` : ""}
              </span>
              <span className="text-muted col-start-2 sm:col-start-auto">{[r.design, r.notes].filter(Boolean).join(" · ")}</span>
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
          <Field label="Deposit (50%)">{deposit ? money(deposit) : "-"} {o.depositPaidAt ? <span className="text-green-400">paid {fmtDate(o.depositPaidAt)}</span> : <span className="text-muted">not paid</span>}</Field>
          <Field label="Balance">{estimate ? money(Math.max(0, estimate - (o.depositPaidAt ? deposit : 0))) : "-"} {paid ? <span className="text-green-400">paid</span> : null}</Field>
          <Field label="Shipping">{paid || o.depositPaidAt ? (o.shippingChargedCents != null ? money(o.shippingChargedCents) : o.localPickup ? "pickup" : "on final invoice") : o.localPickup ? "free pickup" : `~${money(shipEstimate)} est.`}</Field>
        </dl>
        {/* True per-order margin: goods revenue minus the designer cost you
            actually paid (record it to replace the estimate). */}
        {estimate ? (
          <div className="mt-4">
            <AdminMargin
              teamOrderId={o.id}
              goodsCents={estimate}
              recordedCostCents={o.designerCostCents ?? null}
              estimatedCostCents={estimatedDesignerCostCents(o, roster)}
            />
          </div>
        ) : null}
        {o.paymentNote && <p className="mt-3 text-sm text-emerald-300/90">{o.paymentNote}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* The primary invoice/payment action for this stage lives in the
              Next step banner above. Secondary here: record an offline balance
              payment, resend the deposit invoice, and view the invoice/receipt. */}
          {!paid && o.depositPaidAt && estimate && (
            <AdminRecordPayment teamOrderId={o.id} teamName={o.teamName} depositPaid suggestedDepositCents={deposit} />
          )}
          {!paid && !o.depositPaidAt && o.invoiceUrl && estimate && (
            <AdminInvoiceButton teamOrderId={o.id} teamName={o.teamName} dueCents={deposit} stage="deposit" resend warnPrintFile={false} />
          )}
          {(o.invoiceUrl || estimate) && (
            <a href={`/api/admin/team-order/invoice-view?id=${o.id}`} target="_blank" rel="noopener noreferrer" className="text-sm display text-muted border border-line px-3 py-1.5 hover:border-brand/50 hover:text-foreground">
              {paid ? "View receipt" : "View invoice"}
            </a>
          )}
          {roster.some((r) => Object.entries(r.sizes ?? {}).some(([k, v]) => (k === "fitted_hat" || k === "snapback_hat") && (v ?? "").trim())) && (
            <a href={`/admin/team-order/${o.id}/hat-sheet`} target="_blank" rel="noopener noreferrer" className="text-sm display text-muted border border-line px-3 py-1.5 hover:border-brand/50 hover:text-foreground">
              Hat sheet
            </a>
          )}
        </div>
        {/* Pricing settings, locked once an invoice is out. */}
        {!o.invoiceUrl && !o.depositPaidAt && !paid && (
          <div className="mt-4 pt-4 border-t border-line/60 flex flex-wrap items-center gap-2">
            <span className="text-xs display text-muted uppercase tracking-wide w-full">Pricing settings</span>
            <AdminJerseyStyle teamOrderId={o.id} current={o.jerseyStyle} />
            <AdminCustomPrice teamOrderId={o.id} currentCents={o.customJerseyCents} />
            <AdminLocalToggle teamOrderId={o.id} local={o.localPricing} />
            <AdminTaxToggle teamOrderId={o.id} exempt={o.taxExempt} />
            <AdminWhiteLabel teamOrderId={o.id} whiteLabel={o.whiteLabel} />
            <AdminRushToggle teamOrderId={o.id} rush={o.rushShipping} />
            {roster.some((r) => Object.entries(r.sizes ?? {}).some(([k, v]) => (k === "fitted_hat" || k === "snapback_hat") && (v ?? "").trim())) && (
              <AdminEmbroideryToggle teamOrderId={o.id} waived={o.embroideryFeeWaived} />
            )}
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
                    {design.teamName} ({design.reference}) 
                  </a>
                ) : (
                  "Not linked to a design"
                )}
              </Field>
              <Field label="Print-file QA">
                {jerseys.length === 0 ? "No printable jerseys" : verified === jerseys.length ? (
                  <span className="text-green-400">All {jerseys.length} jerseys verified</span>
                ) : (
                  <span className="text-amber-300">{verified} of {jerseys.length} jerseys verified</span>
                )}
              </Field>
            </dl>
            {siblingPrintOrders.length > 0 && (
              <div className="border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <p className="display text-amber-300">Same design, other orders that also need print-file QA</p>
                <p className="text-xs text-muted mt-0.5">This team&apos;s pieces are split across more than one order (e.g. coaches ordered separately). Verify each one so nothing on the shared print sheet gets missed.</p>
                <ul className="mt-2 space-y-1">
                  {siblingPrintOrders.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                      <a href={`/admin/team-order/${s.id}`} className="text-brand hover:underline">
                        <span className="font-mono text-xs">{s.reference}</span> · {s.label}
                      </a>
                      <span className={s.verified === s.total ? "text-green-400 text-xs" : "text-amber-300 text-xs"}>
                        {s.verified === s.total ? `all ${s.total} verified` : `${s.verified}/${s.total} verified`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {o.designerNote && <p className="text-sm text-muted border-l-2 border-brand/60 pl-3">{o.designerNote}</p>}
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
      {pendingAddons.length > 0 && (
        <AdminPendingAddons teamOrderId={o.id} pending={pendingAddons} />
      )}
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
          <Field label="Est. weight">{weightOz > 0 ? `${(weightOz / 16).toFixed(1)} lb${twoBoxes ? " · 2 boxes (hats ship separately)" : ""}` : "-"}</Field>
          <Field label="Shipped">{o.shippedAt ? `${fmtDate(o.shippedAt)}` : "not yet"}</Field>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!o.balanceInvoiceUrl && !paid && <AdminPickupToggle teamOrderId={o.id} pickup={o.localPickup} />}
          {/* One ship flow: the primary Buy label + Mark shipped for a paid order
              live in the Next step banner. The same label button stays here for
              production-stage (deposit paid) pickup-first orders. After a label
              exists, Schedule pickup appears below - label, then pickup. */}
          {o.depositPaidAt && !paid && !o.shippedAt && !o.trackingNumber && (
            <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} suggestedLb={Math.max(1, Math.round(((parcels.apparelOz || parcels.hatOz) / 16) * 10) / 10)} />
          )}
          {o.trackingNumber && <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />}
          {/* Once a primary label exists, allow buying MORE parcels - a second
              box, a reship, or the hats going out separately. Each one emails
              the customer its tracking right away. */}
          {paid && o.trackingNumber && (
            <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} additional suggestedLb={twoBoxes ? Math.max(1, Math.round((parcels.hatOz / 16) * 10) / 10) : undefined} label="Buy another label + email" />
          )}
          {(o.shipTransactionId || (o.additionalShipments ?? []).some((s) => s.transactionId)) && (
            <AdminPickupButton kind="team_order" id={o.id} />
          )}
        </div>
        {(o.additionalShipments?.length ?? 0) > 0 && (
          <div className="mt-3 border-t border-line/60 pt-3">
            <p className="text-xs display uppercase tracking-wide text-muted">Additional shipments</p>
            <ul className="mt-1.5 space-y-1">
              {o.additionalShipments!.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">#{i + 2}</span>
                  <TrackingInfo trackingNumber={s.trackingNumber} labelUrl={s.labelUrl ?? null} />
                  <span className="text-xs text-muted">{fmtDate(s.at)} · customer emailed </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <p className="text-xs text-muted">
        Order links: <a className="text-brand hover:underline" href={`${SITE}/team-order/manage/${o.manageToken}`}>coach</a>
        {o.selfEntryToken ? <> · <a className="text-brand hover:underline" href={`${SITE}/team-order/join/${o.selfEntryToken}`}>player join</a></> : null}
        {design ? <> · <a className="text-brand hover:underline" href={`${SITE}/design/manage/${design.manageToken}`}>designer</a></> : null}
      </p>
    </div>
  );
}
