import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders, teams, orders, assistantFacts, designLabVisitors } from "@/db/schema";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { AdminLogout } from "@/components/admin-logout";
import { AdminPipeline } from "@/components/admin-pipeline";
import { MarkStaffDevice } from "@/components/mark-staff-device";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

// The dashboard is a pure OVERVIEW now: money snapshot, the pipeline, and
// what needs attention. Every list lives on its own sidebar page - Design
// Requests, Team Orders, Awaiting Payment, Payments, Stores, Shop Orders.
export default async function AdminPage() {
  if (!adminEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Set ADMIN_PASSWORD to enable the dashboard.</div>;
  }
  if (!(await isAdmin())) redirect("/admin/login");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const db = getDb();
  const [designs, torders, stores, recentOrders, labVisitors, aiFacts] = await Promise.all([
    db
      .select({
        teamName: designRequests.teamName,
        status: designRequests.status,
        messages: designRequests.messages,
        archivedAt: designRequests.archivedAt,
      })
      .from(designRequests),
    db
      .select({
        id: teamOrders.id,
        status: teamOrders.status,
        quotedTotalCents: teamOrders.quotedTotalCents,
        depositCents: teamOrders.depositCents,
        depositPaidAt: teamOrders.depositPaidAt,
        invoiceUrl: teamOrders.invoiceUrl,
        invoicePaidAt: teamOrders.invoicePaidAt,
        taxExempt: teamOrders.taxExempt,
        archivedAt: teamOrders.archivedAt,
      })
      .from(teamOrders),
    db.select({ id: teams.id, storeActive: teams.storeActive }).from(teams),
    db
      .select({ status: orders.status, totalCents: orders.totalCents, createdAt: orders.createdAt })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(200),
    db.select({ id: designLabVisitors.id, email: designLabVisitors.email, paidAt: designLabVisitors.paidAt }).from(designLabVisitors),
    db.select().from(assistantFacts),
  ]);

  const activeDesigns = designs.filter((d) => !d.archivedAt);
  const activeOrders = torders.filter((o) => !o.archivedAt);

  const DESIGN_DONE = new Set(["approved", "ordered", "cancelled"]);
  const needsAction = activeDesigns.filter((d) => {
    if (DESIGN_DONE.has(d.status)) return false;
    const lastMsg = d.messages?.[d.messages.length - 1];
    return d.status === "changes_requested" || d.status === "submitted" || lastMsg?.from === "client";
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidThisMonth = recentOrders.filter((o) => o.createdAt >= monthStart && (o.status === "paid" || o.status === "fulfilled"));
  const outstanding = activeOrders
    .filter((o) => o.invoiceUrl && !o.invoicePaidAt)
    .map((o) => {
      const total = o.quotedTotalCents ?? 0;
      const deposit = o.depositCents ?? Math.round(total / 2);
      const goodsDue = o.depositPaidAt ? total - deposit : deposit;
      return o.taxExempt ? goodsDue : goodsDue + Math.round(goodsDue * 0.07);
    })
    .filter((due) => due > 0);
  const outstandingTotal = outstanding.reduce((s, d) => s + d, 0);
  const inProduction = activeOrders.filter((o) => o.status === "in_production").length;
  const labLeads = labVisitors.filter((v) => v.email).length;
  const labPaid = labVisitors.filter((v) => v.paidAt).length;

  const cards = [
    { href: "/admin/design-requests", icon: "🎨", title: `Design Requests (${activeDesigns.length})`, sub: needsAction.length ? `${needsAction.length} waiting on us` : "All caught up" },
    { href: "/admin/team-orders", icon: "📦", title: `Team Orders (${activeOrders.length})`, sub: `${inProduction} in production` },
    { href: "/admin/awaiting-payment", icon: "💸", title: `Awaiting Payment (${outstanding.length})`, sub: `${money(outstandingTotal)} due` },
    { href: "/admin/texts", icon: "💬", title: "Conversations", sub: "Texts + WhatsApp on (352) 414-7270" },
    { href: "/admin/customers", icon: "👥", title: "Customers", sub: "Directory with spend + one-tap text" },
    { href: "/admin/design-lab", icon: "🧪", title: "Design Lab Leads", sub: `${labPaid} paid · ${labLeads} leads` },
    { href: "/admin/stores", icon: "🏪", title: `Team Stores (${stores.filter((s) => s.storeActive).length} open)`, sub: "Storefronts + sales" },
    { href: "/admin/payments", icon: "💳", title: "Payments", sub: "Every dollar in, newest first" },
    { href: "/admin/assistant", icon: "🤖", title: "AI Assistant", sub: `${aiFacts.length} fact${aiFacts.length === 1 ? "" : "s"} taught` },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <MarkStaffDevice />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="display text-brand text-sm">Staff Dashboard</span>
          <h1 className="display text-4xl text-foreground mt-1">Overview</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/invoice/new" className="text-xs display text-on-brand bg-brand clip-slant px-3 py-1.5 hover:bg-brand-dark">
            + New invoice
          </Link>
          <AdminLogout />
        </div>
      </div>

      {needsAction.length > 0 && (
        <Link href="/admin/design-requests" className="mt-4 block text-sm text-amber-400 hover:underline">
          ⚠ {needsAction.length} design{needsAction.length === 1 ? "" : "s"} waiting on us:{" "}
          {needsAction.map((d) => d.teamName.trim()).join(", ")}
        </Link>
      )}

      {/* Money snapshot */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Paid this month", value: money(paidThisMonth.reduce((s, o) => s + o.totalCents, 0)), sub: `${paidThisMonth.length} order${paidThisMonth.length === 1 ? "" : "s"}`, href: "/admin/payments" },
          { label: "Outstanding invoices", value: money(outstandingTotal), sub: `${outstanding.length} awaiting payment`, warn: outstanding.length > 0, href: "/admin/awaiting-payment" },
          { label: "In production", value: String(inProduction), sub: "team orders", href: "/admin/team-orders?status=in_production" },
          { label: "Team stores", value: String(stores.filter((s) => s.storeActive).length), sub: "open now", href: "/admin/stores" },
        ].map((t) => (
          <Link key={t.label} href={t.href} className={`border p-3 transition-colors ${t.warn ? "border-amber-500/50 bg-amber-500/5 hover:border-amber-400" : "border-line bg-steel hover:border-brand/50"}`}>
            <p className="text-xs text-muted">{t.label}</p>
            <p className="display text-2xl text-foreground mt-1">{t.value}</p>
            <p className="text-xs text-muted mt-0.5">{t.sub}</p>
          </Link>
        ))}
      </div>

      {/* Pipeline: clicking a stage opens Team Orders pre-filtered to it. */}
      <div className="mt-4">
        <AdminPipeline
          counts={activeOrders.reduce((acc, o) => {
            acc[o.status] = (acc[o.status] ?? 0) + 1;
            return acc;
          }, {} as Record<string, number>)}
          linkTo="/admin/team-orders"
        />
      </div>

      {/* Everything else lives on its own page. */}
      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="border border-line bg-steel px-4 py-3.5 hover:border-brand/60 transition-colors">
            <span className="display text-foreground">{c.icon} {c.title}</span>
            <span className="block text-xs text-muted mt-0.5">{c.sub}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
