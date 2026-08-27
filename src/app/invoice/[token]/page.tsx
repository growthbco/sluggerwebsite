import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getDesignerInvoiceByToken } from "@/lib/designer-invoices";

export const metadata: Metadata = { title: "Invoice - Slugger Athletics", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, fontFamily: "-apple-system, Segoe UI, Arial, sans-serif" }}>
      <p style={{ color: "#555", fontSize: 16 }}>{children}</p>
    </main>
  );
}

export default async function InvoiceViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!dbEnabled()) return <Centered>Not available.</Centered>;
  const inv = await getDesignerInvoiceByToken(token);
  if (!inv) return <Centered>This invoice link is invalid or has expired.</Centered>;

  const statusLabel = inv.status === "paid" ? "PAID" : inv.status === "void" ? "VOID" : "PENDING";
  const statusColor = inv.status === "paid" ? "#1a7f45" : inv.status === "void" ? "#888" : "#b8860b";

  return (
    <main style={{ background: "#f4f4f2", minHeight: "100dvh", padding: "32px 16px", fontFamily: "-apple-system, Segoe UI, Arial, sans-serif", color: "#1a1a1a" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", background: "#fff", borderRadius: 12, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "24px 28px", borderBottom: "3px solid #111", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>Slugger Athletics</div>
            <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>Vendor / Print Invoice</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700 }}>{inv.reference}</div>
            <span style={{ display: "inline-block", marginTop: 6, background: statusColor, color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", padding: "3px 10px", borderRadius: 999 }}>{statusLabel}</span>
          </div>
        </div>

        {/* Meta */}
        <div style={{ padding: "16px 28px", display: "flex", gap: 32, flexWrap: "wrap", fontSize: 13, color: "#444", borderBottom: "1px solid #eee" }}>
          {inv.designerName ? <div><div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>From</div>{inv.designerName}</div> : null}
          <div><div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Submitted</div>{fmtDate(inv.submittedAt)}</div>
          {inv.status === "paid" && inv.paidAt ? <div><div style={{ color: "#999", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Paid</div>{fmtDate(inv.paidAt)}</div> : null}
        </div>

        {/* Lines */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ color: "#888", textAlign: "left", fontSize: 12 }}>
              <th style={{ padding: "12px 28px 8px" }}>Team / item</th>
              <th style={{ padding: "12px 8px 8px", textAlign: "right" }}>Qty</th>
              <th style={{ padding: "12px 8px 8px", textAlign: "right" }}>Each</th>
              <th style={{ padding: "12px 28px 8px", textAlign: "right" }}>Line</th>
            </tr>
          </thead>
          <tbody>
            {(inv.lines ?? []).map((l, i) => (
              <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "10px 28px" }}>
                  <div style={{ fontWeight: 600 }}>{l.team || "-"}{l.orderRef ? <span style={{ color: "#999", fontWeight: 400 }}> · {l.orderRef}</span> : null}</div>
                  {l.garment ? <div style={{ color: "#777", fontSize: 12 }}>{l.garment}</div> : null}
                </td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.qty}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: "#666", fontVariantNumeric: "tabular-nums" }}>{money(l.unitCents)}</td>
                <td style={{ padding: "10px 28px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(l.qty * l.unitCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ padding: "16px 28px", borderTop: "2px solid #111" }}>
          <Row label="Goods" value={money(inv.subtotalCents)} />
          {inv.dutyCents > 0 ? <Row label="Duty" value={money(inv.dutyCents)} /> : null}
          {inv.previousBalanceCents > 0 ? <Row label="Previous balance" value={money(inv.previousBalanceCents)} /> : null}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee" }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{money(inv.totalCents)}</span>
          </div>
        </div>

        {inv.notes ? <p style={{ padding: "0 28px 20px", color: "#777", fontSize: 12, fontStyle: "italic" }}>Note: {inv.notes}</p> : null}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 14 }}>
      <span style={{ color: "#666" }}>{label}</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
