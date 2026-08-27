import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { isValidDesignerToken, getBillableOrders, getEditableDesignerInvoices, getPaidDesignerInvoices } from "@/lib/designer-invoices";
import { DesignerInvoiceForm, type EditableInvoice, type PaidInvoice } from "@/components/designer-invoice-form";

export const metadata: Metadata = {
  title: "Submit an Invoice - Slugger Athletics",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
        <p style={{ color: "#555", lineHeight: 1.5 }}>{children}</p>
      </div>
    </main>
  );
}

export default async function DesignerInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!dbEnabled()) {
    return <Centered title="Not available">The invoice tool is not configured yet.</Centered>;
  }
  if (!isValidDesignerToken(token)) {
    return (
      <Centered title="Link not found">
        This invoice link is invalid or has expired. Ask Slugger for a current link.
      </Centered>
    );
  }

  const [billable, editableRows, paidRows] = await Promise.all([
    getBillableOrders(),
    getEditableDesignerInvoices(),
    getPaidDesignerInvoices(),
  ]);
  const editable: EditableInvoice[] = editableRows.map((inv) => ({
    id: inv.id,
    reference: inv.reference,
    designerName: inv.designerName,
    notes: inv.notes,
    dutyCents: inv.dutyCents,
    previousBalanceCents: inv.previousBalanceCents,
    totalCents: inv.totalCents,
    submittedAt: inv.submittedAt?.toISOString() ?? null,
    vendorRef: inv.vendorRef,
    attachmentUrls: inv.attachmentUrls,
    lines: (inv.lines ?? []).map((l) => ({
      team: l.team,
      garment: l.garment,
      qty: l.qty,
      unitCents: l.unitCents,
      teamOrderId: l.teamOrderId,
      ourQty: l.ourQty,
    })),
  }));
  const paid: PaidInvoice[] = paidRows.map((inv) => ({
    id: inv.id,
    reference: inv.reference,
    totalCents: inv.totalCents,
    paidAt: inv.paidAt?.toISOString() ?? null,
    lineCount: (inv.lines ?? []).length,
  }));

  return <DesignerInvoiceForm token={token} billable={billable} editable={editable} paid={paid} />;
}
