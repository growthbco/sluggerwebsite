import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { redirect } from "next/navigation";
import { desc, isNull, isNotNull } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { orders } from "@/db/schema";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminLabelButton } from "@/components/admin-label-button";
import { AdminShipButton } from "@/components/admin-ship-button";
import { AdminArchiveButton } from "@/components/admin-archive-button";
import { AdminRowMenu } from "@/components/admin-row-menu";
import { TrackingInfo } from "@/components/tracking-info";

export const metadata: Metadata = { title: "Shop Orders", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
const srcShort = (s: string | null | undefined) => (s ? s.split(" → ")[0] : "-");

// Days between two dates, counted in Eastern calendar days (so "today" flips at
// ET midnight, not UTC). Used to flag fresh orders in the list.
const etYmd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
function daysAgo(d: Date, now: Date): number {
  const a = new Date(etYmd(d) + "T00:00:00Z").getTime();
  const b = new Date(etYmd(now) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}
function relLabel(n: number): string {
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 7) return `${n}d ago`;
  if (n < 14) return "1w ago";
  return `${Math.floor(n / 7)}w ago`;
}

// Individual shop + team-store purchases (card checkouts), on their own page.
// Quote-first team orders live on the dashboard pipeline instead.
export default async function AdminShopOrdersPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/shop-orders")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const db = getDb();
  const cols = {
    id: orders.id,
    reference: orders.reference,
    type: orders.type,
    status: orders.status,
    customerName: orders.customerName,
    totalCents: orders.totalCents,
    trackingNumber: orders.trackingNumber,
    labelUrl: orders.labelUrl,
    shippedAt: orders.shippedAt,
    createdAt: orders.createdAt,
    source: orders.source,
    shippingProtectionCents: orders.shippingProtectionCents,
  };
  const [active, archived] = await Promise.all([
    db.select(cols).from(orders).where(isNull(orders.archivedAt)).orderBy(desc(orders.createdAt)).limit(200),
    db.select(cols).from(orders).where(isNotNull(orders.archivedAt)).orderBy(desc(orders.createdAt)).limit(50),
  ]);

  const now = new Date();
  type Row = (typeof active)[number];
  const isStore = (o: Row) => o.type === "team_store" || o.type === "buy_in";
  const shopOrders = active.filter((o) => !isStore(o));
  const storeOrders = active.filter((o) => isStore(o));

  const renderRow = (o: Row) => {
    const n = daysAgo(o.createdAt, now);
    const fresh = n <= 1; // today / yesterday - draws the eye
    return (
      <div key={o.reference} className="flex items-center gap-3 px-3 py-2.5 text-sm">
        {/* Date, front and center - its own fixed column so timing reads at a glance. */}
        <div className={`w-16 shrink-0 text-center leading-tight ${fresh ? "text-brand" : "text-foreground"}`}>
          <div className="display text-sm whitespace-nowrap">{fmtDate(o.createdAt)}</div>
          <div className={`text-[10px] uppercase tracking-wide ${fresh ? "text-brand" : "text-muted"}`}>{relLabel(n)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate">
            <Link href={`/admin/order/${o.id}`} className="font-mono text-xs text-brand hover:underline">{o.reference}</Link>
            <Link href={`/admin/order/${o.id}`} className="ml-2 text-foreground hover:text-brand hover:underline">{o.customerName ?? "-"}</Link>
          </div>
          <div className="text-xs text-muted mt-0.5">
            {o.source ? <span title={o.source}>via {srcShort(o.source)}</span> : "—"}
            {o.shippedAt && <span className="ml-2 text-green-400">Shipped {fmtDate(o.shippedAt)}</span>}
          </div>
        </div>
        <span className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
          <span className="display text-foreground whitespace-nowrap">{money(o.totalCents)}</span>
          {o.shippingProtectionCents > 0 && <span className="text-[10px] display text-green-400 border border-green-400/40 px-1.5 py-0.5">PROTECTED</span>}
          {o.trackingNumber && <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />}
          {!o.shippedAt && o.status === "paid" && !o.trackingNumber && (
            <AdminLabelButton kind="order" id={o.id} who={o.customerName ?? o.reference} autoShipOnBuy={isStore(o)} />
          )}
          <AdminRowMenu>
            <a href={`/api/admin/order-view?id=${o.id}`} target="_blank" rel="noopener noreferrer">View order</a>
            {!o.shippedAt && o.status === "paid" && (
              o.trackingNumber
                ? <AdminShipButton kind="order" id={o.id} who={o.customerName ?? o.reference} existingTracking={o.trackingNumber} label="Mark shipped + email" />
                : <AdminShipButton kind="order" id={o.id} who={o.customerName ?? o.reference} label="Add tracking" />
            )}
            <AdminArchiveButton kind="order" id={o.id} archived={false} />
          </AdminRowMenu>
        </span>
      </div>
    );
  };

  const Group = ({ title, blurb, rows }: { title: string; blurb: string; rows: Row[] }) => (
    <div className="mt-8">
      <div className="flex items-baseline gap-2">
        <h2 className="display text-lg text-foreground">{title}</h2>
        <span className="text-sm text-muted">({rows.length})</span>
      </div>
      <p className="text-xs text-muted mt-0.5">{blurb}</p>
      <div className="mt-3 border border-line divide-y divide-[color:var(--line)]">
        {rows.length === 0 && <p className="px-3 py-4 text-sm text-muted">Nothing here yet.</p>}
        {rows.map(renderRow)}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
      <AdminPageHeader eyebrow="Operations" title="Shop & Store Orders" />
      <p className="mt-2 text-muted">
        Individual card purchases. Newest first, with the order date up front so you can tell what just came in. Quote-first team orders live on the dashboard.
      </p>

      <Group title="Shop orders" blurb="Direct purchases from the public shop." rows={shopOrders} />
      <Group title="Team store orders" blurb="Bought through a team's store or buy-in link." rows={storeOrders} />

      {archived.length > 0 && (
        <details className="mt-6 border border-line bg-steel/50 group">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 list-none">
            <span className="display text-sm text-muted">Archived orders ({archived.length})</span>
            <span className="text-brand transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="divide-y divide-[color:var(--line)] border-t border-line">
            {archived.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <span className="font-mono text-xs text-muted">{o.reference}</span>
                  <span className="ml-2 text-foreground">{o.customerName ?? "-"}</span>
                  <span className="ml-2 text-muted">{money(o.totalCents)}</span>
                </div>
                <AdminArchiveButton kind="order" id={o.id} archived={true} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
