import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders, orders } from "@/db/schema";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { AdminLogout } from "@/components/admin-logout";

export const metadata: Metadata = { title: "Customers", robots: { index: false } };
export const dynamic = "force-dynamic";

type Customer = {
  email: string;
  name: string;
  phone?: string;
  teams: Set<string>;
  shopOrders: number;
  teamOrders: number;
  designs: number;
  spendCents: number;
  lastActivity: Date;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default async function AdminCustomersPage() {
  if (!adminEnabled()) redirect("/admin");
  if (!(await isAdmin())) redirect("/admin/login");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const db = getDb();
  const [shopRows, orderRows, designRows] = await Promise.all([
    db
      .select({
        email: orders.customerEmail,
        name: orders.customerName,
        totalCents: orders.totalCents,
        at: orders.createdAt,
      })
      .from(orders),
    db
      .select({
        email: teamOrders.contactEmail,
        name: teamOrders.contactName,
        phone: teamOrders.contactPhone,
        team: teamOrders.teamName,
        status: teamOrders.status,
        quotedTotalCents: teamOrders.quotedTotalCents,
        invoicePaidAt: teamOrders.invoicePaidAt,
        at: teamOrders.updatedAt,
      })
      .from(teamOrders),
    db
      .select({
        email: designRequests.contactEmail,
        name: designRequests.contactName,
        phone: designRequests.contactPhone,
        team: designRequests.teamName,
        at: designRequests.updatedAt,
      })
      .from(designRequests),
  ]);

  const customers = new Map<string, Customer>();
  const get = (email: string | null | undefined, name?: string | null): Customer | null => {
    const key = (email ?? "").trim().toLowerCase();
    if (!key) return null;
    let c = customers.get(key);
    if (!c) {
      c = { email: key, name: "", teams: new Set(), shopOrders: 0, teamOrders: 0, designs: 0, spendCents: 0, lastActivity: new Date(0) };
      customers.set(key, c);
    }
    if (name?.trim()) c.name = name.trim();
    return c;
  };
  const touch = (c: Customer, at: Date | null) => {
    if (at && at > c.lastActivity) c.lastActivity = at;
  };

  for (const r of shopRows) {
    const c = get(r.email, r.name);
    if (!c) continue;
    c.shopOrders += 1;
    c.spendCents += r.totalCents ?? 0;
    touch(c, r.at);
  }
  for (const r of orderRows) {
    const c = get(r.email, r.name);
    if (!c) continue;
    c.teamOrders += 1;
    if (r.team?.trim()) c.teams.add(r.team.trim());
    if (r.phone?.trim()) c.phone = r.phone.trim();
    if ((r.status === "paid" || r.invoicePaidAt) && r.quotedTotalCents) c.spendCents += r.quotedTotalCents;
    touch(c, r.at);
  }
  for (const r of designRows) {
    const c = get(r.email, r.name);
    if (!c) continue;
    c.designs += 1;
    if (r.team?.trim()) c.teams.add(r.team.trim());
    if (r.phone?.trim()) c.phone = r.phone.trim();
    // Design fees are NOT counted as spend: they're credited back to the
    // final order, so counting them would double-track revenue.
    touch(c, r.at);
  }

  const list = Array.from(customers.values()).sort(
    (a, b) => b.spendCents - a.spendCents || b.lastActivity.getTime() - a.lastActivity.getTime(),
  );
  const totalRevenue = list.reduce((s, c) => s + c.spendCents, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="display text-brand text-sm">
            <Link href="/admin" className="hover:underline">Staff Dashboard</Link> · Customers
          </span>
          <h1 className="display text-4xl text-foreground mt-1">Customers ({list.length})</h1>
          <p className="mt-2 text-sm text-muted">
            Everyone who has ordered, started a team order, or requested a design.
            Tracked revenue: <strong className="text-foreground">{money(totalRevenue)}</strong>
            <span className="text-xs"> (paid shop orders and paid team-order invoices; design fees excluded)</span>
          </p>
        </div>
        <AdminLogout />
      </div>

      <div className="mt-8 overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-steel text-left text-xs text-muted uppercase">
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Teams</th>
              <th className="px-3 py-2">Designs</th>
              <th className="px-3 py-2">Team orders</th>
              <th className="px-3 py-2">Shop orders</th>
              <th className="px-3 py-2">Spend</th>
              <th className="px-3 py-2">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--line)]">
            {list.map((c) => (
              <tr key={c.email} className="hover:bg-steel/60">
                <td className="px-3 py-2 text-foreground">{c.name || "-"}</td>
                <td className="px-3 py-2 text-muted">
                  <a href={`mailto:${c.email}`} className="text-brand hover:underline">{c.email}</a>
                  {c.phone && <div className="text-xs">{c.phone}</div>}
                </td>
                <td className="px-3 py-2 text-muted">{Array.from(c.teams).join(", ") || "-"}</td>
                <td className="px-3 py-2 text-muted">{c.designs || "-"}</td>
                <td className="px-3 py-2 text-muted">{c.teamOrders || "-"}</td>
                <td className="px-3 py-2 text-muted">{c.shopOrders || "-"}</td>
                <td className="px-3 py-2 display text-foreground">{c.spendCents ? money(c.spendCents) : "-"}</td>
                <td className="px-3 py-2 text-muted">
                  {c.lastActivity.getTime() ? c.lastActivity.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
