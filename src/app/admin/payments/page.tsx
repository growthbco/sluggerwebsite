import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, teamOrderAddons, customInvoices, orders, teams } from "@/db/schema";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminTransactions, type Txn } from "@/components/admin-transactions";

export const metadata: Metadata = { title: "Transactions", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function offlineMethod(note: string | null, stages: string[]): string | null {
  const lines = (note ?? "").split(";").map((line) => line.trim());
  for (const line of lines) {
    const match = line.match(/^(deposit|balance|full) via ([^-]+?)\s*-/i);
    if (match && stages.includes(match[1].toLowerCase())) return match[2].trim();
  }
  return null;
}

// Recorded payment activity in one filterable view: team-order deposits and
// balances, paid add-ons, custom invoices, and store/shop order totals.
export default async function AdminTransactionsPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/payments")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const db = getDb();
  const [torders, addons, invoices, shopOrders, stores] = await Promise.all([
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        teamName: teamOrders.teamName,
        contactName: teamOrders.contactName,
        contactEmail: teamOrders.contactEmail,
        quotedTotalCents: teamOrders.quotedTotalCents,
        depositCents: teamOrders.depositCents,
        depositPaidAt: teamOrders.depositPaidAt,
        invoicePaidAt: teamOrders.invoicePaidAt,
        paymentNote: teamOrders.paymentNote,
        designerCostCents: teamOrders.designerCostCents,
      })
      .from(teamOrders),
    db
      .select({ id: teamOrderAddons.id, teamOrderId: teamOrderAddons.teamOrderId, rows: teamOrderAddons.rows, paidAt: teamOrderAddons.paidAt, totalCents: teamOrderAddons.totalCents, paidTotalCents: teamOrderAddons.paidTotalCents })
      .from(teamOrderAddons)
      .where(eq(teamOrderAddons.status, "paid")),
    db.select().from(customInvoices).orderBy(desc(customInvoices.createdAt)),
    db
      .select({ id: orders.id, reference: orders.reference, type: orders.type, status: orders.status, customerName: orders.customerName, customerEmail: orders.customerEmail, totalCents: orders.totalCents, createdAt: orders.createdAt, teamId: orders.teamId, addSessionIds: orders.addSessionIds })
      .from(orders)
      .orderBy(desc(orders.createdAt)),
    db.select({ id: teams.id, name: teams.name }).from(teams),
  ]);

  const orderById = new Map(torders.map((t) => [t.id, t]));
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const txns: Txn[] = [];

  for (const t of torders) {
    const total = t.quotedTotalCents ?? 0;
    const dep = t.depositCents ?? Math.round(total / 2);
    const paidInFull = Boolean(t.invoicePaidAt && t.depositPaidAt && Math.abs(+t.invoicePaidAt - +t.depositPaidAt) < 60000);
    if (t.depositPaidAt && !paidInFull && dep > 0) {
      const manual = offlineMethod(t.paymentNote, ["deposit"]);
      txns.push({
        id: `team-${t.id}-deposit`,
        at: t.depositPaidAt.toISOString(),
        customer: t.teamName.trim() || t.contactName,
        email: t.contactEmail,
        ref: t.reference,
        kind: "Deposit",
        amountCents: dep,
        method: manual ? "Offline" : "Stripe",
        methodDetail: manual ?? undefined,
        basis: "Goods",
        href: `/admin/team-order/${t.id}`,
      });
    }
    if (t.invoicePaidAt && (paidInFull ? total : total - dep) > 0) {
      const manual = offlineMethod(t.paymentNote, paidInFull ? ["full"] : ["balance"]);
      txns.push({
        id: `team-${t.id}-${paidInFull ? "full" : "balance"}`,
        at: t.invoicePaidAt.toISOString(),
        customer: t.teamName.trim() || t.contactName,
        email: t.contactEmail,
        ref: t.reference,
        kind: paidInFull ? "Paid in full" : "Final balance",
        amountCents: paidInFull ? total : Math.max(0, total - dep),
        method: manual ? "Offline" : "Stripe",
        methodDetail: manual ?? undefined,
        basis: "Goods",
        href: `/admin/team-order/${t.id}`,
      });
    }
  }
  for (const a of addons) {
    if (!a.paidAt) continue;
    const t = orderById.get(a.teamOrderId);
    const goods = a.rows.reduce((s, r) => s + r.unitPriceCents * r.quantity, 0);
    const paid = a.paidTotalCents ?? a.totalCents;
    const detail = a.rows.map(
      (r) => `${r.quantity}x ${r.label} - ${[r.size, r.name?.toUpperCase(), r.number ? `#${r.number}` : null, r.design].filter(Boolean).join(" - ")} - ${money(r.unitPriceCents)}`,
    );
    detail.push(`Goods ${money(goods)}${paid > goods ? ` + tax/shipping ${money(paid - goods)}` : ""} = ${money(paid)}`);
    txns.push({ id: `addon-${a.id}`, at: a.paidAt.toISOString(), customer: t?.teamName.trim() ?? "Add-on", email: t?.contactEmail ?? null, ref: t?.reference ?? "-", kind: "Add-on", amountCents: paid, method: "Stripe", basis: "Checkout total", href: t ? `/admin/team-order/${t.id}` : null, detail });
  }
  for (const inv of invoices) {
    if (inv.status === "paid" && inv.paidAt) {
      const detail = (inv.lines ?? []).map((l) => `${l.quantity}x ${l.description ?? l.name ?? "Item"} - ${money(l.unitPriceCents ?? 0)}`);
      txns.push({ id: `invoice-${inv.id}`, at: inv.paidAt.toISOString(), customer: inv.customerName, email: inv.customerEmail, ref: inv.reference, kind: "Custom invoice", amountCents: inv.totalCents, method: "Stripe", basis: "Checkout total", href: null, detail: detail.length ? detail : undefined });
    }
  }
  for (const o of shopOrders) {
    if (o.status !== "paid" && o.status !== "fulfilled") continue;
    const customer = o.teamId ? `${storeNameById.get(o.teamId) ?? "Store"}${o.customerName ? ` · ${o.customerName}` : ""}` : (o.customerName ?? "Shop order");
    const detail = (o.addSessionIds?.length ?? 0) > 0
      ? [`Cumulative order total includes ${o.addSessionIds!.length} later add-on payment${o.addSessionIds!.length === 1 ? "" : "s"}.`]
      : undefined;
    txns.push({ id: `order-${o.id}`, at: o.createdAt.toISOString(), customer, email: o.customerEmail, ref: o.reference, kind: o.type === "team_store" ? "Team store" : o.type === "buy_in" ? "Buy-in" : "Shop", amountCents: o.totalCents, method: "Stripe", basis: "Order total", href: `/admin/order/${o.id}`, detail });
  }
  txns.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  // Margin roll-up over PAID-IN-FULL team orders: goods revenue vs the actual
  // designer cost recorded so far. Only orders with a recorded cost count toward
  // the margin %, so it fills in as costs get logged.
  let recordedRev = 0, recordedCost = 0, recordedN = 0, paidN = 0;
  for (const t of torders) {
    if (!t.invoicePaidAt) continue;
    const rev = t.quotedTotalCents ?? 0;
    if (rev <= 0) continue;
    paidN++;
    if (t.designerCostCents != null) { recordedRev += rev; recordedCost += t.designerCostCents; recordedN++; }
  }
  const marginCents = recordedRev - recordedCost;
  const marginPct = recordedRev > 0 ? Math.round((marginCents / recordedRev) * 100) : 0;
  const coveragePct = paidN > 0 ? Math.round((recordedN / paidN) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <AdminPageHeader eyebrow="Financials" title="Transactions" />
      <p className="-mt-3 max-w-2xl text-sm leading-6 text-muted">Review recorded payment activity, trace it back to the source order, and export the current view.</p>

      <div className="mt-7">
        <AdminTransactions txns={txns} generatedAtISO={new Date().toISOString()} />
      </div>

      {/* Margin stays secondary to the ledger and compares like-for-like data:
          only orders whose revenue and designer cost are both known. */}
      <section className="mt-8 rounded-xl border border-line bg-steel/40 p-4 sm:p-5" aria-labelledby="margin-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Profitability</p>
            <h2 id="margin-heading" className="mt-1 text-lg font-semibold text-foreground">Paid team-order margin snapshot</h2>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs ${coveragePct === 100 ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>Cost coverage: {recordedN}/{paidN} orders ({coveragePct}%)</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Revenue with costs", value: recordedRev > 0 ? money(recordedRev) : "—", tone: "text-foreground" },
            { label: "Designer cost", value: recordedRev > 0 ? money(recordedCost) : "—", tone: "text-foreground" },
            { label: "Gross margin", value: recordedRev > 0 ? money(marginCents) : "—", tone: recordedRev > 0 ? (marginPct >= 45 ? "text-green-300" : marginPct >= 30 ? "text-amber-300" : "text-red-300") : "text-muted" },
            { label: "Margin rate", value: recordedRev > 0 ? `${marginPct}%` : "—", tone: recordedRev > 0 ? (marginPct >= 45 ? "text-green-300" : marginPct >= 30 ? "text-amber-300" : "text-red-300") : "text-muted" },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg border border-line bg-ink/30 p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{metric.label}</p>
              <p className={`mt-2 text-lg font-semibold tabular-nums ${metric.tone}`}>{metric.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">Margin compares goods revenue and designer cost only for the {recordedN} paid orders with a recorded cost. Tax, customer shipping, duty, and inbound shipping are excluded.</p>
      </section>
    </div>
  );
}
