import Link from "next/link";
import { desc, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests, teamOrders } from "@/db/schema";
import { designNeedsAction } from "@/lib/design-requests";
import { getBillableOrders, getEditableDesignerInvoices } from "@/lib/designer-invoices";
import { AdminIcon } from "@/components/admin-icons";
import { AdminLogout } from "@/components/admin-logout";
import { MarkStaffDevice } from "@/components/mark-staff-device";

const finishedDesignStatuses = new Set(["approved", "ordered", "cancelled"]);
const productionStatuses = new Set(["in_production", "paid"]);

function ageLabel(at: Date): string {
  const hours = Math.max(0, Math.floor((Date.now() - at.getTime()) / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export async function DesignerDashboard({ userName }: { userName: string }) {
  const db = getDb();
  const [designs, orders, billable, editableInvoices] = await Promise.all([
    db
      .select({
        id: designRequests.id,
        reference: designRequests.reference,
        teamName: designRequests.teamName,
        status: designRequests.status,
        neededBy: designRequests.neededBy,
        rush: designRequests.rush,
        followedUpAt: designRequests.followedUpAt,
        archivedAt: designRequests.archivedAt,
        updatedAt: designRequests.updatedAt,
        lastMessage: sql<{ from?: string; at?: string } | null>`${designRequests.messages} -> -1`,
      })
      .from(designRequests)
      .where(isNull(designRequests.archivedAt))
      .orderBy(desc(designRequests.updatedAt)),
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        teamName: teamOrders.teamName,
        status: teamOrders.status,
        designRequestId: teamOrders.designRequestId,
        printFileUrl: teamOrders.printFileUrl,
        printFileVerifiedAt: teamOrders.printFileVerifiedAt,
        inboundTrackingNumber: teamOrders.inboundTrackingNumber,
        updatedAt: teamOrders.updatedAt,
      })
      .from(teamOrders)
      .where(isNull(teamOrders.archivedAt))
      .orderBy(desc(teamOrders.updatedAt)),
    getBillableOrders(),
    getEditableDesignerInvoices(),
  ]);

  const actionDesigns = designs.filter((design) => designNeedsAction(design));
  const activeDesigns = designs.filter((design) => !finishedDesignStatuses.has(design.status));
  const productionOrders = orders.filter((order) => productionStatuses.has(order.status));
  const printQa = productionOrders.filter((order) => Boolean(order.printFileUrl) && !order.printFileVerifiedAt);
  const missingTracking = productionOrders.filter((order) => !order.inboundTrackingNumber);
  const unbilled = billable.filter((order) => !order.alreadyBilledOn).length;

  const queue = [
    ...actionDesigns.slice(0, 6).map((design) => ({
      key: `design-${design.id}`,
      title: `${design.teamName} needs a response`,
      detail: `${design.reference} · ${design.status.replaceAll("_", " ")} · ${ageLabel(design.updatedAt)}`,
      href: `/admin/design-requests/${design.id}`,
      label: "Open design",
      tone: "text-amber-300 bg-amber-500/10",
      icon: "pen",
    })),
    ...printQa.slice(0, 3).map((order) => ({
      key: `qa-${order.id}`,
      title: `${order.teamName} needs print-file QA`,
      detail: `${order.reference} · production is waiting`,
      href: order.designRequestId ? `/admin/design-requests/${order.designRequestId}` : "/admin/team-orders?status=in_production",
      label: "Review file",
      tone: "text-sky-300 bg-sky-500/10",
      icon: "check",
    })),
    ...missingTracking.slice(0, 3).map((order) => ({
      key: `tracking-${order.id}`,
      title: `${order.teamName} needs inbound tracking`,
      detail: `${order.reference} · ${order.status.replaceAll("_", " ")}`,
      href: "/admin/designer-tracking",
      label: "Add tracking",
      tone: "text-violet-300 bg-violet-500/10",
      icon: "truck",
    })),
  ].slice(0, 10);

  const modules = [
    { href: "/admin/design-requests", icon: "pen", title: "Design Requests", sub: `${activeDesigns.length} active · proofs, messages, approvals` },
    { href: "/admin/team-orders", icon: "box", title: "Production Orders", sub: `${productionOrders.length} being produced or ready` },
    { href: "/admin/designer-tracking", icon: "truck", title: "Production Tracking", sub: `${missingTracking.length} waiting for factory tracking` },
    { href: "/admin/designer-invoices", icon: "receipt", title: "My Invoices", sub: `${unbilled} unbilled · ${editableInvoices.length} submitted` },
    { href: "/admin/texts", icon: "chat", title: "Conversations", sub: "Customer and team messages" },
    { href: "/admin/design-lab", icon: "flask", title: "Design Lab", sub: "Saved concepts and incoming leads" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <MarkStaffDevice />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted">Designer portal</span>
          <h1 className="display text-4xl text-foreground mt-1">Welcome, {userName}</h1>
          <p className="mt-2 text-sm text-muted">Design, production, tracking, and invoices in one place.</p>
        </div>
        <AdminLogout />
      </header>

      <section className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Needs response", value: actionDesigns.length, href: "/admin/design-requests", tone: "text-amber-300" },
          { label: "Print QA", value: printQa.length, href: "/admin/team-orders?status=in_production", tone: "text-sky-300" },
          { label: "Needs tracking", value: missingTracking.length, href: "/admin/designer-tracking", tone: "text-violet-300" },
          { label: "Unbilled jobs", value: unbilled, href: "/admin/designer-invoices", tone: "text-brand" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="rounded-xl border border-line bg-steel p-4 hover:border-brand/50 transition-colors">
            <p className="text-xs text-muted">{item.label}</p>
            <p className={`display text-3xl tabular-nums mt-1 ${item.tone}`}>{item.value}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-line bg-steel overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h2 className="display text-sm text-foreground">Your next actions</h2>
            <p className="text-xs text-muted mt-0.5">The work most likely to hold up a customer or production</p>
          </div>
          <span className={`text-[10px] px-2.5 py-1 rounded-full ${queue.length ? "text-amber-300 bg-amber-500/10" : "text-green-300 bg-green-500/10"}`}>
            {queue.length ? `${queue.length} open` : "All caught up"}
          </span>
        </div>
        {queue.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted">Nothing is waiting on you right now.</div>
        ) : (
          <div className="divide-y divide-line">
            {queue.map((item) => (
              <div key={item.key} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                  <AdminIcon name={item.icon} className="w-4 h-4" />
                </span>
                <Link href={item.href} className="min-w-0 flex-1 group">
                  <p className="text-sm text-foreground group-hover:text-brand transition-colors truncate">{item.title}</p>
                  <p className="text-[11px] text-muted mt-0.5 truncate capitalize">{item.detail}</p>
                </Link>
                <Link href={item.href} className="hidden sm:inline text-xs text-brand hover:text-foreground whitespace-nowrap">{item.label} →</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="display text-sm text-foreground mb-4">Everything you need</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((item) => (
            <Link key={item.href} href={item.href} className="group rounded-xl border border-line bg-steel p-5 hover:border-brand/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <span className="w-9 h-9 rounded-lg bg-steel-2 flex items-center justify-center text-brand">
                  <AdminIcon name={item.icon} className="w-[18px] h-[18px]" />
                </span>
                <AdminIcon name="arrowUpRight" className="w-[15px] h-[15px] text-muted group-hover:text-foreground transition-colors" />
              </div>
              <h3 className="display text-foreground text-sm">{item.title}</h3>
              <p className="text-xs text-muted mt-1">{item.sub}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
