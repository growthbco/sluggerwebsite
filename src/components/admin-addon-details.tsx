"use client";

import { useState } from "react";

type Row = { key: string; label: string; size: string; name?: string; number?: string; quantity: number; unitPriceCents: number };
type Addon = { rows: Row[]; totalCents: number; paidTotalCents?: number | null };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const TAX_RATE = 0.07;

/** Shows paid add-ons attached to a team order: a badge with the item count
 *  that opens a modal listing each added player (name / # / size) so staff can
 *  actually see what the add-on consists of and make it. */
export function AdminAddonDetails({ addons, teamName }: { addons: Addon[]; teamName: string }) {
  const [open, setOpen] = useState(false);
  const rows = addons.flatMap((a) => a.rows);
  const itemCount = rows.reduce((n, r) => n + Math.max(1, r.quantity ?? 1), 0);
  // Goods (pre-tax) vs what the customer actually paid. Shipping is whatever
  // the paid total exceeds goods + 7% tax (added when the add-on ships alone).
  const goods = addons.reduce((s, a) => s + a.totalCents, 0);
  const tax = Math.round(goods * TAX_RATE);
  const paidTotal = addons.reduce((s, a) => s + (a.paidTotalCents ?? 0), 0);
  const knowPaid = addons.every((a) => a.paidTotalCents != null);
  const shipping = knowPaid ? Math.max(0, paidTotal - goods - tax) : 0;
  if (itemCount === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View add-on items"
        className="text-xs display text-emerald-400 border border-emerald-500/40 px-2 py-0.5 hover:bg-emerald-500/10"
      >
        ＋{itemCount} add-on{itemCount === 1 ? "" : "s"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-ink border border-line max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-line sticky top-0 bg-ink">
              <p className="display text-foreground">＋ Add-on items — {teamName}</p>
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-foreground text-xl leading-none">✕</button>
            </div>
            <div className="p-4">
              <p className="text-xs text-muted mb-3">
                Paid add-ons ordered after the original order. Make these alongside the main roster.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs display text-muted border-b border-line">
                    <th className="py-1.5 pr-2">Name</th>
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">Item</th>
                    <th className="py-1.5 pr-2">Size</th>
                    <th className="py-1.5 pr-2 text-right">Qty</th>
                    <th className="py-1.5 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-line/50">
                      <td className="py-1.5 pr-2 text-foreground">{r.name?.trim() || "—"}</td>
                      <td className="py-1.5 pr-2 text-muted">{r.number?.trim() || "—"}</td>
                      <td className="py-1.5 pr-2 text-foreground">{r.label}</td>
                      <td className="py-1.5 pr-2 text-foreground">{r.size || "—"}</td>
                      <td className="py-1.5 pr-2 text-right text-muted">{r.quantity ?? 1}</td>
                      <td className="py-1.5 text-right text-muted">{money(r.unitPriceCents * (r.quantity ?? 1))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 border-t border-line pt-3 text-sm">
                <div className="flex justify-between"><span className="text-muted">Goods ({itemCount} {itemCount === 1 ? "piece" : "pieces"})</span><span className="text-foreground">{money(goods)}</span></div>
                <div className="flex justify-between"><span className="text-muted">FL sales tax (7%)</span><span className="text-foreground">{money(tax)}</span></div>
                {knowPaid && shipping > 0 && (
                  <div className="flex justify-between"><span className="text-muted">Shipping (ships separately)</span><span className="text-foreground">{money(shipping)}</span></div>
                )}
                <div className="flex justify-between mt-1 pt-1 border-t border-line display text-foreground">
                  <span>{knowPaid ? "Customer paid" : "Goods + tax"}</span>
                  <span>{money(knowPaid ? paidTotal : goods + tax)}</span>
                </div>
                {!knowPaid && (
                  <p className="text-xs text-muted mt-1">Plus shipping if this add-on shipped separately.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
