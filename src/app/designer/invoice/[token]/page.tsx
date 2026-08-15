import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { isValidDesignerToken, getBillableOrders } from "@/lib/designer-invoices";
import { DesignerInvoiceForm } from "@/components/designer-invoice-form";

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

  const billable = await getBillableOrders();

  return <DesignerInvoiceForm token={token} billable={billable} />;
}
