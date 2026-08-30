import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { dbEnabled } from "@/db";
import { adminEnabled, canAccess, getAdminSession } from "@/lib/admin-auth";
import {
  designerLinkToken,
  getBillableOrders,
  getEditableDesignerInvoices,
  getPaidDesignerInvoices,
} from "@/lib/designer-invoices";
import { DesignerInvoiceForm, type EditableInvoice, type PaidInvoice } from "@/components/designer-invoice-form";

export const metadata: Metadata = { title: "My Invoices", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DesignerInvoicesPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/designer-invoices")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const token = designerLinkToken();
  if (!token) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">The invoice workspace is not configured yet.</div>;
  }

  const [billable, editableRows, paidRows] = await Promise.all([
    getBillableOrders(),
    getEditableDesignerInvoices(),
    getPaidDesignerInvoices(),
  ]);
  const expectedUnitByOrder = new Map<string, number>();
  for (const order of billable) {
    if (typeof order.unitCostCents === "number") expectedUnitByOrder.set(order.teamOrderId, order.unitCostCents);
  }
  const editable: EditableInvoice[] = editableRows.map((invoice) => ({
    id: invoice.id,
    reference: invoice.reference,
    designerName: invoice.designerName,
    notes: invoice.notes,
    dutyCents: invoice.dutyCents,
    previousBalanceCents: invoice.previousBalanceCents,
    totalCents: invoice.totalCents,
    submittedAt: invoice.submittedAt?.toISOString() ?? null,
    vendorRef: invoice.vendorRef,
    attachmentUrls: invoice.attachmentUrls,
    lines: (invoice.lines ?? []).map((line) => ({
      team: line.team,
      garment: line.garment,
      qty: line.qty,
      unitCents: line.unitCents,
      teamOrderId: line.teamOrderId,
      ourQty: line.ourQty,
      ourUnitCents: line.teamOrderId ? expectedUnitByOrder.get(line.teamOrderId) : undefined,
    })),
  }));
  const paid: PaidInvoice[] = paidRows.map((invoice) => ({
    id: invoice.id,
    reference: invoice.reference,
    totalCents: invoice.totalCents,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    lineCount: (invoice.lines ?? []).length,
  }));

  return <DesignerInvoiceForm token={token} billable={billable} editable={editable} paid={paid} embedded />;
}
