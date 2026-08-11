import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { dbEnabled, getDb } from "@/db";
import { customers, teamOrders, designRequests, teamOrderAddons } from "@/db/schema";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminCustomersList, type CustomerRow } from "@/components/admin-customers-list";

export const metadata: Metadata = { title: "Customers", robots: { index: false } };
export const dynamic = "force-dynamic";

// The mini-CRM directory: one row per customer, merged by email across every
// place we know them from (orders, design requests, portal profiles), with
// approximate lifetime spend and a one-tap jump into texting them.
export default async function AdminCustomersPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/customers")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const db = getDb();
  const [orders, designs, custs, addons] = await Promise.all([
    db.select().from(teamOrders),
    db.select().from(designRequests),
    db.select().from(customers),
    db.select().from(teamOrderAddons),
  ]);
  const paidAddonsByOrder = new Map<string, number>();
  for (const a of addons) {
    if (a.status === "paid") paidAddonsByOrder.set(a.teamOrderId, (paidAddonsByOrder.get(a.teamOrderId) ?? 0) + a.totalCents);
  }

  type Agg = CustomerRow & { _last: number };
  const byEmail = new Map<string, Agg>();
  const get = (emailRaw: string | null, name: string, phone: string | null): Agg | null => {
    const email = (emailRaw ?? "").trim().toLowerCase();
    if (!email) return null;
    let a = byEmail.get(email);
    if (!a) {
      a = { email, name, phone: null, orders: 0, designs: 0, spendCents: 0, lastActivity: "", latestOrderId: null, _last: 0 };
      byEmail.set(email, a);
    }
    if (name && (!a.name || a.name.length < name.length)) a.name = name;
    if (phone && !a.phone) a.phone = phone;
    return a;
  };

  for (const o of orders) {
    const a = get(o.contactEmail, o.contactName, o.contactPhone);
    if (!a) continue;
    a.orders += 1;
    if (o.invoicePaidAt) a.spendCents += o.quotedTotalCents ?? 0;
    else if (o.depositPaidAt) a.spendCents += o.depositCents ?? Math.round((o.quotedTotalCents ?? 0) / 2);
    a.spendCents += paidAddonsByOrder.get(o.id) ?? 0;
    const t = (o.updatedAt ?? o.createdAt).getTime();
    if (t > a._last) { a._last = t; a.latestOrderId = o.id; }
  }
  for (const d of designs) {
    const a = get(d.contactEmail, d.contactName, d.contactPhone);
    if (!a) continue;
    a.designs += 1;
    if (d.designFeePaidAt) a.spendCents += d.designFeeAmountCents;
    const t = (d.updatedAt ?? d.createdAt).getTime();
    if (t > a._last) a._last = t;
  }
  for (const c of custs) {
    const a = get(c.email, c.name ?? "", c.phone);
    if (a && c.updatedAt && c.updatedAt.getTime() > a._last) a._last = c.updatedAt.getTime();
  }

  const rows: CustomerRow[] = [...byEmail.values()]
    .sort((a, b) => b._last - a._last)
    .slice(0, 500)
    .map(({ _last, ...r }) => ({ ...r, lastActivity: new Date(_last).toISOString() }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Back to dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">👥 Customers</h1>
      <p className="mt-2 text-muted">
        Everyone who has ordered, started a design, or made a portal account - one row per person, with
        their orders, approximate lifetime spend, and a one-tap text.
      </p>
      <div className="mt-8">
        <AdminCustomersList rows={rows} />
      </div>
    </div>
  );
}
