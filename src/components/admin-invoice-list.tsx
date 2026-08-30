"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";

export type AdminInvoiceLine = {
  team: string;
  garment: string;
  qty: number;
  unitCents: number;
  lineCents: number;
  orderRef?: string;
  ourQty?: number;
  ourUnitCents?: number;
  qtyMismatch: boolean;
  unitCostOverage: boolean;
  alreadyBilledOn?: string;
  /** No paid order backs this line - the customer hasn't paid us for it, so we
   *  shouldn't be paying the designer for it. */
  notPaid?: boolean;
  /** Couldn't confidently match this line to any order (manual/off-system) - verify. */
  unverifiedPay?: boolean;
};

export type AdminInvoice = {
  id: string;
  reference: string;
  viewToken?: string | null;
  status: string;
  designerName?: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  paidBy?: string | null;
  notes?: string | null;
  vendorRef?: string | null;
  attachmentUrls?: string[];
  subtotalCents: number;
  dutyCents: number;
  previousBalanceCents: number;
  totalCents: number;
  dutyBps: number;
  dutyFlag: boolean;
  anyQtyMismatch: boolean;
  anyUnitCostOverage: boolean;
  anyDoubleBill: boolean;
  anyNotPaid?: boolean;
  anyUnverifiedPay?: boolean;
  paymentBlockers: string[];
  lines: AdminInvoiceLine[];
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

function teamsLabel(lines: AdminInvoiceLine[]): string {
  const names = [...new Set(lines.map((l) => l.team).filter(Boolean))];
  if (!names.length) return "—";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

type Filter = "submitted" | "paid" | "void" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "submitted", label: "Unpaid" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
  { key: "all", label: "All" },
];

export function AdminInvoiceList({ invoices, canPay, wisePay = false, capCents = 0 }: { invoices: AdminInvoice[]; canPay: boolean; wisePay?: boolean; capCents?: number }) {
  const [filter, setFilter] = useState<Filter>("submitted");
  if (!invoices.length) {
    return <p className="text-muted text-center py-10">No invoices submitted yet. When the vendor submits one, it shows up here.</p>;
  }

  const counts: Record<Filter, number> = {
    all: invoices.length,
    submitted: invoices.filter((i) => i.status === "submitted").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    void: invoices.filter((i) => i.status === "void").length,
  };
  const shown = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`text-sm display px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.key ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:border-brand/40 hover:text-foreground"
            }`}
          >
            {f.label} <span className="tabular-nums opacity-70">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted text-center py-8">No {FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} invoices.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-steel text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-2 px-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Vendor</th>
                <th className="py-2 px-3 font-medium">Teams</th>
                <th className="py-2 px-3 font-medium text-right">Goods</th>
                <th className="py-2 px-3 font-medium text-right">Duty</th>
                <th className="py-2 px-3 font-medium text-right">Total</th>
                <th className="py-2 px-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((inv) => (
                <InvoiceRow key={inv.id} inv={inv} canPay={canPay} wisePay={wisePay} capCents={capCents} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InvoiceRow({ inv, canPay, wisePay, capCents }: { inv: AdminInvoice; canPay: boolean; wisePay: boolean; capCents: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const overCap = capCents > 0 && inv.totalCents > capCents;
  const [payOpen, setPayOpen] = useState(false);
  const [payResult, setPayResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const paymentBlocked = inv.paymentBlockers.length > 0;
  const flagged = paymentBlocked;

  async function doPay() {
    if (paymentBlocked) return;
    setBusy(true);
    setPayResult(null);
    try {
      const res = await fetch("/api/admin/invoice/pay-wise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inv.id, invoiceId: inv.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setPayResult({ ok: false, text: d?.error || "Wise payout failed." });
      else {
        setPayResult({ ok: true, text: `Sent. Wise transfer ${d.transferId} - ${d.targetAmount} ${d.targetCurrency} to Bonans. Invoice marked paid.` });
        router.refresh();
      }
    } catch {
      setPayResult({ ok: false, text: "Network error - try again." });
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "paid" | "void") {
    if (action === "paid" && paymentBlocked) return;
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
      } else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const statusPill =
    inv.status === "paid" ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-300">Paid</span>
    : inv.status === "void" ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-steel text-muted">Void</span>
    : <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300">Unpaid</span>;

  return (
    <Fragment>
      <tr
        onClick={() => setOpen((o) => !o)}
        className={`border-t border-line cursor-pointer hover:bg-steel/60 ${open ? "bg-steel/60" : ""} ${flagged && inv.status === "submitted" ? "bg-red-500/[0.04]" : ""}`}
      >
        <td className="py-2.5 px-3 text-muted whitespace-nowrap">{date(inv.submittedAt)}</td>
        <td className="py-2.5 px-3">
          <span className="text-foreground">{inv.designerName || "—"}</span>
          <span className="block font-mono text-[11px] text-muted">{inv.reference}</span>
        </td>
        <td className="py-2.5 px-3 text-foreground">{teamsLabel(inv.lines)} <span className="text-muted text-xs">· {inv.lines.length}</span></td>
        <td className="py-2.5 px-3 text-right text-muted tabular-nums whitespace-nowrap">{money(inv.subtotalCents)}</td>
        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
          <span className={inv.dutyFlag ? "text-red-400" : "text-muted"}>{money(inv.dutyCents)}</span>
          {inv.dutyFlag && <span className="block text-[10px] text-red-400">{(inv.dutyBps / 100).toFixed(0)}% ⚠</span>}
        </td>
        <td className="py-2.5 px-3 text-right text-foreground display tabular-nums whitespace-nowrap">{money(inv.totalCents)}</td>
        <td className="py-2.5 px-3 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-2">
            {flagged && inv.status === "submitted" && <span title="Needs a look" className="text-red-400">⚠</span>}
            {inv.status === "submitted" && canPay && !paymentBlocked ? (
              <button
                onClick={(e) => { e.stopPropagation(); act("paid"); }}
                disabled={busy}
                className="text-xs display bg-green-600 text-white rounded px-2.5 py-1 hover:bg-green-500 disabled:opacity-50"
              >
                Mark paid
              </button>
            ) : inv.status === "submitted" && paymentBlocked ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">Review</span>
            ) : (
              statusPill
            )}
          </div>
        </td>
      </tr>

      {open && (
        <tr className="border-t border-line/60 bg-ink/40">
          <td colSpan={7} className="px-3 pb-4 pt-1">
            <div className="flex flex-wrap items-center gap-3 py-2 text-xs">
              {statusPill}
              {inv.vendorRef && <span className="text-muted">Their invoice #: <span className="text-foreground font-mono">{inv.vendorRef}</span></span>}
              {inv.status === "paid" && inv.paidBy ? <span className="text-muted">Paid by {inv.paidBy}</span> : null}
              {inv.viewToken && (
                <>
                  <a href={`/invoice/${inv.viewToken}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Open invoice page ↗</a>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/invoice/${inv.viewToken}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="text-muted hover:text-foreground border border-line rounded px-2 py-0.5"
                  >
                    {copied ? "Copied ✓" : "Copy link"}
                  </button>
                </>
              )}
              {(inv.attachmentUrls ?? []).map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">📎 Their invoice{(inv.attachmentUrls?.length ?? 0) > 1 ? ` ${i + 1}` : ""} ↗</a>
              ))}
            </div>

            {inv.status === "submitted" && paymentBlocked && (
              <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/[0.06] px-3 py-2.5">
                <div className="text-sm font-semibold text-red-300">Payment locked until these charges are fixed:</div>
                <ul className="mt-1 list-disc pl-5 text-xs text-red-300/90 space-y-0.5">
                  {inv.paymentBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm mt-1">
                <thead>
                  <tr className="text-muted text-left text-xs">
                    <th className="py-1.5 pr-2">Team / garment</th>
                    <th className="py-1.5 px-2 text-right">Qty</th>
                    <th className="py-1.5 px-2 text-right">Each</th>
                    <th className="py-1.5 pl-2 text-right">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((l, i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="py-2 pr-2">
                        <div className="text-foreground font-medium">
                          {l.team || "—"}
                          {l.orderRef ? <span className="text-muted font-normal"> · {l.orderRef}</span> : null}
                        </div>
                        <div className="text-muted text-xs">{l.garment}</div>
                        {l.qtyMismatch && <div className="text-red-400 text-xs mt-0.5">We have {l.ourQty} on record, he billed {l.qty}</div>}
                        {l.unitCostOverage && <div className="text-red-400 text-xs mt-0.5 font-semibold">Saved rate {money(l.ourUnitCents ?? 0)} each — billed {money(l.unitCents)} each</div>}
                        {l.alreadyBilledOn && <div className="text-red-400 text-xs mt-0.5 font-semibold">Already billed on {l.alreadyBilledOn} — do not pay twice</div>}
                        {l.notPaid && <div className="text-red-400 text-xs mt-0.5 font-semibold">⚠ We haven&apos;t been paid for this — do not pay</div>}
                        {l.unverifiedPay && !l.notPaid && <div className="text-amber-400 text-xs mt-0.5">Not linked to a paid order — verify the customer paid</div>}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums ${l.qtyMismatch ? "text-red-400" : "text-foreground"}`}>{l.qty}</td>
                      <td className="py-2 px-2 text-right text-muted tabular-nums">{money(l.unitCents)}</td>
                      <td className="py-2 pl-2 text-right text-foreground font-medium tabular-nums">{money(l.lineCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 border-t border-line pt-2.5 text-sm max-w-sm ml-auto">
              <Row label="Goods" value={money(inv.subtotalCents)} />
              <Row label={`Duty (${(inv.dutyBps / 100).toFixed(1)}%)`} value={money(inv.dutyCents)} warn={inv.dutyFlag} warnText={inv.dutyFlag ? "outside 15-19%" : undefined} />
              {inv.previousBalanceCents > 0 && <Row label="Previous balance" value={money(inv.previousBalanceCents)} />}
              <Row label="Total" value={money(inv.totalCents)} big />
            </div>

            {inv.notes && <p className="mt-2.5 text-xs text-muted italic">Note: {inv.notes}</p>}

            {inv.status === "submitted" && canPay && (
              <div className="flex flex-wrap gap-2 mt-3.5 items-center">
                {!paymentBlocked && wisePay &&
                  (overCap ? (
                    <span className="text-xs text-amber-400 border border-amber-500/40 rounded-lg px-3 py-2.5">Over the cap - pay this one in the Wise app</span>
                  ) : (
                    <button onClick={() => { setPayResult(null); setPayOpen(true); }} disabled={busy} className="display text-sm bg-brand text-on-brand rounded-lg px-4 py-2.5 hover:bg-brand-dark disabled:opacity-50">Pay via Wise</button>
                  ))}
                {!paymentBlocked && <button onClick={() => act("paid")} disabled={busy} className="display text-sm bg-green-600 text-white rounded-lg px-4 py-2.5 hover:bg-green-500 disabled:opacity-50">Mark paid manually</button>}
                {paymentBlocked && <span className="text-xs text-red-300 border border-red-500/40 rounded-lg px-3 py-2.5">Remove or correct the flagged charges before paying</span>}
                <button onClick={() => act("void")} disabled={busy} className="text-sm text-muted border border-line rounded-lg px-4 py-2.5 hover:text-foreground hover:border-foreground/30 disabled:opacity-50">Void</button>
              </div>
            )}
          </td>
        </tr>
      )}

      {payOpen && (
        <tr>
          <td>
            <div className="fixed inset-0 z-[90] bg-black/70 grid place-items-center p-4" onClick={() => { if (!busy) { setPayOpen(false); setPayResult(null); } }} role="dialog" aria-modal="true">
              <div className="bg-steel border border-line rounded-xl w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="display text-lg text-foreground">Pay via Wise</h3>
                {!payResult ? (
                  <>
                    <p className="text-sm text-muted mt-2">Pay <span className="text-foreground font-semibold">{inv.reference}</span> — <span className="text-foreground font-semibold">{money(inv.totalCents)}</span> — to Bonans now?</p>
                    <p className="text-xs text-amber-400 mt-2 border border-amber-500/30 bg-amber-500/5 rounded-lg px-3 py-2">This sends real money from your Wise USD balance and marks the invoice paid.</p>
                    <div className="flex gap-2 mt-4 justify-end">
                      <button onClick={() => setPayOpen(false)} disabled={busy} className="text-sm text-muted border border-line rounded-lg px-4 py-2.5 hover:text-foreground hover:border-foreground/30 disabled:opacity-50">Cancel</button>
                      <button onClick={doPay} disabled={busy} className="display text-sm bg-brand text-on-brand rounded-lg px-4 py-2.5 hover:bg-brand-dark disabled:opacity-50">{busy ? "Sending…" : `Pay ${money(inv.totalCents)}`}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={`text-sm mt-3 leading-relaxed ${payResult.ok ? "text-green-400" : "text-red-400"}`}>{payResult.text}</p>
                    <div className="flex justify-end mt-4">
                      <button onClick={() => { setPayOpen(false); setPayResult(null); }} className="display text-sm bg-brand text-on-brand rounded-lg px-4 py-2.5 hover:bg-brand-dark">Done</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function Row({ label, value, big, warn, warnText }: { label: string; value: string; big?: boolean; warn?: boolean; warnText?: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={warn ? "text-red-400" : big ? "text-foreground display" : "text-muted"}>
        {label}
        {warn && warnText ? <span className="text-xs"> ({warnText})</span> : null}
      </span>
      <span className={`tabular-nums ${big ? "display text-lg text-foreground" : "text-foreground font-medium"}`}>{value}</span>
    </div>
  );
}
