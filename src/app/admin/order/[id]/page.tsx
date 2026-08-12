import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { orders, orderItems, teams } from "@/db/schema";
import { getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminArchiveButton } from "@/components/admin-archive-button";
import { AdminShipButton } from "@/components/admin-ship-button";
import { AdminLabelButton } from "@/components/admin-label-button";
import { TrackingInfo } from "@/components/tracking-info";

export const metadata: Metadata = { title: "Order Detail", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "-";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-steel border border-line p-5">
      <h2 className="display text-lg text-foreground">{title}</h2>
      {hint && <p className="text-sm text-muted mt-0.5">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs display text-muted uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground mt-0.5">{children}</dd>
    </div>
  );
}

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!dbEnabled()) notFound();
  const { id } = await params;
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, `/admin/order/${id}`)) redirect("/admin");

  const db = getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!o) notFound();

  const [items, team] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, o.id)),
    o.teamId ? db.select({ name: teams.name, token: teams.storeToken }).from(teams).where(eq(teams.id, o.teamId)).limit(1).then((r) => r[0] ?? null) : null,
  ]);

  const paid = o.status === "paid" || o.status === "fulfilled" || Boolean(o.shippedAt);
  const typeLabel = o.type === "team_store" ? "Team Store" : o.type === "buy_in" ? "Buy-In" : "Shop";

  const nextStep = o.archivedAt
    ? { text: "Archived", tone: "text-muted" }
    : o.shippedAt
      ? { text: "Shipped - nothing left to do 🎉", tone: "text-green-400" }
      : paid
        ? o.trackingNumber
          ? { text: "Label ready - mark it shipped to email the customer tracking", tone: "text-amber-300" }
          : { text: "Paid - buy the shipping label", tone: "text-green-400" }
        : { text: `Status: ${o.status}`, tone: "text-muted" };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-6">
      <header>
        <Link href="/admin" className="text-sm text-brand hover:underline">← Back to dashboard</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="display text-3xl text-foreground">{typeLabel} order {o.reference}</h1>
            <p className="text-sm text-muted mt-1">
              {team?.name ? `${team.name} · ` : ""}placed {fmtDate(o.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs display border px-2.5 py-1 rounded whitespace-nowrap ${paid ? "text-green-400 border-green-400/40" : "text-muted border-line"}`}>
              {o.status.toUpperCase()}
            </span>
            <AdminArchiveButton kind="order" id={o.id} archived={Boolean(o.archivedAt)} />
          </div>
        </div>
        <div className="mt-4 border border-brand/40 bg-brand/5 px-4 py-3">
          <span className="text-xs display text-brand uppercase tracking-wide">Next step</span>
          <p className={`display mt-0.5 ${nextStep.tone}`}>{nextStep.text}</p>
        </div>
      </header>

      <Section title="Customer">
        <dl className="grid sm:grid-cols-3 gap-4">
          <Field label="Name">{o.customerName ?? "-"}</Field>
          <Field label="Email">{o.customerEmail ? <a href={`mailto:${o.customerEmail}`} className="text-brand hover:underline break-all">{o.customerEmail}</a> : "-"}</Field>
          <Field label="Source">{o.source ?? "unknown (pre-tracking)"}</Field>
        </dl>
        {o.customerNote && <p className="mt-3 text-sm text-muted border-l-2 border-brand/60 pl-3">📝 {o.customerNote}</p>}
        {team?.token && (
          <p className="mt-3 text-sm"><a href={`/store/${team.token}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Open team store ↗</a></p>
        )}
      </Section>

      <Section title={`Items (${items.length})`}>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-line/50">
                <td className="py-1.5 pr-2 text-foreground">{it.name}</td>
                <td className="py-1.5 px-2 text-right text-muted whitespace-nowrap">{it.quantity} × {money(it.unitPriceCents)}</td>
                <td className="py-1.5 pl-2 text-right text-foreground whitespace-nowrap">{money(it.quantity * it.unitPriceCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-muted"><td className="pt-2" colSpan={2}>Subtotal</td><td className="pt-2 text-right">{money(o.subtotalCents)}</td></tr>
            <tr className="text-muted"><td colSpan={2}>Shipping</td><td className="text-right">{o.shippingCents ? money(o.shippingCents) : "Free / pickup"}</td></tr>
            {o.fundraiseCents > 0 && (
              <tr className="text-muted"><td colSpan={2}>Team fundraising portion</td><td className="text-right text-brand">{money(o.fundraiseCents)}</td></tr>
            )}
            <tr className="display text-foreground"><td className="pt-1" colSpan={2}>Total paid</td><td className="pt-1 text-right">{money(o.totalCents)}</td></tr>
          </tfoot>
        </table>
        </div>
        {(o.addSessionIds?.length ?? 0) > 0 && (
          <p className="mt-3 text-xs text-muted">Includes {o.addSessionIds!.length} self-serve add-on payment{o.addSessionIds!.length === 1 ? "" : "s"} merged into this order.</p>
        )}
        <p className="mt-3 text-sm">
          <a href={`/api/admin/order-view?id=${o.id}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">View printable order ↗</a>
        </p>
      </Section>

      <Section title="Shipping">
        <dl className="grid sm:grid-cols-3 gap-4">
          <Field label="Deliver to">
            {o.shippingAddress?.line1 ? (
              <>
                {o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ""}<br />
                {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.postalCode}
              </>
            ) : (
              "Pickup / no address"
            )}
          </Field>
          <Field label="Shipped">{o.shippedAt ? `✓ ${fmtDate(o.shippedAt)}` : "not yet"}</Field>
          <Field label="Tracking">{o.trackingNumber ?? "-"}</Field>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {paid && !o.shippedAt && !o.trackingNumber && <AdminLabelButton kind="order" id={o.id} who={o.customerName ?? o.reference} />}
          {paid && !o.shippedAt && (
            o.trackingNumber
              ? <AdminShipButton kind="order" id={o.id} who={o.customerName ?? o.reference} existingTracking={o.trackingNumber} label="🚚 Mark shipped + email customer" />
              : <AdminShipButton kind="order" id={o.id} who={o.customerName ?? o.reference} label="Add tracking manually" />
          )}
          {o.trackingNumber && <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />}
        </div>
      </Section>
    </div>
  );
}
