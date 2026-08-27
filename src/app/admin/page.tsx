import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders, teams, orders, assistantFacts, designLabVisitors, teamOrderAddons, customInvoices, operationalEvents } from "@/db/schema";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { designNeedsAction } from "@/lib/design-requests";
import { AdminLogout } from "@/components/admin-logout";
import { AdminIcon } from "@/components/admin-icons";
import { MarkStaffDevice } from "@/components/mark-staff-device";
import { resolveOperationalEvent } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

type TodayTask = {
  key: string;
  priority: number;
  sortAt: Date;
  kind: "failure" | "design" | "order";
  title: string;
  detail: string;
  href: string;
  action: string;
  eventId?: string;
};

function ageLabel(at: Date, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function dueLabel(at: Date, now: Date): string {
  const days = Math.ceil((at.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  return `due in ${days}d`;
}

// The dashboard is a pure OVERVIEW now: money snapshot, the pipeline, and
// what needs attention. Every list lives on its own sidebar page - Design
// Requests, Team Orders, Awaiting Payment, Payments, Stores, Shop Orders.
export default async function AdminPage() {
  if (!adminEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Set ADMIN_PASSWORD to enable the dashboard.</div>;
  }
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const db = getDb();
  const eventsPromise = session.role === "designer"
    ? Promise.resolve([])
    : db
        .select({
          id: operationalEvents.id,
          title: operationalEvents.title,
          detail: operationalEvents.detail,
          href: operationalEvents.href,
          occurrences: operationalEvents.occurrences,
          lastSeenAt: operationalEvents.lastSeenAt,
        })
        .from(operationalEvents)
        .where(isNull(operationalEvents.resolvedAt))
        .orderBy(desc(operationalEvents.lastSeenAt))
        .limit(12)
        .catch((error) => {
          // Keeps the dashboard usable during the short deploy window before
          // the accompanying migration reaches the database.
          console.error("Could not load operational alerts:", error);
          return [];
        });

  const [designs, torders, stores, recentOrders, labVisitors, aiFacts, paidAddons, cInvoices, unresolvedEvents] = await Promise.all([
    db
      .select({
        id: designRequests.id,
        reference: designRequests.reference,
        teamName: designRequests.teamName,
        status: designRequests.status,
        neededBy: designRequests.neededBy,
        rush: designRequests.rush,
        createdAt: designRequests.createdAt,
        updatedAt: designRequests.updatedAt,
        // Only the LAST thread message (jsonb `-> -1`), not the whole array -
        // that's all "waiting on us" needs, and threads can be large.
        lastMessage: sql<{ from?: string; at?: string } | null>`${designRequests.messages} -> -1`,
        archivedAt: designRequests.archivedAt,
        followedUpAt: designRequests.followedUpAt,
        approvedDesignUrl: designRequests.approvedDesignUrl,
        approvedDesignUrls: designRequests.approvedDesignUrls,
      })
      .from(designRequests),
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        teamName: teamOrders.teamName,
        contactName: teamOrders.contactName,
        status: teamOrders.status,
        designRequestId: teamOrders.designRequestId,
        approvedDesignUrl: teamOrders.approvedDesignUrl,
        quotedTotalCents: teamOrders.quotedTotalCents,
        depositCents: teamOrders.depositCents,
        depositPaidAt: teamOrders.depositPaidAt,
        invoiceUrl: teamOrders.invoiceUrl,
        invoicePaidAt: teamOrders.invoicePaidAt,
        paymentNote: teamOrders.paymentNote,
        taxExempt: teamOrders.taxExempt,
        archivedAt: teamOrders.archivedAt,
        updatedAt: teamOrders.updatedAt,
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
    db
      .select({ paidAt: teamOrderAddons.paidAt, totalCents: teamOrderAddons.totalCents, paidTotalCents: teamOrderAddons.paidTotalCents })
      .from(teamOrderAddons)
      .where(eq(teamOrderAddons.status, "paid")),
    db.select({ status: customInvoices.status, paidAt: customInvoices.paidAt, totalCents: customInvoices.totalCents }).from(customInvoices),
    eventsPromise,
  ]);

  const activeDesigns = designs.filter((d) => !d.archivedAt);
  const activeOrders = torders.filter((o) => !o.archivedAt);
  const designById = new Map(designs.map((design) => [design.id, design]));

  const needsAction = activeDesigns.filter((d) => designNeedsAction(d));

  const now = new Date();

  const todayTasks: TodayTask[] = [];
  for (const event of unresolvedEvents) {
    todayTasks.push({
      key: `failure:${event.id}`,
      priority: 0,
      sortAt: event.lastSeenAt,
      kind: "failure",
      title: event.title,
      detail: `${event.detail || "A customer-facing operation failed."} · ${ageLabel(event.lastSeenAt, now)}${event.occurrences > 1 ? ` · ${event.occurrences} times` : ""}`,
      href: event.href || "/admin/payments",
      action: "Investigate",
      eventId: event.id,
    });
  }
  for (const design of needsAction) {
    const lastActivity = design.lastMessage?.at ? new Date(design.lastMessage.at) : design.updatedAt || design.createdAt;
    const due = design.neededBy ? ` · ${dueLabel(design.neededBy, now)}` : "";
    todayTasks.push({
      key: `design:${design.id}`,
      priority: design.rush || (design.neededBy && design.neededBy.getTime() - now.getTime() < 14 * 86_400_000) ? 10 : 20,
      sortAt: lastActivity,
      kind: "design",
      title: `${design.teamName.trim()} needs a design response`,
      detail: `${design.reference} · ${design.status.replaceAll("_", " ")} · ${ageLabel(lastActivity, now)}${due}`,
      href: `/admin/design-requests/${design.id}`,
      action: "Respond",
    });
  }
  if (session.role !== "designer") {
    for (const order of activeOrders) {
      if (order.status === "submitted") {
        const linkedDesign = order.designRequestId ? designById.get(order.designRequestId) : null;
        const hasApprovedDesign = Boolean(
          order.approvedDesignUrl ||
            (linkedDesign &&
              (linkedDesign.status === "approved" || linkedDesign.status === "ordered") &&
              (linkedDesign.approvedDesignUrls?.length || linkedDesign.approvedDesignUrl)),
        );
        if (!hasApprovedDesign) {
          todayTasks.push({
            key: `order-design:${order.id}`,
            priority: 5,
            sortAt: order.updatedAt,
            kind: "order",
            title: linkedDesign
              ? `${order.teamName.trim()} is waiting for design approval`
              : `${order.teamName.trim()} is missing a design`,
            detail: `${order.reference} · do not invoice yet · submitted ${ageLabel(order.updatedAt, now)}`,
            href: linkedDesign ? `/admin/design-requests/${linkedDesign.id}` : `/admin/team-order/${order.id}`,
            action: linkedDesign ? "Open design" : "Review order",
          });
        } else {
          todayTasks.push({
            key: `order-invoice:${order.id}`,
            priority: 15,
            sortAt: order.updatedAt,
            kind: "order",
            title: `${order.teamName.trim()} needs an invoice`,
            detail: `${order.reference} · submitted ${ageLabel(order.updatedAt, now)}`,
            href: `/admin/team-order/${order.id}`,
            action: "Create invoice",
          });
        }
      } else if (order.status === "quoted" && order.invoiceUrl && !order.invoicePaidAt && now.getTime() - order.updatedAt.getTime() >= 48 * 3_600_000) {
        todayTasks.push({
          key: `order-payment:${order.id}`,
          priority: 30,
          sortAt: order.updatedAt,
          kind: "order",
          title: `${order.teamName.trim()} payment needs follow-up`,
          detail: `${order.reference} · invoice sent ${ageLabel(order.updatedAt, now)}`,
          href: `/admin/team-order/${order.id}`,
          action: "Follow up",
        });
      }
    }
  }
  todayTasks.sort((a, b) => a.priority - b.priority || a.sortAt.getTime() - b.sortAt.getTime());
  const visibleTodayTasks = todayTasks.slice(0, 10);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // "Paid this month" counts EVERY dollar in: team-order deposits and
  // balances (by their actual paid date), paid add-ons, paid custom invoices,
  // and shop/store purchases - the old version only saw shop orders, so team
  // payments were invisible here.
  let paidThisMonthCents = 0;
  let paidThisMonthCount = 0;
  const countPay = (at: Date | null | undefined, cents: number) => {
    if (at && at >= monthStart && cents > 0) {
      paidThisMonthCents += cents;
      paidThisMonthCount += 1;
    }
  };
  for (const t of torders) {
    const total = t.quotedTotalCents ?? 0;
    const dep = t.depositCents ?? Math.round(total / 2);
    const paidInFull = Boolean(t.invoicePaidAt && t.depositPaidAt && Math.abs(+t.invoicePaidAt - +t.depositPaidAt) < 60000);
    if (t.depositPaidAt && !paidInFull) countPay(t.depositPaidAt, dep);
    if (t.invoicePaidAt) countPay(t.invoicePaidAt, paidInFull ? total : Math.max(0, total - dep));
  }
  for (const a of paidAddons) countPay(a.paidAt, a.paidTotalCents ?? a.totalCents);
  for (const inv of cInvoices) if (inv.status === "paid") countPay(inv.paidAt, inv.totalCents);
  for (const o of recentOrders) if (o.status === "paid" || o.status === "fulfilled") countPay(o.createdAt, o.totalCents);
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

  // 6-month revenue trend for the chart. Same money sources as "paid this
  // month", bucketed by the Eastern calendar month each payment landed in.
  const monthKeys: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "short" }) });
  }
  const revByMonth: Record<string, number> = Object.fromEntries(monthKeys.map((m) => [m.key, 0]));
  const bucket = (at: Date | null | undefined, cents: number) => {
    if (!at || cents <= 0) return;
    const k = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
    if (k in revByMonth) revByMonth[k] += cents;
  };
  for (const t of torders) {
    const total = t.quotedTotalCents ?? 0;
    const dep = t.depositCents ?? Math.round(total / 2);
    const paidInFull = Boolean(t.invoicePaidAt && t.depositPaidAt && Math.abs(+t.invoicePaidAt - +t.depositPaidAt) < 60000);
    if (t.depositPaidAt && !paidInFull) bucket(t.depositPaidAt, dep);
    if (t.invoicePaidAt) bucket(t.invoicePaidAt, paidInFull ? total : Math.max(0, total - dep));
  }
  for (const a of paidAddons) bucket(a.paidAt, a.paidTotalCents ?? a.totalCents);
  for (const inv of cInvoices) if (inv.status === "paid") bucket(inv.paidAt, inv.totalCents);
  for (const o of recentOrders) if (o.status === "paid" || o.status === "fulfilled") bucket(o.createdAt, o.totalCents);
  const revSeries = monthKeys.map((m) => ({ ...m, cents: revByMonth[m.key] }));
  const revMax = Math.max(1, ...revSeries.map((r) => r.cents));

  // Pipeline lanes: how many orders sit at each stage + a couple of real names.
  const PIPELINE_STAGES = [
    { value: "collecting", title: "Collecting Roster", dot: "bg-muted" },
    { value: "submitted", title: "Submitted / Review", dot: "bg-amber-400" },
    { value: "quoted", title: "Awaiting Payment", dot: "bg-amber-300" },
    { value: "in_production", title: "In Production", dot: "bg-brand" },
    { value: "paid", title: "Paid / Awaiting Arrival", dot: "bg-green-400" },
    { value: "shipped", title: "Shipped", dot: "bg-muted" },
  ];
  const stageData = PIPELINE_STAGES.map((s) => {
    const rows = activeOrders.filter((o) => o.status === s.value);
    return {
      ...s,
      count: rows.length,
      names: rows.slice(0, 2).map((o) => (o.teamName?.trim() || o.contactName?.trim() || "Order")),
      extra: Math.max(0, rows.length - 2),
    };
  });
  const pipelineTotal = stageData.reduce((s, x) => s + x.count, 0);

  // Chart geometry (SVG user units); the series drives an area + line.
  const CW = 600, CH = 200, PAD = 18;
  const pts = revSeries.map((r, i) => ({
    x: revSeries.length > 1 ? (i / (revSeries.length - 1)) * CW : CW / 2,
    y: CH - PAD - (r.cents / revMax) * (CH - PAD * 2),
  }));
  const linePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")} L${CW},${CH} L0,${CH} Z`;
  const lastPt = pts[pts.length - 1];
  const hasRevenue = revSeries.some((r) => r.cents > 0);

  const allCards = [
    { href: "/admin/design-requests", icon: "pen", title: `Design Requests (${activeDesigns.length})`, sub: needsAction.length ? `${needsAction.length} waiting on us` : "All caught up" },
    { href: "/admin/team-orders", icon: "box", title: `Team Orders (${activeOrders.length})`, sub: `${inProduction} in production` },
    { href: "/admin/awaiting-payment", icon: "clock", title: `Awaiting Payment (${outstanding.length})`, sub: `${money(outstandingTotal)} due` },
    { href: "/admin/texts", icon: "chat", title: "Conversations", sub: "Texts + WhatsApp on (352) 414-7270" },
    { href: "/admin/calls", icon: "phone", title: "Calls", sub: "Call log + recordings on (352) 414-7270" },
    { href: "/admin/customers", icon: "users", title: "Customers", sub: "Directory with spend + one-tap text" },
    { href: "/admin/design-lab", icon: "flask", title: "Design Lab Leads", sub: `${labPaid} paid · ${labLeads} leads` },
    { href: "/admin/stores", icon: "store", title: `Team Stores (${stores.filter((s) => s.storeActive).length} open)`, sub: "Storefronts + sales" },
    { href: "/admin/payments", icon: "swap", title: "Transactions", sub: "Every dollar in, newest first" },
    { href: "/admin/assistant", icon: "sparkle", title: "AI Assistant", sub: `${aiFacts.length} fact${aiFacts.length === 1 ? "" : "s"} taught` },
  ];
  // Designers see design work only - money tiles and customer/store cards
  // are filtered out of their overview entirely.
  const showMoney = session.role !== "designer";
  const cards = allCards.filter((c) => canAccess(session.role, c.href.split("?")[0]));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <MarkStaffDevice />

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted">Command center</span>
          <h1 className="display text-4xl text-foreground mt-1">Overview</h1>
        </div>
        <div className="flex items-center gap-3">
          {showMoney && (
            <Link href="/admin/invoice/new" className="inline-flex items-center gap-1.5 text-xs display text-on-brand bg-brand rounded-full px-4 py-2 hover:bg-brand-dark transition-colors">
              + New invoice
            </Link>
          )}
          <AdminLogout />
        </div>
      </header>

      {/* One prioritized work queue: failures first, then customer/design and
          order actions. This replaces the old design-only attention banner. */}
      <section className="mt-6 rounded-xl border border-line bg-steel overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h2 className="display text-sm text-foreground">Today</h2>
            <p className="text-xs text-muted mt-0.5">What needs attention, in priority order</p>
          </div>
          <span className={`text-[10px] px-2.5 py-1 rounded-full ${todayTasks.length ? "text-amber-300 bg-amber-500/10" : "text-green-300 bg-green-500/10"}`}>
            {todayTasks.length ? `${todayTasks.length} open` : "All caught up"}
          </span>
        </div>
        {visibleTodayTasks.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-foreground">Nothing is waiting on you.</p>
            <p className="text-xs text-muted mt-1">New customer replies, order actions, and checkout failures will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {visibleTodayTasks.map((task) => (
              <div key={task.key} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${task.kind === "failure" ? "bg-red-500/10 text-red-300" : task.kind === "design" ? "bg-amber-500/10 text-amber-300" : "bg-brand/10 text-brand"}`}>
                  <AdminIcon name={task.kind === "failure" ? "warn" : task.kind === "design" ? "pen" : "box"} className="w-4 h-4" />
                </span>
                <Link href={task.href} className="min-w-0 flex-1 group">
                  <p className="text-sm text-foreground group-hover:text-brand transition-colors truncate">{task.title}</p>
                  <p className="text-[11px] text-muted mt-0.5 truncate capitalize">{task.detail}</p>
                </Link>
                <Link href={task.href} className="hidden sm:inline text-xs text-brand hover:text-foreground whitespace-nowrap">{task.action} →</Link>
                {task.eventId && (
                  <form action={resolveOperationalEvent}>
                    <input type="hidden" name="id" value={task.eventId} />
                    <button type="submit" className="text-[11px] text-muted hover:text-foreground whitespace-nowrap">Resolve</button>
                  </form>
                )}
              </div>
            ))}
            {todayTasks.length > visibleTodayTasks.length && (
              <div className="px-5 py-3 text-center text-[11px] text-muted">+{todayTasks.length - visibleTodayTasks.length} more lower-priority items</div>
            )}
          </div>
        )}
      </section>

      {/* Lead: revenue chart + KPI column */}
      {showMoney && (
        <section className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-xl border border-line bg-steel p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="display text-sm text-foreground">Revenue</h2>
                <p className="text-xs text-muted mt-0.5">Every payment in, last 6 months</p>
              </div>
              <div className="text-right">
                <p className="display text-xl text-brand tabular-nums">{money(paidThisMonthCents)}</p>
                <p className="text-[11px] text-muted">this month</p>
              </div>
            </div>
            <div className="relative mt-4 h-[200px] w-full">
              {hasRevenue ? (
                <svg className="w-full h-full" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="revfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b8a36c" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#b8a36c" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1={CH * 0.33} x2={CW} y2={CH * 0.33} stroke="rgba(255,255,255,0.06)" />
                  <line x1="0" y1={CH * 0.66} x2={CW} y2={CH * 0.66} stroke="rgba(255,255,255,0.06)" />
                  <path d={areaPath} fill="url(#revfill)" />
                  <polyline points={linePts} fill="none" stroke="#b8a36c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="#b8a36c" />
                  <circle cx={lastPt.x} cy={lastPt.y} r="8" fill="#b8a36c" opacity="0.2" />
                </svg>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted">No payments recorded yet</div>
              )}
              <div className="absolute -bottom-1 left-0 right-0 flex justify-between px-0.5 text-[10px] text-muted/70">
                {revSeries.map((r) => <span key={r.key}>{r.label}</span>)}
              </div>
            </div>
          </div>

          <div className="grid grid-rows-4 gap-4">
            {[
              { label: "Paid this month", value: money(paidThisMonthCents), sub: `${paidThisMonthCount} payment${paidThisMonthCount === 1 ? "" : "s"}`, href: "/admin/payments" },
              { label: "Outstanding, unpaid", value: money(outstandingTotal), sub: `${outstanding.length} awaiting payment`, warn: outstanding.length > 0, href: "/admin/awaiting-payment" },
              { label: "In production", value: String(inProduction), sub: "team orders", href: "/admin/team-orders?status=in_production" },
              { label: "Team stores live", value: String(stores.filter((s) => s.storeActive).length), sub: "open now", href: "/admin/stores" },
            ].map((t) => (
              <Link key={t.label} href={t.href} className={`rounded-xl border p-4 flex items-center justify-between transition-colors ${t.warn ? "border-amber-500/40 bg-amber-500/[0.05] hover:border-amber-400/60" : "border-line bg-steel hover:border-brand/50"}`}>
                <div>
                  <p className="text-xs text-muted">{t.label}</p>
                  <p className="display text-2xl text-foreground mt-1 tabular-nums">{t.value}</p>
                  <p className="text-[11px] text-muted mt-0.5">{t.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Pipeline board */}
      {showMoney && (
        <section className="mt-6 rounded-xl border border-line bg-steel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div className="flex items-center gap-3">
              <h2 className="display text-sm text-foreground">Active pipeline</h2>
              <span className="text-[10px] text-muted bg-steel-2 px-2 py-0.5 rounded-full">6 stages · {pipelineTotal} orders</span>
            </div>
          </div>
          <div className="p-5 overflow-x-auto">
            <div className="flex items-stretch gap-2.5 min-w-[900px]">
              {stageData.map((s, i) => (
                <div key={s.value} className="contents">
                  <Link href={`/admin/team-orders?status=${s.value}`} className="flex-1 min-w-0 group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex items-center gap-2 text-[11px] display uppercase tracking-wide text-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.title}
                      </span>
                      <span className={`text-[10px] ${s.count > 0 ? "text-brand" : "text-muted"}`}>{s.count}</span>
                    </div>
                    <div className="space-y-2">
                      {s.names.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-line h-[60px] flex items-center justify-center text-[11px] text-muted">Empty</div>
                      ) : (
                        s.names.map((n, k) => (
                          <div key={k} className="rounded-lg border border-line bg-steel-2/60 p-2.5 group-hover:border-brand/40 transition-colors">
                            <p className="text-xs text-foreground truncate">{n}</p>
                          </div>
                        ))
                      )}
                      {s.extra > 0 && <p className="text-[10px] text-muted pl-1">+{s.extra} more</p>}
                    </div>
                  </Link>
                  {i < stageData.length - 1 && <div className="flex items-start pt-6 text-muted/50">›</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Module grid */}
      <section className="mt-8">
        <h2 className="display text-sm text-foreground mb-4">Modules</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="group rounded-xl border border-line bg-steel p-5 hover:border-brand/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <span className="w-9 h-9 rounded-lg bg-steel-2 flex items-center justify-center text-brand">
                  <AdminIcon name={c.icon} className="w-[18px] h-[18px]" />
                </span>
                <AdminIcon name="arrowUpRight" className="w-[15px] h-[15px] text-muted group-hover:text-foreground transition-colors" />
              </div>
              <h3 className="display text-foreground text-sm">{c.title}</h3>
              <p className="text-xs text-muted mt-1">{c.sub}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
