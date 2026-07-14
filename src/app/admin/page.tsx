import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders, teams, orders } from "@/db/schema";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { AdminLogout } from "@/components/admin-logout";
import { AdminInvoiceButton } from "@/components/admin-invoice-button";
import { AdminArchiveButton } from "@/components/admin-archive-button";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  pending_payment: "border-amber-500/50 text-amber-400",
  submitted: "border-brand/50 text-brand",
  in_design: "border-brand/50 text-brand",
  proof_sent: "border-sky-500/50 text-sky-400",
  changes_requested: "border-amber-500/50 text-amber-400",
  approved: "border-green-500/50 text-green-400",
  ordered: "border-green-500/50 text-green-400",
  cancelled: "border-line text-muted",
};

function Badge({ label }: { label: string }) {
  return (
    <span className={`inline-block border px-2 py-0.5 text-xs display ${STATUS_TONE[label] ?? "border-line text-muted"}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default async function AdminPage() {
  if (!adminEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Set ADMIN_PASSWORD to enable the dashboard.</div>;
  }
  if (!(await isAdmin())) redirect("/admin/login");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const db = getDb();
  const [designs, torders, stores, recentOrders] = await Promise.all([
    db
      .select({
        reference: designRequests.reference,
        teamName: designRequests.teamName,
        status: designRequests.status,
        contactName: designRequests.contactName,
        contactEmail: designRequests.contactEmail,
        revisionsUsed: designRequests.revisionsUsed,
        neededBy: designRequests.neededBy,
        messages: designRequests.messages,
        manageToken: designRequests.manageToken,
        updatedAt: designRequests.updatedAt,
      })
      .from(designRequests)
      .orderBy(desc(designRequests.updatedAt)),
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        teamName: teamOrders.teamName,
        status: teamOrders.status,
        contactEmail: teamOrders.contactEmail,
        manageToken: teamOrders.manageToken,
        jerseyStyle: teamOrders.jerseyStyle,
        rushShipping: teamOrders.rushShipping,
        quotedTotalCents: teamOrders.quotedTotalCents,
        invoiceUrl: teamOrders.invoiceUrl,
        invoicePaidAt: teamOrders.invoicePaidAt,
        archivedAt: teamOrders.archivedAt,
        archivedNote: teamOrders.archivedNote,
        updatedAt: teamOrders.updatedAt,
      })
      .from(teamOrders)
      .orderBy(desc(teamOrders.updatedAt)),
    db
      .select({
        id: teams.id,
        name: teams.name,
        storeActive: teams.storeActive,
        storeToken: teams.storeToken,
        orderCount: sql<number>`(select count(*) from ${orders} where ${orders.teamId} = ${teams.id})`,
        revenueCents: sql<number>`coalesce((select sum(${orders.totalCents}) from ${orders} where ${orders.teamId} = ${teams.id}), 0)`,
      })
      .from(teams)
      .orderBy(desc(teams.createdAt)),
    db
      .select({
        reference: orders.reference,
        type: orders.type,
        customerName: orders.customerName,
        totalCents: orders.totalCents,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(15),
  ]);

  const activeOrders = torders.filter((o) => !o.archivedAt);
  const archivedOrders = torders.filter((o) => o.archivedAt);

  // Price each unpaid team order from its roster so "Send invoice" can show
  // the number upfront. Roster fetches are per-order but the list is small.
  const orderEstimates = new Map<string, number>();
  for (const o of activeOrders) {
    if (o.status === "paid" || o.invoicePaidAt) continue;
    try {
      const roster = await getRoster(o.id);
      if (roster.length) orderEstimates.set(o.id, computeTeamOrderQuote(o, roster).totalCents);
    } catch {}
  }

  const needsAction = designs.filter((d) => {
    const lastMsg = d.messages?.[d.messages.length - 1];
    return d.status === "changes_requested" || d.status === "submitted" || lastMsg?.from === "client";
  });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <div className="flex items-center justify-between">
        <div>
          <span className="display text-brand text-sm">Staff Dashboard</span>
          <h1 className="display text-4xl text-foreground mt-1">All Projects</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/customers" className="text-xs display text-foreground border border-line px-3 py-1.5 hover:border-brand/50">
            Customers →
          </Link>
          <AdminLogout />
        </div>
      </div>

      {needsAction.length > 0 && (
        <p className="mt-4 text-sm text-amber-400">
          ⚠ {needsAction.length} design{needsAction.length === 1 ? "" : "s"} waiting on us:{" "}
          {needsAction.map((d) => d.reference).join(", ")}
        </p>
      )}

      <section className="mt-10">
        <h2 className="display text-xl text-foreground">Design requests ({designs.length})</h2>
        <div className="mt-3 overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-steel text-left text-xs text-muted uppercase">
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Rev</th>
                <th className="px-3 py-2">Needed by</th>
                <th className="px-3 py-2">Last msg</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {designs.map((d) => {
                const lastMsg = d.messages?.[d.messages.length - 1];
                return (
                  <tr key={d.reference} className="hover:bg-steel/60">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/design/manage/${d.manageToken}`} className="text-brand hover:underline">
                        {d.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">{d.teamName}</td>
                    <td className="px-3 py-2"><Badge label={d.status} /></td>
                    <td className="px-3 py-2 text-muted">{d.contactName}</td>
                    <td className="px-3 py-2 text-muted">{d.revisionsUsed ?? 0}/5</td>
                    <td className="px-3 py-2 text-muted">{fmtDate(d.neededBy)}</td>
                    <td className="px-3 py-2 text-muted">
                      {lastMsg ? (lastMsg.from === "client" ? "⚠ client waiting" : lastMsg.name ?? "staff") : "-"}
                    </td>
                    <td className="px-3 py-2 text-muted">{fmtDate(d.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-xl text-foreground">Team orders ({activeOrders.length})</h2>
        <div className="mt-3 overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-steel text-left text-xs text-muted uppercase">
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {activeOrders.map((o) => {
                const estimate = o.quotedTotalCents ?? orderEstimates.get(o.id);
                const paid = o.status === "paid" || Boolean(o.invoicePaidAt);
                return (
                  <tr key={o.reference} className="hover:bg-steel/60">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/team-order/manage/${o.manageToken}`} className="text-brand hover:underline">
                        {o.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">{o.teamName}</td>
                    <td className="px-3 py-2"><Badge label={o.status} /></td>
                    <td className="px-3 py-2 text-muted">{o.contactEmail}</td>
                    <td className="px-3 py-2 text-foreground">
                      {estimate ? money(estimate) : "-"}
                      {estimate && !o.quotedTotalCents ? <span className="text-xs text-muted"> est.</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        {paid ? (
                          <span className="text-xs display text-green-400">PAID</span>
                        ) : estimate ? (
                          <AdminInvoiceButton
                            teamOrderId={o.id}
                            teamName={o.teamName}
                            estimateCents={estimate}
                            resend={Boolean(o.invoiceUrl)}
                          />
                        ) : (
                          <span className="text-xs text-muted">no roster</span>
                        )}
                        <AdminArchiveButton teamOrderId={o.id} archived={false} />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">{fmtDate(o.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {archivedOrders.length > 0 && (
        <details className="mt-6 border border-line bg-steel/50 group">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 list-none">
            <span className="display text-sm text-muted">Archived team orders ({archivedOrders.length})</span>
            <span className="text-brand transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="divide-y divide-[color:var(--line)] border-t border-line">
            {archivedOrders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <Link href={`/team-order/manage/${o.manageToken}`} className="font-mono text-xs text-brand hover:underline">
                    {o.reference}
                  </Link>
                  <span className="ml-2 text-foreground">{o.teamName}</span>
                  <span className="ml-2 text-muted">{o.contactEmail}</span>
                  {o.archivedNote && <span className="ml-2 text-xs text-amber-400/90">"{o.archivedNote}"</span>}
                  <span className="ml-2 text-xs text-muted">archived {fmtDate(o.archivedAt)}</span>
                </div>
                <AdminArchiveButton teamOrderId={o.id} archived={true} />
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="display text-xl text-foreground">Team stores ({stores.length})</h2>
          <div className="mt-3 border border-line divide-y divide-[color:var(--line)]">
            {stores.length === 0 && <p className="px-3 py-3 text-sm text-muted">No stores yet.</p>}
            {stores.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <Link href={`/store/${s.storeToken}`} className="text-brand hover:underline">
                    {s.name}
                  </Link>
                  <span className={`ml-2 text-xs display ${s.storeActive ? "text-green-400" : "text-muted"}`}>
                    {s.storeActive ? "OPEN" : "CLOSED"}
                  </span>
                </div>
                <p className="text-muted shrink-0">
                  {s.orderCount} orders · {money(Number(s.revenueCents))}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="display text-xl text-foreground">Recent paid orders</h2>
          <div className="mt-3 border border-line divide-y divide-[color:var(--line)]">
            {recentOrders.length === 0 && <p className="px-3 py-3 text-sm text-muted">No orders yet.</p>}
            {recentOrders.map((o) => (
              <div key={o.reference} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <span className="font-mono text-xs text-foreground">{o.reference}</span>
                  <span className="ml-2 text-muted">{o.customerName ?? "-"}</span>
                  <span className="ml-2 text-xs text-muted">({o.type})</span>
                </div>
                <p className="text-foreground shrink-0">
                  {money(o.totalCents)} <span className="text-muted text-xs">{fmtDate(o.createdAt)}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
