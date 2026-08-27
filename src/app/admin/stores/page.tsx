import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { redirect } from "next/navigation";
import { desc, isNotNull, sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { orders, teams } from "@/db/schema";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminNewStore } from "@/components/admin-new-store";
import { AdminStoreDesigns } from "@/components/admin-store-designs";
import { STORE_ITEM_PRESETS } from "@/lib/team-stores";

export const metadata: Metadata = { title: "Team Stores", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

// Every team storefront on its own page: status, all-time sales, per-store
// order history, and the standalone-store creator.
export default async function AdminStoresPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/stores")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const db = getDb();
  const [stores, storeAgg, storeOrders] = await Promise.all([
    db
      .select({ id: teams.id, name: teams.name, storeActive: teams.storeActive, storeToken: teams.storeToken, storeItems: teams.storeItems })
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
      <AdminPageHeader eyebrow="Operations" title={`Team Stores (${stores.length})`} />
      <p className="mt-2 text-muted">
        Every team storefront: share links, sales totals, and per-store orders. Open a standalone store
        below for repeat customers who just need a link.
      </p>

      <details className="mt-6 group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 clip-slant bg-brand text-on-brand display text-sm px-4 py-2 hover:bg-brand-dark">
          Open a standalone store (no design needed)
          <span className="opacity-70 transition-transform group-open:rotate-90">›</span>
        </summary>
        <AdminNewStore presets={STORE_ITEM_PRESETS.map((p) => ({ key: p.key, label: p.label, priceCents: p.priceCents }))} />
      </details>

      <div className="mt-6 border border-line">
        {/* Column headers, so the list reads as a real table. */}
        <div className="hidden sm:grid grid-cols-[2fr_5.5rem_5rem_7rem_auto] items-center gap-3 bg-steel px-3 py-2 text-xs text-muted uppercase tracking-wide">
          <span>Store</span>
          <span>Status</span>
          <span>Orders</span>
          <span>Sales</span>
          <span className="text-right">Link</span>
        </div>
        <div className="divide-y divide-[color:var(--line)]">
        {stores.length === 0 && <p className="px-3 py-4 text-sm text-muted">No stores yet.</p>}
        {stores.map((s) => {
          const myOrders = storeOrders.filter((o) => o.teamId === s.id);
          const n = aggMap.get(s.id)?.n ?? 0;
          const sales = Number(aggMap.get(s.id)?.sum ?? 0);
          return (
            <details key={s.id} className="group">
              <summary className="grid grid-cols-[2fr_5.5rem_5rem_7rem_auto] items-center gap-3 px-3 py-2.5 text-sm cursor-pointer list-none hover:bg-steel/40">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-muted text-xs transition-transform group-open:rotate-90 shrink-0">›</span>
                  <Link href={`/store/${s.storeToken}`} className="text-brand hover:underline truncate">{s.name}</Link>
                </span>
                <span className={`inline-block w-fit border px-2 py-0.5 text-[11px] display uppercase tracking-wide rounded ${s.storeActive ? "border-green-500/50 text-green-400 bg-green-500/10" : "border-line text-muted/70"}`}>
                  {s.storeActive ? "Open" : "Closed"}
                </span>
                <span className={n > 0 ? "text-foreground tabular-nums" : "text-muted/40 tabular-nums"}>{n}</span>
                <span className={sales > 0 ? "display text-foreground tabular-nums" : "text-muted/40 tabular-nums"}>{money(sales)}</span>
                <span className="text-right text-xs text-muted/70 group-open:text-brand">details</span>
              </summary>
              <div className="bg-ink/40 border-t border-line/50 px-3 py-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(s.storeItems?.length ?? 0) > 0 && (
                    <details className="group/designs w-full">
                      <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-xs display bg-brand text-on-brand px-3 py-1.5 hover:bg-brand-dark">
                        Manage colors &amp; photos
                        <span className="opacity-70 transition-transform group-open/designs:rotate-90"></span>
                      </summary>
                      <div className="mt-3">
                        <AdminStoreDesigns
                          teamId={s.id}
                          items={(s.storeItems ?? []).map((it) => ({ key: it.key, label: it.label, image: it.image ?? null, designs: it.designs ?? [] }))}
                        />
                      </div>
                    </details>
                  )}
                  <Link href={`/store/${s.storeToken}/verify`} className="text-xs display border border-line px-3 py-1.5 text-brand hover:border-brand/50">Print-file QA</Link>
                  <Link href={`/store/${s.storeToken}`} className="text-xs display border border-line px-3 py-1.5 text-muted hover:text-foreground hover:border-brand/50">View store </Link>
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
                          {o.shippedAt ? <span className="ml-1 text-green-400 text-[10px] uppercase tracking-wide">shipped</span> : null}
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
    </div>
  );
}
