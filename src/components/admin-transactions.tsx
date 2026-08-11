"use client";

import { useMemo, useState } from "react";

export type Txn = {
  at: string;
  customer: string;
  ref: string;
  kind: "Deposit" | "Final balance" | "Paid in full" | "Add-on" | "Custom invoice" | "Team store" | "Buy-in" | "Shop";
  amountCents: number;
  method: "Stripe" | "Offline";
};

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

const KIND_TONE: Record<Txn["kind"], string> = {
  Deposit: "border-sky-500/50 text-sky-400 bg-sky-500/10",
  "Final balance": "border-green-500/50 text-green-400 bg-green-500/10",
  "Paid in full": "border-green-500/50 text-green-400 bg-green-500/10",
  "Add-on": "border-brand/50 text-brand bg-brand/10",
  "Custom invoice": "border-violet-500/50 text-violet-400 bg-violet-500/10",
  "Team store": "border-amber-500/50 text-amber-300 bg-amber-500/10",
  "Buy-in": "border-amber-500/50 text-amber-300 bg-amber-500/10",
  Shop: "border-line text-muted bg-background",
};
const KIND_CHIPS = ["All", "Deposit", "Final balance", "Paid in full", "Add-on", "Custom invoice", "Team store", "Shop"] as const;

/** The money ledger: summary tiles, search, kind + date filters, and a CSV
 *  export - modeled on the Masters transactions screen. */
export function AdminTransactions({ txns }: { txns: Txn[] }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<string>("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txns.filter((t) => {
      if (kind !== "All" && t.kind !== kind && !(kind === "Shop" && t.kind === "Buy-in")) return false;
      if (from && t.at < `${from}T00:00:00`) return false;
      if (to && t.at > `${to}T23:59:59`) return false;
      if (q && !`${t.customer} ${t.ref}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [txns, search, kind, from, to]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sum = (rows: Txn[]) => rows.reduce((s, t) => s + t.amountCents, 0);
  const teamKinds = new Set(["Deposit", "Final balance", "Paid in full", "Add-on"]);
  const tiles = [
    { label: "Total collected", value: money(sum(visible)), sub: `${visible.length} transaction${visible.length === 1 ? "" : "s"}` },
    { label: "This month", value: money(sum(visible.filter((t) => t.at >= monthStart))), sub: `${visible.filter((t) => t.at >= monthStart).length} payments` },
    { label: "Team orders", value: money(sum(visible.filter((t) => teamKinds.has(t.kind)))), sub: "deposits · balances · add-ons" },
    { label: "Stores & shop", value: money(sum(visible.filter((t) => !teamKinds.has(t.kind) && t.kind !== "Custom invoice"))), sub: "card checkouts" },
  ];

  function exportCsv() {
    const lines = [
      "Date,Customer,Reference,Kind,Amount,Method",
      ...visible.map((t) => `${fmtDate(t.at)},"${t.customer.replace(/"/g, '""')}",${t.ref},${t.kind},${(t.amountCents / 100).toFixed(2)},${t.method}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `slugger-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="border border-line bg-steel p-4">
            <p className="display text-2xl text-foreground">{t.value}</p>
            <p className="text-xs text-muted mt-1">{t.label} · {t.sub}</p>
          </div>
        ))}
      </div>

      <div className="border border-line bg-steel p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search by customer or reference…"
            className="flex-1 min-w-52 bg-background border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-background border border-line px-2 py-1.5 text-xs text-foreground" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-background border border-line px-2 py-1.5 text-xs text-foreground" />
          </label>
          <button type="button" onClick={exportCsv} className="text-xs display text-foreground border border-line px-3 py-2 hover:border-brand/50">
            ⬇ Export CSV
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {KIND_CHIPS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`text-xs display px-2.5 py-1 border ${kind === k ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:text-foreground hover:border-brand/40"}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-steel text-left">
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted">Date</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted">Customer</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted">Ref</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted">Kind</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted text-right">Amount</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted">Method</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => (
              <tr key={i} className="border-t border-line hover:bg-steel/60">
                <td className="px-3 py-2.5 text-muted whitespace-nowrap">{fmtDate(t.at)}</td>
                <td className="px-3 py-2.5 text-foreground">{t.customer}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted">{t.ref}</td>
                <td className="px-3 py-2.5"><span className={`inline-block border px-2 py-0.5 text-xs display ${KIND_TONE[t.kind]}`}>{t.kind}</span></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{money(t.amountCents)}</td>
                <td className="px-3 py-2.5 text-xs text-muted">{t.method === "Offline" ? "💵 Offline" : "Stripe"}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted">No transactions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
