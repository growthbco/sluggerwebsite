"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminInvoiceLine = {
  team: string;
  garment: string;
  qty: number;
  unitCents: number;
  lineCents: number;
  orderRef?: string;
  ourQty?: number;
  qtyMismatch: boolean;
  alreadyBilledOn?: string;
};

export type AdminInvoice = {
  id: string;
  reference: string;
  status: string;
  designerName?: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  paidBy?: string | null;
  notes?: string | null;
  subtotalCents: number;
  dutyCents: number;
  previousBalanceCents: number;
  totalCents: number;
  dutyBps: number;
  dutyFlag: boolean;
  anyQtyMismatch: boolean;
  anyDoubleBill: boolean;
  lines: AdminInvoiceLine[];
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export function AdminInvoiceList({
  invoices,
  canPay,
}: {
  invoices: AdminInvoice[];
  canPay: boolean;
}) {
  if (!invoices.length) {
    return (
      <p style={{ color: "#888", padding: "40px 0", textAlign: "center" }}>
        No invoices submitted yet. When the designer submits one, it shows up here.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {invoices.map((inv) => (
        <InvoiceCard key={inv.id} inv={inv} canPay={canPay} />
      ))}
    </div>
  );
}

function InvoiceCard({ inv, canPay }: { inv: AdminInvoice; canPay: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(inv.status === "submitted");

  const flagged = inv.dutyFlag || inv.anyQtyMismatch || inv.anyDoubleBill;
  const statusColor =
    inv.status === "paid" ? "#2ea36b" : inv.status === "void" ? "#999" : flagged ? "#e5533c" : "#c79a3b";

  async function act(action: "paid" | "void") {
    if (action === "void" && !confirm("Void this invoice? It stays on record but is set aside.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inv.id, action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d?.error || "Action failed.");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${flagged && inv.status === "submitted" ? "#f0c4bc" : "#e5e5ea"}`,
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: statusColor,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {inv.reference}
            {inv.designerName ? <span style={{ color: "#888", fontWeight: 400 }}> · {inv.designerName}</span> : null}
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>
            {inv.lines.length} line{inv.lines.length === 1 ? "" : "s"} · {date(inv.submittedAt)}
            {inv.status === "paid" && inv.paidBy ? ` · paid by ${inv.paidBy}` : ""}
          </div>
        </div>
        {flagged && inv.status === "submitted" && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#c0392b",
              background: "#fdecea",
              padding: "3px 8px",
              borderRadius: 999,
            }}
          >
            ⚠ Needs a look
          </span>
        )}
        <div style={{ fontWeight: 800, fontSize: 17 }}>{money(inv.totalCents)}</div>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f0f0f2" }}>
          {/* Lines */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 12 }}>
            <thead>
              <tr style={{ color: "#999", textAlign: "left", fontSize: 12 }}>
                <th style={{ padding: "6px 6px 6px 0" }}>Team / garment</th>
                <th style={{ padding: 6, textAlign: "right" }}>Qty</th>
                <th style={{ padding: 6, textAlign: "right" }}>Each</th>
                <th style={{ padding: "6px 0 6px 6px", textAlign: "right" }}>Line</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i} style={{ borderTop: "1px solid #f3f3f5" }}>
                  <td style={{ padding: "8px 6px 8px 0" }}>
                    <div style={{ fontWeight: 600 }}>
                      {l.team || "—"}
                      {l.orderRef ? <span style={{ color: "#aaa", fontWeight: 400 }}> · {l.orderRef}</span> : null}
                    </div>
                    <div style={{ color: "#888", fontSize: 13 }}>{l.garment}</div>
                    {l.qtyMismatch && (
                      <div style={{ color: "#c0392b", fontSize: 12, marginTop: 2 }}>
                        ⚠ We have {l.ourQty} on record, he billed {l.qty}
                      </div>
                    )}
                    {l.alreadyBilledOn && (
                      <div style={{ color: "#c0392b", fontSize: 12, marginTop: 2, fontWeight: 700 }}>
                        ⚠ Already billed on {l.alreadyBilledOn} — do not pay twice
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 6, textAlign: "right", color: l.qtyMismatch ? "#c0392b" : "inherit" }}>
                    {l.qty}
                  </td>
                  <td style={{ padding: 6, textAlign: "right" }}>{money(l.unitCents)}</td>
                  <td style={{ padding: "8px 0 8px 6px", textAlign: "right", fontWeight: 600 }}>
                    {money(l.lineCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 10, fontSize: 14 }}>
            <Row label="Goods" value={money(inv.subtotalCents)} />
            <Row
              label={`Duty (${(inv.dutyBps / 100).toFixed(1)}%)`}
              value={money(inv.dutyCents)}
              warn={inv.dutyFlag}
              warnText={inv.dutyFlag ? "outside 15-19%" : undefined}
            />
            {inv.previousBalanceCents > 0 && (
              <Row label="Previous balance" value={money(inv.previousBalanceCents)} />
            )}
            <Row label="Total" value={money(inv.totalCents)} big />
          </div>

          {inv.notes && (
            <p style={{ marginTop: 10, fontSize: 13, color: "#666", fontStyle: "italic" }}>
              Note: {inv.notes}
            </p>
          )}

          {/* Actions */}
          {inv.status === "submitted" && canPay && (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={() => act("paid")}
                disabled={busy}
                style={{
                  background: "#2ea36b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 9,
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                Mark paid
              </button>
              <button
                onClick={() => act("void")}
                disabled={busy}
                style={{
                  background: "transparent",
                  color: "#999",
                  border: "1px solid #ddd",
                  borderRadius: 9,
                  padding: "10px 16px",
                  fontSize: 14,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                Void
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  big,
  warn,
  warnText,
}: {
  label: string;
  value: string;
  big?: boolean;
  warn?: boolean;
  warnText?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ color: warn ? "#c0392b" : big ? "#111" : "#777", fontWeight: big ? 700 : 400 }}>
        {label}
        {warn && warnText ? <span style={{ fontSize: 12 }}> ({warnText})</span> : null}
      </span>
      <span style={{ fontWeight: big ? 800 : 600, fontSize: big ? 17 : 14 }}>{value}</span>
    </div>
  );
}
