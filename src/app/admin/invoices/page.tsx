import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { dbEnabled } from "@/db";
import { listDesignerInvoices, reconcileInvoice, designerLinkToken, getBillableOrders, getOrderPaymentIndex, linePaymentStatus } from "@/lib/designer-invoices";
import { wiseEnabled, wisePayoutCapCents } from "@/lib/wise";
import { AdminInvoiceList, type AdminInvoice } from "@/components/admin-invoice-list";
import { AdminUnbilledTable, type UnbilledJob } from "@/components/admin-unbilled-table";
import { AdminCopyLink } from "@/components/admin-copy-link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminSettleDesigner } from "@/components/admin-settle-designer";

export const metadata: Metadata = { title: "Vendor Invoices", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function AdminInvoicesPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/invoices")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const rows = await listDesignerInvoices();
  // Produced orders (customer paid -> in production/paid/shipped) the vendor has
  // NOT billed us for yet - the same unbilled set they see on their own link.
  const billable = await getBillableOrders();
  const notInvoiced = billable.filter((b) => !b.alreadyBilledOn);
  const payIdx = await getOrderPaymentIndex();
  const invoices: AdminInvoice[] = rows.map((inv) => {
    const r = reconcileInvoice(inv);
    const lines = r.lineChecks.map((lc, i) => {
      const status = linePaymentStatus({ teamOrderId: inv.lines?.[i]?.teamOrderId, team: lc.team }, payIdx);
      return { ...lc, notPaid: status === "unpaid", unverifiedPay: status === "unknown" };
    });
    return {
      id: inv.id,
      reference: inv.reference,
      viewToken: inv.viewToken,
      status: inv.status,
      designerName: inv.designerName,
      submittedAt: inv.submittedAt?.toISOString() ?? null,
      paidAt: inv.paidAt?.toISOString() ?? null,
      paidBy: inv.paidBy,
      notes: inv.notes,
      vendorRef: inv.vendorRef,
      attachmentUrls: inv.attachmentUrls,
      subtotalCents: inv.subtotalCents,
      dutyCents: inv.dutyCents,
      previousBalanceCents: inv.previousBalanceCents,
      totalCents: inv.totalCents,
      dutyBps: r.dutyBps,
      dutyFlag: r.dutyFlag,
      anyQtyMismatch: r.anyQtyMismatch,
      anyDoubleBill: r.anyDoubleBill,
      anyNotPaid: lines.some((l) => l.notPaid),
      lines,
    };
  });

  const unbilledJobs: UnbilledJob[] = notInvoiced.map((b) => ({
    teamOrderId: b.teamOrderId,
    teamName: b.teamName,
    reference: b.reference,
    kind: b.kind,
    group: b.group,
    qty: b.pieces - (b.billedPieces ?? 0),
    unitCostCents: b.unitCostCents,
    since: b.since ?? null,
  }));

  // KPIs.
  const unpaidTotal = invoices.filter((i) => i.status === "submitted").reduce((s, i) => s + i.totalCents, 0);
  const producedNotBilled = notInvoiced.length;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "";
  const token = designerLinkToken();
  const designerLink = token ? `${SITE}/designer/invoice/${token}` : null;
  const canPay = session.role !== "designer";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageHeader eyebrow="Financials" title="Vendor Invoices" />
        <div className="flex items-center gap-2 pt-1">
          {designerLink && <AdminCopyLink link={designerLink} />}
          {canPay && producedNotBilled > 0 && <AdminSettleDesigner count={producedNotBilled} />}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 -mt-2 mb-8">
        <div className="rounded-xl border border-line bg-steel p-4">
          <div className="text-xs text-muted">Owed to vendor (unpaid)</div>
          <div className="display text-2xl text-brand tabular-nums mt-0.5">{money(unpaidTotal)}</div>
        </div>
        <div className="rounded-xl border border-line bg-steel p-4">
          <div className="text-xs text-muted">Produced, not billed</div>
          <div className="display text-2xl text-foreground tabular-nums mt-0.5">{producedNotBilled}</div>
        </div>
      </div>

      {/* Not billed yet - the nudge list */}
      <section className="mb-10">
        <h2 className="display text-lg text-foreground mb-1">Not billed yet</h2>
        <p className="text-xs text-muted mb-3">
          Produced jobs the customer paid for that the vendor hasn&apos;t invoiced. Same list they see on their link — once they bill one, it drops off here.
        </p>
        <AdminUnbilledTable jobs={unbilledJobs} />
      </section>

      {/* Invoices */}
      <section>
        <h2 className="display text-lg text-foreground mb-3">Invoices</h2>
        {!designerLink && (
          <p className="text-xs text-red-400 mb-3">
            Vendor link not set. Add a <code className="font-mono">DESIGNER_INVOICE_TOKEN</code> env var to enable it.
          </p>
        )}
        <AdminInvoiceList
          invoices={invoices}
          canPay={canPay}
          wisePay={wiseEnabled() && canPay}
          capCents={wisePayoutCapCents()}
        />
      </section>
    </div>
  );
}
