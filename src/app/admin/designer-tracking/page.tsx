import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { adminEnabled, canAccess, getAdminSession } from "@/lib/admin-auth";
import { inboundTrackingUrlFor } from "@/lib/tracking";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminInboundTracking } from "@/components/admin-inbound-tracking";

export const metadata: Metadata = { title: "Production Tracking", robots: { index: false } };
export const dynamic = "force-dynamic";

const activeStatuses = new Set(["in_production", "paid"]);

function dateLabel(date: Date | null): string {
  return date?.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }) ?? "—";
}

export default async function DesignerTrackingPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/designer-tracking")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const rows = await getDb()
    .select({
      id: teamOrders.id,
      reference: teamOrders.reference,
      teamName: teamOrders.teamName,
      status: teamOrders.status,
      designRequestId: teamOrders.designRequestId,
      manageToken: teamOrders.manageToken,
      inboundCarrier: teamOrders.inboundCarrier,
      inboundTrackingNumber: teamOrders.inboundTrackingNumber,
      inboundTrackingAddedAt: teamOrders.inboundTrackingAddedAt,
      updatedAt: teamOrders.updatedAt,
    })
    .from(teamOrders)
    .where(isNull(teamOrders.archivedAt))
    .orderBy(desc(teamOrders.updatedAt));

  const orders = rows
    .filter((row) => activeStatuses.has(row.status) && row.manageToken)
    .sort((a, b) => Number(Boolean(a.inboundTrackingNumber)) - Number(Boolean(b.inboundTrackingNumber)) || b.updatedAt.getTime() - a.updatedAt.getTime());
  const missing = orders.filter((order) => !order.inboundTrackingNumber).length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <AdminPageHeader eyebrow="Designer portal" title="Production Tracking">
        <Link href="/admin" className="text-xs display text-muted border border-line px-3 py-2 hover:border-brand/50 hover:text-foreground">Back to portal</Link>
      </AdminPageHeader>
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Factory → Slugger tracking only. Customers never see these numbers.</span>
        <span className={`rounded-full px-2.5 py-1 text-xs ${missing ? "bg-amber-500/10 text-amber-300" : "bg-green-500/10 text-green-300"}`}>
          {missing ? `${missing} waiting for tracking` : "All active shipments tracked"}
        </span>
      </div>

      <section className="rounded-xl border border-line bg-steel overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,1.3fr)_8rem_minmax(0,1.2fr)_7rem] gap-4 px-4 py-2.5 border-b border-line text-[10px] uppercase tracking-wider text-muted">
          <span>Team / order</span><span>Stage</span><span>Inbound shipment</span><span>Updated</span>
        </div>
        {orders.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted">No orders are currently in production.</div>
        ) : (
          <div className="divide-y divide-line">
            {orders.map((order) => (
              <article key={order.id} className="grid md:grid-cols-[minmax(0,1.3fr)_8rem_minmax(0,1.2fr)_7rem] gap-3 md:gap-4 px-4 py-4 items-center">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{order.teamName}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="font-mono text-muted">{order.reference}</span>
                    {order.designRequestId && <Link href={`/admin/design-requests/${order.designRequestId}`} className="text-brand hover:underline">Open design</Link>}
                  </div>
                </div>
                <div>
                  <span className="inline-flex border border-sky-400/40 px-2 py-0.5 text-xs display text-sky-300">{order.status.replaceAll("_", " ")}</span>
                </div>
                <div className="min-w-0">
                  {order.inboundTrackingNumber && (
                    <a
                      href={inboundTrackingUrlFor(order.inboundTrackingNumber, order.inboundCarrier)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 block truncate text-xs text-violet-300 underline decoration-dotted underline-offset-2"
                    >
                      {order.inboundCarrier ?? "Carrier"} · {order.inboundTrackingNumber}
                    </a>
                  )}
                  <AdminInboundTracking
                    manageToken={order.manageToken!}
                    initialCarrier={order.inboundCarrier}
                    initialNumber={order.inboundTrackingNumber}
                  />
                </div>
                <p className="text-xs text-muted">{dateLabel(order.inboundTrackingAddedAt ?? order.updatedAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
