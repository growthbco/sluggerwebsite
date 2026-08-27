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

// Every dollar in, as a single filterable ledger: team-order deposits and
// balances, paid add-ons, custom invoices, and store/shop purchases.
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
      .select({ teamOrderId: teamOrderAddons.teamOrderId, rows: teamOrderAddons.rows, paidAt: teamOrderAddons.paidAt, totalCents: teamOrderAddons.totalCents, paidTotalCents: teamOrderAddons.paidTotalCents })
      .from(teamOrderAddons)
      .where(eq(teamOrderAddons.status, "paid")),
    db.select().from(customInvoices).orderBy(desc(customInvoices.createdAt)).limit(200),
    db
      .select({ reference: orders.reference, type: orders.type, status: orders.status, customerName: orders.customerName, totalCents: orders.totalCents, createdAt: orders.createdAt, teamId: orders.teamId })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(400),
    db.select({ id: teams.id, name: teams.name }).from(teams),
  ]);

  const orderById = new Map(torders.map((t) => [t.id, t]));
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const txns: Txn[] = [];

  for (const t of torders) {
    // "Offline" ONLY when the money was recorded via the manual Record-Payment
    // flow (its note reads "<stage> via <method> - $X (date)"). A free-form note
    // like a delivery hand-off note must NOT mislabel a real Stripe payment.
    const offline = / via /.test(t.paymentNote ?? "");
    const total = t.quotedTotalCents ?? 0;
    const dep = t.depositCents ?? Math.round(total / 2);
    const paidInFull = Boolean(t.invoicePaidAt && t.depositPaidAt && Math.abs(+t.invoicePaidAt - +t.depositPaidAt) < 60000);
    if (t.depositPaidAt && !paidInFull && dep > 0) {
      txns.push({ at: t.depositPaidAt.toISOString(), customer: t.teamName.trim() || t.contactName, email: t.contactEmail, ref: t.reference, kind: "Deposit", amountCents: dep, method: offline ? "Offline" : "Stripe" });
    }
    if (t.invoicePaidAt && (paidInFull ? total : total - dep) > 0) {
      txns.push({ at: t.invoicePaidAt.toISOString(), customer: t.teamName.trim() || t.contactName, email: t.contactEmail, ref: t.reference, kind: paidInFull ? "Paid in full" : "Final balance", amountCents: paidInFull ? total : Math.max(0, total - dep), method: offline ? "Offline" : "Stripe" });
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
    txns.push({ at: a.paidAt.toISOString(), customer: t?.teamName.trim() ?? "Add-on", email: t?.contactEmail ?? null, ref: t?.reference ?? "-", kind: "Add-on", amountCents: paid, method: "Stripe", detail });
  }
  for (const inv of invoices) {
    if (inv.status === "paid" && inv.paidAt) {
      const detail = (inv.lines ?? []).map((l) => `${l.quantity}x ${l.description ?? l.name ?? "Item"} - ${money(l.unitPriceCents ?? 0)}`);
      txns.push({ at: inv.paidAt.toISOString(), customer: inv.customerName, email: inv.customerEmail, ref: inv.reference, kind: "Custom invoice", amountCents: inv.totalCents, method: "Stripe", detail: detail.length ? detail : undefined });
    }
  }
  for (const o of shopOrders) {
    if (o.status !== "paid" && o.status !== "fulfilled") continue;
    const customer = o.teamId ? `${storeNameById.get(o.teamId) ?? "Store"}${o.customerName ? ` · ${o.customerName}` : ""}` : (o.customerName ?? "Shop order");
    txns.push({ at: o.createdAt.toISOString(), customer, ref: o.reference, kind: o.type === "team_store" ? "Team store" : o.type === "buy_in" ? "Buy-in" : "Shop", amountCents: o.totalCents, method: "Stripe" });
  }
  txns.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  // Margin roll-up over PAID-IN-FULL team orders: goods revenue vs the actual
  // designer cost recorded so far. Only orders with a recorded cost count toward
  // the margin %, so it fills in as costs get logged.
  let paidRev = 0, recordedRev = 0, recordedCost = 0, recordedN = 0, paidN = 0;
  for (const t of torders) {
    if (!t.invoicePaidAt) continue;
    const rev = t.quotedTotalCents ?? 0;
    if (rev <= 0) continue;
    paidRev += rev; paidN++;
    if (t.designerCostCents != null) { recordedRev += rev; recordedCost += t.designerCostCents; recordedN++; }
  }
  const marginCents = recordedRev - recordedCost;
  const marginPct = recordedRev > 0 ? Math.round((marginCents / recordedRev) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <AdminPageHeader eyebrow="Financials" title="Transactions" />
      <p className="mt-2 text-muted">Every dollar in - deposits, balances, add-ons, invoices, and store purchases · {txns.length} total</p>

      {/* Real margin, as far as costs have been recorded. */}
      <div className="mt-6 border border-line bg-steel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-lg text-foreground">Margin (paid team orders)</h2>
          <span className="text-xs text-muted">{recordedN} of {paidN} orders have a recorded designer cost</span>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-xs display text-muted uppercase tracking-wide">Goods revenue (paid)</div>
            <div className="display text-lg text-foreground tabular-nums">{money(paidRev)}</div>
          </div>
          <div>
            <div className="text-xs display text-muted uppercase tracking-wide">Designer cost recorded</div>
            <div className="display text-lg text-foreground tabular-nums">{money(recordedCost)}</div>
          </div>
          <div>
            <div className="text-xs display text-muted uppercase tracking-wide">Gross margin (recorded)</div>
            <div className={`display text-lg tabular-nums ${recordedRev > 0 ? (marginPct >= 45 ? "text-green-400" : marginPct >= 30 ? "text-amber-300" : "text-red-400") : "text-muted"}`}>{recordedRev > 0 ? money(marginCents) : "-"}</div>
          </div>
          <div>
            <div className="text-xs display text-muted uppercase tracking-wide">Margin %</div>
            <div className={`display text-lg tabular-nums ${recordedRev > 0 ? (marginPct >= 45 ? "text-green-400" : marginPct >= 30 ? "text-amber-300" : "text-red-400") : "text-muted"}`}>{recordedRev > 0 ? `${marginPct}%` : "-"}</div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted/70">Goods only (tax + shipping excluded). Margin % covers only orders where you&apos;ve recorded the actual designer cost - open an order&apos;s Payment section to record it. Duty + inbound shipping aren&apos;t in estimates.</p>
      </div>
      <div className="mt-6">
        <AdminTransactions txns={txns} />
      </div>
    </div>
  );
}
