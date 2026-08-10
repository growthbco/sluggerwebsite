import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, isNotNull, sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { orders, teams } from "@/db/schema";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { AdminNewStore } from "@/components/admin-new-store";
import { STORE_ITEM_PRESETS } from "@/lib/team-stores";

export const metadata: Metadata = { title: "Team Stores", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

// Every team storefront on its own page: status, all-time sales, per-store
// order history, and the standalone-store creator.
export default async function AdminStoresPage() {
  if (!adminEnabled()) redirect("/admin");
  if (!(await isAdmin())) redirect("/admin/login");
  if (!dbEnabled()) redirect("/admin");

  const db = getDb();
  const [stores, storeAgg, storeOrders] = await Promise.all([
    db
      .select({ id: teams.id, name: teams.name, storeActive: teams.storeActive, storeToken: teams.storeToken })
      .from(teams)
      .orderBy(desc(teams.createdAt)),
    db
      .select({
        teamId: orders.teamId,
        n: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      })
      .from(orders)
      .where(isNotNull(orders.teamId))
      .groupBy(orders.teamId),
    db
      .select({
        id: orders.id,
        reference: orders.reference,
        customerName: orders.customerName,
        totalCents: orders.totalCents,
        shippedAt: orders.shippedAt,
        createdAt: orders.createdAt,
        teamId: orders.teamId,
      })
      .from(orders)
      .where(isNotNull(orders.teamId))
      .orderBy(desc(orders.createdAt))
      .limit(300),
  ]);
  const aggMap = new Map(storeAgg.map((a) => [a.teamId, a]));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Back to dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">🏪 Team Stores ({stores.length})</h1>
      <p className="mt-2 text-muted">
        Every team storefront: share links, sales totals, and per-store orders. Open a standalone store
        below for repeat customers who just need a link.
      </p>

      <details className="mt-6 group">
        <summary className="cursor-pointer text-sm display text-brand hover:underline list-none">
          ➕ Open a standalone store (no design needed)
        </summary>
        <AdminNewStore presets={STORE_ITEM_PRESETS.map((p) => ({ key: p.key, label: p.label, priceCents: p.priceCents }))} />
      </details>

      <div className="mt-6 border border-line divide-y divide-[color:var(--line)]">
        {stores.length === 0 && <p className="px-3 py-4 text-sm text-muted">No stores yet.</p>}
        {stores.map((s) => {
          const myOrders = storeOrders.filter((o) => o.teamId === s.id);
          return (
            <details key={s.id} className="group">
              <summary className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm cursor-pointer list-none">
                <div className="flex items-center gap-2">
                  <span className="text-muted text-xs transition-transform group-open:rotate-90">▶</span>
                  <Link href={`/store/${s.storeToken}`} className="text-brand hover:underline">{s.name}</Link>
                  <span className={`text-xs display ${s.storeActive ? "text-green-400" : "text-muted"}`}>
                    {s.storeActive ? "OPEN" : "CLOSED"}
                  </span>
                </div>
                <p className="text-muted shrink-0">
                  {aggMap.get(s.id)?.n ?? 0} orders · {money(Number(aggMap.get(s.id)?.sum ?? 0))}
                </p>
              </summary>
              <div className="bg-ink/40 border-t border-line/50 px-3 py-2 space-y-2">
                <div className="flex flex-wrap gap-3 text-xs">
                  <Link href={`/store/${s.storeToken}/verify`} className="text-brand hover:underline">🔍 Print-file QA</Link>
                  <Link href={`/store/${s.storeToken}`} className="text-muted hover:text-foreground hover:underline">View store</Link>
                </div>
                {myOrders.length === 0 ? (
                  <p className="text-xs text-muted">No orders yet. Share the store link so families can order.</p>
                ) : (
                  <ul className="space-y-1">
                    {myOrders.map((o) => (
                      <li key={o.reference} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span>
                          <Link href={`/admin/order/${o.id}`} className="font-mono text-foreground hover:text-brand">{o.reference}</Link>
                          <span className="ml-2 text-muted">{o.customerName ?? "-"}</span>
                        </span>
                        <span className="text-foreground whitespace-nowrap">
                          {money(o.totalCents)} <span className="text-muted">{fmtDate(o.createdAt)}</span>
                          {o.shippedAt ? <span className="ml-1 text-green-400">🚚</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
