import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { dbEnabled } from "@/db";
import { listDesignerInvoices, reconcileInvoice, designerLinkToken } from "@/lib/designer-invoices";
import { AdminInvoiceList, type AdminInvoice } from "@/components/admin-invoice-list";

export const metadata: Metadata = { title: "Designer Invoices", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/invoices")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const rows = await listDesignerInvoices();
  const invoices: AdminInvoice[] = rows.map((inv) => {
    const r = reconcileInvoice(inv);
    return {
      id: inv.id,
      reference: inv.reference,
      status: inv.status,
      designerName: inv.designerName,
      submittedAt: inv.submittedAt?.toISOString() ?? null,
      paidAt: inv.paidAt?.toISOString() ?? null,
      paidBy: inv.paidBy,
      notes: inv.notes,
      subtotalCents: inv.subtotalCents,
      dutyCents: inv.dutyCents,
      previousBalanceCents: inv.previousBalanceCents,
      totalCents: inv.totalCents,
      dutyBps: r.dutyBps,
      dutyFlag: r.dutyFlag,
      anyQtyMismatch: r.anyQtyMismatch,
      anyDoubleBill: r.anyDoubleBill,
      lines: r.lineChecks,
    };
  });

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "";
  const token = designerLinkToken();
  const designerLink = token ? `${SITE}/designer/invoice/${token}` : null;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Designer Invoices</h1>
      <p style={{ color: "#666", marginBottom: 20, lineHeight: 1.5 }}>
        Invoices the print vendor submits through his private link. Quantities are checked against
        our order records and the duty is flagged when it drifts out of the normal 15-19% range.
      </p>

      <div
        style={{
          background: "#f7f7f9",
          border: "1px solid #e5e5ea",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 13, color: "#888", marginBottom: 6 }}>Designer's submit link</div>
        {designerLink ? (
          <code style={{ fontSize: 14, wordBreak: "break-all", color: "#111" }}>{designerLink}</code>
        ) : (
          <p style={{ fontSize: 14, color: "#b00", margin: 0 }}>
            Not set yet. Add a <code>DESIGNER_INVOICE_TOKEN</code> environment variable, then this
            page will show the link to send him.
          </p>
        )}
      </div>

      <AdminInvoiceList invoices={invoices} canPay={session.role !== "designer"} />
    </div>
  );
}
