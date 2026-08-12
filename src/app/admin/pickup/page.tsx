import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, isNotNull } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, orders } from "@/db/schema";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminPickupButton } from "@/components/admin-pickup-button";

export const metadata: Metadata = { title: "Schedule Pickup", robots: { index: false } };
export const dynamic = "force-dynamic";

type Waiting = {
  key: string;
  kind: "team_order" | "order";
  id: string;
  reference: string;
  who: string;
  carrier: string | null;
  tracking: string | null;
  href: string;
};

const isUspsSchedulable = (carrier: string | null) => !carrier || /usps/i.test(carrier);

// One place to book free USPS pickups: every order with a label bought that
// hasn't gone out yet, so staff can schedule the mail carrier to grab them all
// without opening each order.
export default async function AdminPickupPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/pickup")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const db = getDb();
  const [torders, shopOrders] = await Promise.all([
    db.select().from(teamOrders).where(isNotNull(teamOrders.shipTransactionId)).orderBy(desc(teamOrders.updatedAt)),
    db.select().from(orders).where(isNotNull(orders.shipTransactionId)).orderBy(desc(orders.createdAt)),
  ]);

  const waiting: Waiting[] = [];
  for (const o of torders) {
    // Label bought but not handed off yet (not shipped/cancelled/archived).
    if (o.archivedAt || ["shipped", "cancelled"].includes(o.status)) continue;
    waiting.push({
      key: `to-${o.id}`,
      kind: "team_order",
      id: o.id,
      reference: o.reference,
      who: o.teamName.trim() || o.contactName,
      carrier: o.shipCarrier,
      tracking: o.trackingNumber,
      href: `/admin/team-order/${o.id}`,
    });
  }
  for (const o of shopOrders) {
    if (o.status !== "paid") continue; // fulfilled = already went out
    waiting.push({
      key: `o-${o.id}`,
      kind: "order",
      id: o.id,
      reference: o.reference,
      who: o.customerName ?? "Shop order",
      carrier: o.shipCarrier,
      tracking: o.trackingNumber,
      href: `/admin/order/${o.id}`,
    });
  }

  const usps = waiting.filter((w) => isUspsSchedulable(w.carrier));
  const other = waiting.filter((w) => !isUspsSchedulable(w.carrier));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">📮 Schedule Pickup</h1>
      <p className="mt-2 text-muted text-sm">
        Book a <strong>free USPS pickup</strong> at the shop for any order with a label already bought. USPS collects with your
        regular mail - next business day is the default. (UPS &amp; FedEx charge for pickups, so those aren&apos;t offered here.)
      </p>

      <div className="mt-6">
        <p className="display text-sm text-muted uppercase tracking-wide mb-2">Ready for USPS pickup ({usps.length})</p>
        <div className="border border-line divide-y divide-[color:var(--line)]">
          {usps.length === 0 && <p className="px-4 py-5 text-sm text-muted">Nothing waiting. Buy a USPS label on an order and it shows up here.</p>}
          {usps.map((w) => (
            <div key={w.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <Link href={w.href} className="font-mono text-xs text-brand hover:underline">{w.reference}</Link>
                <span className="ml-2 text-foreground">{w.who}</span>
                <span className="block text-xs text-muted mt-0.5">
                  {w.carrier ? `${w.carrier} · ` : "carrier unconfirmed · "}{w.tracking ? `#${w.tracking}` : "no tracking"}
                </span>
              </span>
              <AdminPickupButton kind={w.kind} id={w.id} />
            </div>
          ))}
        </div>
      </div>

      {other.length > 0 && (
        <div className="mt-8">
          <p className="display text-sm text-muted uppercase tracking-wide mb-2">UPS / FedEx - no free pickup ({other.length})</p>
          <div className="border border-line/60 divide-y divide-[color:var(--line)]">
            {other.map((w) => (
              <div key={w.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <Link href={w.href} className="font-mono text-xs text-brand hover:underline">{w.reference}</Link>
                  <span className="ml-2 text-foreground/80">{w.who}</span>
                </span>
                <span className="text-xs text-muted">{w.carrier} · drop off or schedule in that carrier&apos;s portal</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
