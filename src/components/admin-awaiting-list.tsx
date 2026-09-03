"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type Unpaid = {
  key: string;
  kind: "Deposit" | "Full payment" | "Final balance" | "Add-on" | "Custom invoice";
  customer: string;
  email: string | null;
  ref: string;
  amountCents: number;
  sinceISO: string;
  detail?: string;
  payUrl: string | null;
  href: string | null; // where the row opens (order page, or pay page for custom)
  invoiceId?: string; // custom invoices only - enables Void
  sendInvoice?: { orderId: string; stage: "deposit" | "balance"; ship: "auto" | "pickup"; rushShipping?: boolean }; // final invoice not sent yet
  teamOrderId?: string;
  canMarkUnresponsive?: boolean;
};

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const daysSince = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000));

const KIND_TONE: Record<Unpaid["kind"], string> = {
  Deposit: "border-sky-500/30 text-sky-300 bg-sky-500/10",
  "Full payment": "border-violet-500/30 text-violet-300 bg-violet-500/10",
  "Final balance": "border-amber-500/30 text-amber-300 bg-amber-500/10",
  "Add-on": "border-brand/30 text-brand bg-brand/10",
  "Custom invoice": "border-violet-500/30 text-violet-300 bg-violet-500/10",
};

type Filter = "all" | "follow-up" | Unpaid["kind"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All invoice types" },
  { value: "follow-up", label: "Needs follow-up (7+ days)" },
  { value: "Deposit", label: "Deposits" },
  { value: "Full payment", label: "Full payments" },
  { value: "Final balance", label: "Final balances" },
  { value: "Add-on", label: "Add-ons" },
  { value: "Custom invoice", label: "Custom invoices" },
];

function Age({ days, sinceISO }: { days: number; sinceISO: string }) {
  const tone = days >= 14
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : days >= 7
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-line bg-steel text-muted";
  const relative = days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium tabular-nums ${tone}`}>{relative}</span>
      <span className="text-[10px] text-muted/70">Sent {shortDate(sinceISO)}</span>
    </div>
  );
}

export function AdminAwaitingList({ items, generatedAtISO }: { items: Unpaid[]; generatedAtISO: string }) {
  const router = useRouter();
  const now = new Date(generatedAtISO).getTime();
  const [voiding, setVoiding] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
  const followUpItems = items.filter((item) => daysSince(item.sinceISO, now) >= 7);
  const followUpCents = followUpItems.reduce((sum, item) => sum + item.amountCents, 0);
  const shown = (() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "follow-up" && daysSince(item.sinceISO, now) < 7) return false;
      if (filter !== "all" && filter !== "follow-up" && item.kind !== filter) return false;
      if (!term) return true;
      return [item.customer, item.email, item.ref, item.kind, item.detail]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term));
    });
  })();

  async function sendFinalInvoice(it: Unpaid) {
    if (!it.sendInvoice) return;
    const deliveryMessage = it.sendInvoice.rushShipping
      ? " Rush shipping is already included, so no extra shipping charge will be added."
      : it.sendInvoice.ship === "auto"
        ? " It emails the coach a pay link with live shipping added."
        : " This is local pickup, so no shipping will be added.";
    if (!confirm(`Send the final balance invoice for ${it.customer} (${it.ref})?${deliveryMessage}`)) return;
    setSending(it.key);
    try {
      const res = await fetch("/api/admin/team-order/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId: it.sendInvoice.orderId, stage: it.sendInvoice.stage, ship: it.sendInvoice.ship }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send");
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(null);
    }
  }

  async function voidInvoice(id: string) {
    if (!confirm("Void this custom invoice? Its pay link stops working and it drops off this list. (Use this after combining it into another invoice.)")) return;
    setVoiding(id);
    try {
      const res = await fetch("/api/admin/custom-invoice", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to void");
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setVoiding(null);
    }
  }

  async function markUnresponsive(item: Unpaid) {
    if (!item.teamOrderId || !item.canMarkUnresponsive) return;
    if (!confirm(`Move ${item.customer} (${item.ref}) to Unresponsive? The order and Discord history stay saved and can be restored.`)) return;
    setArchiving(item.key);
    try {
      const res = await fetch("/api/admin/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "team_order", id: item.teamOrderId, archive: true, note: "Unresponsive - no reply" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not move this order.");
      router.refresh();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setArchiving(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-steel/40 px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-300" aria-hidden="true">✓</div>
        <p className="font-medium text-foreground">Everything is paid</p>
        <p className="mt-1 text-sm text-muted">There are no outstanding invoices right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section aria-label="Payment summary" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-steel/60 p-4 sm:p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Outstanding</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{money(totalCents)}</p>
          <p className="mt-1 text-xs text-muted">Across {items.length} {items.length === 1 ? "invoice" : "invoices"}</p>
        </div>
        <div className={`rounded-xl border p-4 sm:p-5 ${followUpItems.length ? "border-amber-500/30 bg-amber-500/[0.07]" : "border-line bg-steel/60"}`}>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Needs follow-up</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${followUpItems.length ? "text-amber-300" : "text-foreground"}`}>{followUpItems.length}</p>
          <p className="mt-1 text-xs text-muted">{followUpItems.length ? `${money(followUpCents)} due for 7+ days` : "No invoices older than 7 days"}</p>
        </div>
        <div className="rounded-xl border border-line bg-steel/60 p-4 sm:p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Oldest balance</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{daysSince(items[0].sinceISO, now)} days</p>
          <p className="mt-1 truncate text-xs text-muted">{items[0].customer} · {money(items[0].amountCents)}</p>
        </div>
      </section>

      <div className="rounded-xl border border-line bg-steel/30 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(220px,1fr)_220px]">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Customer, email, or invoice #"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/50 focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Show</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
                className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-sm text-foreground outline-none focus:border-brand"
              >
                {FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <p className="pb-2 text-xs tabular-nums text-muted">Showing {shown.length} of {items.length}</p>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No matching invoices</p>
          <p className="mt-1 text-xs text-muted">Try a different search or invoice type.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line md:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="bg-steel text-left text-[11px] uppercase tracking-[0.12em] text-muted">
                  <th className="w-[34%] px-4 py-3 font-medium">Customer</th>
                  <th className="w-[20%] px-4 py-3 font-medium">Invoice</th>
                  <th className="w-[15%] px-4 py-3 font-medium text-right">Age</th>
                  <th className="w-[15%] px-4 py-3 font-medium text-right">Amount</th>
                  <th className="w-[16%] px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => {
                  const days = daysSince(it.sinceISO, now);
                  return (
                    <tr key={it.key} className={`border-t border-line align-top transition-colors hover:bg-steel/50 ${days >= 14 ? "bg-red-500/[0.025]" : days >= 7 ? "bg-amber-500/[0.025]" : "bg-ink/20"}`}>
                      <td className="px-4 py-4">
                        <p className="font-medium leading-5 text-foreground">{it.customer}</p>
                        {it.email && <p className="mt-1 truncate text-xs text-muted" title={it.email}>{it.email}</p>}
                        {it.detail && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted/80" title={it.detail}>{it.detail}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${KIND_TONE[it.kind]}`}>{it.kind}</span>
                        <p className="mt-2 font-mono text-xs text-muted">{it.ref}</p>
                        {it.href?.startsWith("/") && <Link href={it.href} className="mt-2 inline-block text-xs font-medium text-brand hover:underline">View order</Link>}
                      </td>
                      <td className="px-4 py-4"><Age days={days} sinceISO={it.sinceISO} /></td>
                      <td className="px-4 py-4 text-right text-base font-semibold tabular-nums text-foreground">{money(it.amountCents)}</td>
                      <td className="px-4 py-4"><RowActions item={it} sending={sending} voiding={voiding} archiving={archiving} onSend={sendFinalInvoice} onVoid={voidInvoice} onMarkUnresponsive={markUnresponsive} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {shown.map((it) => {
              const days = daysSince(it.sinceISO, now);
              return (
                <article key={it.key} className={`rounded-xl border p-4 ${days >= 14 ? "border-red-500/20 bg-red-500/[0.035]" : days >= 7 ? "border-amber-500/20 bg-amber-500/[0.035]" : "border-line bg-steel/35"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${KIND_TONE[it.kind]}`}>{it.kind}</span>
                      <h2 className="mt-2 font-medium leading-5 text-foreground">{it.customer}</h2>
                      <p className="mt-1 font-mono text-xs text-muted">{it.ref}</p>
                    </div>
                    <p className="shrink-0 text-lg font-semibold tabular-nums text-foreground">{money(it.amountCents)}</p>
                  </div>
                  {it.email && <p className="mt-3 break-all text-xs text-muted">{it.email}</p>}
                  {it.detail && <p className="mt-2 text-xs leading-5 text-muted/80">{it.detail}</p>}
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-3">
                    <Age days={days} sinceISO={it.sinceISO} />
                    <div className="flex flex-col items-end gap-2">
                      {it.href?.startsWith("/") && <Link href={it.href} className="text-xs font-medium text-brand hover:underline">View order</Link>}
                      <RowActions item={it} sending={sending} voiding={voiding} archiving={archiving} onSend={sendFinalInvoice} onVoid={voidInvoice} onMarkUnresponsive={markUnresponsive} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function RowActions({
  item,
  sending,
  voiding,
  archiving,
  onSend,
  onVoid,
  onMarkUnresponsive,
}: {
  item: Unpaid;
  sending: string | null;
  voiding: string | null;
  archiving: string | null;
  onSend: (item: Unpaid) => Promise<void>;
  onVoid: (id: string) => Promise<void>;
  onMarkUnresponsive: (item: Unpaid) => Promise<void>;
}) {
  return (
    <div className="flex flex-col items-end gap-2">
      {item.sendInvoice ? (
        <button
          type="button"
          onClick={() => onSend(item)}
          disabled={sending === item.key}
          className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {sending === item.key ? "Sending…" : "Send invoice"}
        </button>
      ) : item.payUrl ? (
        <a
          href={item.payUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-dark"
        >
          Open pay link
        </a>
      ) : (
        <span className="text-xs text-muted/70">No pay link</span>
      )}
      {item.invoiceId && (
        <button
          type="button"
          onClick={() => onVoid(item.invoiceId!)}
          disabled={voiding === item.invoiceId}
          className="text-[11px] text-muted/70 hover:text-red-300 disabled:opacity-50"
        >
          {voiding === item.invoiceId ? "Voiding…" : "Void invoice"}
        </button>
      )}
      {item.canMarkUnresponsive && (
        <button
          type="button"
          onClick={() => onMarkUnresponsive(item)}
          disabled={archiving === item.key}
          className="text-[11px] text-muted/70 hover:text-amber-300 disabled:opacity-50"
        >
          {archiving === item.key ? "Moving…" : "Mark unresponsive"}
        </button>
      )}
    </div>
  );
}
