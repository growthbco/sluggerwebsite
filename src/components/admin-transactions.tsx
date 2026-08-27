"use client";

import { Fragment, useState } from "react";
import Link from "next/link";

export type Txn = {
  id: string;
  at: string;
  customer: string;
  email?: string | null;
  ref: string;
  kind: "Deposit" | "Final balance" | "Paid in full" | "Add-on" | "Custom invoice" | "Team store" | "Buy-in" | "Shop";
  amountCents: number;
  method: "Stripe" | "Offline";
  methodDetail?: string;
  basis: "Goods" | "Checkout total" | "Order total";
  href: string | null;
  detail?: string[];
};

type Range = "all" | "today" | "7d" | "30d" | "month" | "year" | "custom";

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
const fmtDate = (iso: string) => DATE_FORMATTER.format(new Date(iso));
const fmtTime = (iso: string) => TIME_FORMATTER.format(new Date(iso));
const dateKey = (iso: string) => {
  const parts = DATE_KEY_FORMATTER.formatToParts(new Date(iso));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const KIND_TONE: Record<Txn["kind"], string> = {
  Deposit: "border-sky-500/30 text-sky-300 bg-sky-500/10",
  "Final balance": "border-green-500/30 text-green-300 bg-green-500/10",
  "Paid in full": "border-green-500/30 text-green-300 bg-green-500/10",
  "Add-on": "border-brand/30 text-brand bg-brand/10",
  "Custom invoice": "border-violet-500/30 text-violet-300 bg-violet-500/10",
  "Team store": "border-amber-500/30 text-amber-300 bg-amber-500/10",
  "Buy-in": "border-amber-500/30 text-amber-300 bg-amber-500/10",
  Shop: "border-line text-muted bg-steel",
};

const KIND_OPTIONS = ["All", "Deposit", "Final balance", "Paid in full", "Add-on", "Custom invoice", "Team store", "Buy-in", "Shop"] as const;
const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
];

function KindBadge({ kind }: { kind: Txn["kind"] }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${KIND_TONE[kind]}`}>{kind}</span>;
}

function MethodBadge({ transaction }: { transaction: Txn }) {
  return transaction.method === "Offline" ? (
    <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-300">{transaction.methodDetail ?? "Offline"}</span>
  ) : (
    <span className="inline-flex rounded-full border border-line bg-steel px-2 py-1 text-[11px] text-muted">Stripe</span>
  );
}

function TransactionDetail({ transaction }: { transaction: Txn }) {
  return (
    <div className="space-y-1 text-xs leading-5 text-foreground/85">
      {transaction.detail?.map((line, index) => <p key={`${transaction.id}-detail-${index}`} className="tabular-nums">{line}</p>)}
    </div>
  );
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function AdminTransactions({ txns, generatedAtISO }: { txns: Txn[]; generatedAtISO: string }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<string>("All");
  const [method, setMethod] = useState<string>("All");
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const now = new Date(generatedAtISO);
  const nowKey = dateKey(generatedAtISO);
  const monthKey = nowKey.slice(0, 7);
  const yearKey = nowKey.slice(0, 4);
  const cutoff7 = now.getTime() - 7 * 86_400_000;
  const cutoff30 = now.getTime() - 30 * 86_400_000;
  const query = search.trim().toLowerCase();

  const visible = txns.filter((transaction) => {
    if (kind !== "All" && transaction.kind !== kind) return false;
    if (method !== "All" && transaction.method !== method) return false;

    const transactionTime = new Date(transaction.at).getTime();
    const transactionKey = dateKey(transaction.at);
    if (range === "today" && transactionKey !== nowKey) return false;
    if (range === "7d" && transactionTime < cutoff7) return false;
    if (range === "30d" && transactionTime < cutoff30) return false;
    if (range === "month" && !transactionKey.startsWith(monthKey)) return false;
    if (range === "year" && !transactionKey.startsWith(yearKey)) return false;
    if (range === "custom" && from && transactionKey < from) return false;
    if (range === "custom" && to && transactionKey > to) return false;

    if (!query) return true;
    return [transaction.customer, transaction.email, transaction.ref, transaction.kind, transaction.method, transaction.methodDetail, ...(transaction.detail ?? [])]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });

  const sum = (rows: Txn[]) => rows.reduce((total, transaction) => total + transaction.amountCents, 0);
  const goodsRows = visible.filter((transaction) => transaction.basis === "Goods");
  const otherRows = visible.filter((transaction) => transaction.basis !== "Goods");
  const stripeRows = visible.filter((transaction) => transaction.method === "Stripe");
  const offlineRows = visible.filter((transaction) => transaction.method === "Offline");
  const tiles = [
    { label: "Team-order goods", value: money(sum(goodsRows)), sub: `${goodsRows.length} payment${goodsRows.length === 1 ? "" : "s"}` },
    { label: "Checkout / order totals", value: money(sum(otherRows)), sub: `${otherRows.length} payment${otherRows.length === 1 ? "" : "s"}` },
    { label: "Stripe", value: money(sum(stripeRows)), sub: `${stripeRows.length} payment${stripeRows.length === 1 ? "" : "s"}` },
    { label: "Offline", value: money(sum(offlineRows)), sub: `${offlineRows.length} payment${offlineRows.length === 1 ? "" : "s"}` },
  ];
  const hasFilters = Boolean(search || kind !== "All" || method !== "All" || range !== "all" || from || to);

  function clearFilters() {
    setSearch("");
    setKind("All");
    setMethod("All");
    setRange("all");
    setFrom("");
    setTo("");
    setOpenId(null);
  }

  function exportCsv() {
    const headers = ["Date", "Customer", "Email", "Reference", "Type", "Amount", "Amount basis", "Method", "Details"];
    const rows = visible.map((transaction) => [
      `${fmtDate(transaction.at)} ${fmtTime(transaction.at)}`,
      transaction.customer,
      transaction.email ?? "",
      transaction.ref,
      transaction.kind,
      (transaction.amountCents / 100).toFixed(2),
      transaction.basis,
      transaction.methodDetail ?? transaction.method,
      (transaction.detail ?? []).join(" | "),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `slugger-transactions-${nowKey}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section aria-label="Filtered payment summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-line bg-steel/60 p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{tile.label}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{tile.value}</p>
            <p className="mt-1 text-xs text-muted">{tile.sub}</p>
          </div>
        ))}
      </section>
      <p className="text-xs leading-5 text-muted">Amounts stay separated by basis: team-order deposits and balances are merchandise values; other entries are stored checkout or cumulative order totals and may include tax or shipping.</p>

      <section className="rounded-xl border border-line bg-steel/30 p-3 sm:p-4" aria-label="Transaction filters">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_150px_auto] lg:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Customer, email, reference, or item"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/50 focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Type</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)} className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand">
              {KIND_OPTIONS.map((option) => <option key={option} value={option}>{option === "All" ? "All payment types" : option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Method</span>
            <select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand">
              <option value="All">All methods</option>
              <option value="Stripe">Stripe</option>
              <option value="Offline">Offline</option>
            </select>
          </label>
          <button type="button" onClick={exportCsv} disabled={visible.length === 0} className="rounded-lg border border-line px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:border-brand/50 disabled:opacity-40">Export CSV</button>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Period</span>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={range === option.value}
                onClick={() => setRange(option.value)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${range === option.value ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:border-brand/40 hover:text-foreground"}`}
              >
                {option.label}
              </button>
            ))}
            {hasFilters && <button type="button" onClick={clearFilters} className="ml-auto text-xs text-muted hover:text-foreground">Clear filters</button>}
          </div>
          {range === "custom" && (
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="text-xs text-muted">From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="ml-1.5 rounded-lg border border-line bg-ink px-2.5 py-2 text-xs text-foreground outline-none focus:border-brand" /></label>
              <label className="text-xs text-muted">To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="ml-1.5 rounded-lg border border-line bg-ink px-2.5 py-2 text-xs text-foreground outline-none focus:border-brand" /></label>
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Payment activity</h2>
        <p className="text-xs tabular-nums text-muted">Showing {visible.length} of {txns.length}</p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No matching payments</p>
          <p className="mt-1 text-xs text-muted">Try a different search, period, type, or method.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line md:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="bg-steel text-left text-[11px] uppercase tracking-[0.12em] text-muted">
                  <th className="w-[17%] px-4 py-3 font-medium">Date</th>
                  <th className="w-[29%] px-4 py-3 font-medium">Customer</th>
                  <th className="w-[23%] px-4 py-3 font-medium">Source</th>
                  <th className="w-[13%] px-4 py-3 font-medium">Method</th>
                  <th className="w-[18%] px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((transaction) => {
                  const isOpen = openId === transaction.id;
                  return (
                    <Fragment key={transaction.id}>
                      <tr className="border-t border-line bg-ink/20 align-top transition-colors hover:bg-steel/50">
                        <td className="px-4 py-4 text-muted">
                          <p className="whitespace-nowrap">{fmtDate(transaction.at)}</p>
                          <p className="mt-1 text-[10px] text-muted/70">{fmtTime(transaction.at)} ET</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium leading-5 text-foreground">{transaction.customer}</p>
                          {transaction.email && <a href={`mailto:${transaction.email}`} className="mt-1 block truncate text-xs text-muted hover:text-brand" title={transaction.email}>{transaction.email}</a>}
                          {transaction.detail?.length ? (
                            <button type="button" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : transaction.id)} className="mt-2 text-xs font-medium text-brand hover:underline">{isOpen ? "Hide details" : "View details"}</button>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <KindBadge kind={transaction.kind} />
                          <p className="mt-2 font-mono text-xs text-muted">{transaction.href ? <Link href={transaction.href} className="hover:text-brand hover:underline">{transaction.ref}</Link> : transaction.ref}</p>
                        </td>
                        <td className="px-4 py-4"><MethodBadge transaction={transaction} /></td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-base font-semibold tabular-nums text-foreground">{money(transaction.amountCents)}</p>
                          <p className="mt-1 text-[10px] text-muted/70">{transaction.basis}</p>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-line/60 bg-steel/25">
                          <td colSpan={5} className="px-6 py-3"><TransactionDetail transaction={transaction} /></td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {visible.map((transaction) => {
              const isOpen = openId === transaction.id;
              return (
                <article key={transaction.id} className="rounded-xl border border-line bg-steel/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <KindBadge kind={transaction.kind} />
                      <h3 className="mt-2 font-medium leading-5 text-foreground">{transaction.customer}</h3>
                      <p className="mt-1 font-mono text-xs text-muted">{transaction.href ? <Link href={transaction.href} className="hover:text-brand hover:underline">{transaction.ref}</Link> : transaction.ref}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold tabular-nums text-foreground">{money(transaction.amountCents)}</p>
                      <p className="mt-1 text-[10px] text-muted/70">{transaction.basis}</p>
                    </div>
                  </div>
                  {transaction.email && <a href={`mailto:${transaction.email}`} className="mt-3 block break-all text-xs text-muted hover:text-brand">{transaction.email}</a>}
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                    <div>
                      <p className="text-xs text-muted">{fmtDate(transaction.at)} · {fmtTime(transaction.at)} ET</p>
                      <div className="mt-2"><MethodBadge transaction={transaction} /></div>
                    </div>
                    {transaction.detail?.length ? (
                      <button type="button" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : transaction.id)} className="text-xs font-medium text-brand hover:underline">{isOpen ? "Hide details" : "View details"}</button>
                    ) : null}
                  </div>
                  {isOpen && <div className="mt-3 border-t border-line pt-3"><TransactionDetail transaction={transaction} /></div>}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
