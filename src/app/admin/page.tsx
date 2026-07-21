import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, sql, eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests, teamOrders, teams, orders, teamOrderAddons } from "@/db/schema";
import { isAdmin, adminEnabled } from "@/lib/admin-auth";
import { getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { itemLabel, isInHouseItem } from "@/lib/order-items";
import { AdminLogout } from "@/components/admin-logout";
import { AdminInvoiceButton } from "@/components/admin-invoice-button";
import { AdminShipButton } from "@/components/admin-ship-button";
import { AdminLabelButton } from "@/components/admin-label-button";
import { TrackingInfo } from "@/components/tracking-info";
import { inboundTrackingUrlFor } from "@/lib/tracking";
import { AdminAddonDetails } from "@/components/admin-addon-details";
import { AdminArchiveButton } from "@/components/admin-archive-button";
import { AdminLocalToggle } from "@/components/admin-local-toggle";
import { AdminTaxToggle } from "@/components/admin-tax-toggle";
import { AdminSearch } from "@/components/admin-search";
import { AdminNewStore } from "@/components/admin-new-store";
import { STORE_ITEM_PRESETS } from "@/lib/team-stores";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  pending_payment: "border-amber-500/50 text-amber-400",
  submitted: "border-brand/50 text-brand",
  in_design: "border-brand/50 text-brand",
  proof_sent: "border-sky-500/50 text-sky-400",
  changes_requested: "border-amber-500/50 text-amber-400",
  approved: "border-green-500/50 text-green-400",
  ordered: "border-green-500/50 text-green-400",
  cancelled: "border-line text-muted",
  // team orders
  draft: "border-line text-muted",
  collecting: "border-brand/50 text-brand",
  quoted: "border-amber-500/50 text-amber-400",
  in_production: "border-sky-500/50 text-sky-400",
  paid: "border-green-500/50 text-green-400",
  shipped: "border-green-500/50 text-green-400",
};

function Badge({ label }: { label: string }) {
  return (
    <span className={`inline-block border px-2 py-0.5 text-xs display ${STATUS_TONE[label] ?? "border-line text-muted"}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default async function AdminPage() {
  if (!adminEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Set ADMIN_PASSWORD to enable the dashboard.</div>;
  }
  if (!(await isAdmin())) redirect("/admin/login");
  if (!dbEnabled()) {
    return <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted">Database not configured.</div>;
  }

  const db = getDb();
  const [designs, torders, stores, recentOrders, paidAddons] = await Promise.all([
    db
      .select({
        id: designRequests.id,
        reference: designRequests.reference,
        teamName: designRequests.teamName,
        status: designRequests.status,
        contactName: designRequests.contactName,
        contactEmail: designRequests.contactEmail,
        revisionsUsed: designRequests.revisionsUsed,
        neededBy: designRequests.neededBy,
        messages: designRequests.messages,
        manageToken: designRequests.manageToken,
        archivedAt: designRequests.archivedAt,
        archivedNote: designRequests.archivedNote,
        updatedAt: designRequests.updatedAt,
      })
      .from(designRequests)
      .orderBy(desc(designRequests.updatedAt)),
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        teamName: teamOrders.teamName,
        status: teamOrders.status,
        contactEmail: teamOrders.contactEmail,
        manageToken: teamOrders.manageToken,
        jerseyStyle: teamOrders.jerseyStyle,
        rushShipping: teamOrders.rushShipping,
        localPricing: teamOrders.localPricing,
        taxExempt: teamOrders.taxExempt,
        designRequestId: teamOrders.designRequestId,
        printFileVerifiedAt: teamOrders.printFileVerifiedAt,
        quotedTotalCents: teamOrders.quotedTotalCents,
        invoiceUrl: teamOrders.invoiceUrl,
        depositCents: teamOrders.depositCents,
        depositPaidAt: teamOrders.depositPaidAt,
        balanceInvoiceUrl: teamOrders.balanceInvoiceUrl,
        invoicePaidAt: teamOrders.invoicePaidAt,
        trackingNumber: teamOrders.trackingNumber,
        labelUrl: teamOrders.labelUrl,
        shippedAt: teamOrders.shippedAt,
        inboundCarrier: teamOrders.inboundCarrier,
        inboundTrackingNumber: teamOrders.inboundTrackingNumber,
        archivedAt: teamOrders.archivedAt,
        archivedNote: teamOrders.archivedNote,
        updatedAt: teamOrders.updatedAt,
      })
      .from(teamOrders)
      .orderBy(desc(teamOrders.updatedAt)),
    db
      .select({
        id: teams.id,
        name: teams.name,
        storeActive: teams.storeActive,
        storeToken: teams.storeToken,
        orderCount: sql<number>`(select count(*) from ${orders} where ${orders.teamId} = ${teams.id})`,
        revenueCents: sql<number>`coalesce((select sum(${orders.totalCents}) from ${orders} where ${orders.teamId} = ${teams.id}), 0)`,
      })
      .from(teams)
      .orderBy(desc(teams.createdAt)),
    db
      .select({
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
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(15),
    db
      .select({
        teamOrderId: teamOrderAddons.teamOrderId,
        rows: teamOrderAddons.rows,
        totalCents: teamOrderAddons.totalCents,
        paidTotalCents: teamOrderAddons.paidTotalCents,
        paidAt: teamOrderAddons.paidAt,
      })
      .from(teamOrderAddons)
      .where(eq(teamOrderAddons.status, "paid"))
      .orderBy(desc(teamOrderAddons.paidAt)),
  ]);

  // Paid add-ons grouped by their parent team order, so each order can show
  // the extra players (name / # / size) that were added after the fact.
  type AddonView = { rows: typeof paidAddons[number]["rows"]; totalCents: number; paidTotalCents: number | null };
  const addonsByOrder = new Map<string, AddonView[]>();
  for (const a of paidAddons) {
    const list = addonsByOrder.get(a.teamOrderId) ?? [];
    list.push({ rows: a.rows, totalCents: a.totalCents, paidTotalCents: a.paidTotalCents });
    addonsByOrder.set(a.teamOrderId, list);
  }

  const activeDesigns = designs.filter((d) => !d.archivedAt);
  const archivedDesigns = designs.filter((d) => d.archivedAt);
  const activeOrders = torders.filter((o) => !o.archivedAt);
  const archivedOrders = torders.filter((o) => o.archivedAt);

  // Price each unpaid team order from its roster so "Send invoice" can show
  // the number upfront, and count in-house pieces (hats we embroider in
  // Ocala) so they stay visible until shipped - the factory shipment won't
  // contain them. Roster fetches are per-order but the list is small.
  const orderEstimates = new Map<string, number>();
  const inHouseWork = new Map<string, string>(); // order id -> "11× Snapback Hat"
  for (const o of activeOrders) {
    try {
      const roster = await getRoster(o.id);
      if (!roster.length) continue;
      if (!(o.status === "paid" || o.invoicePaidAt)) {
        orderEstimates.set(o.id, computeTeamOrderQuote(o, roster).totalCents);
      }
      if (!o.shippedAt) {
        const counts = new Map<string, number>();
        for (const r of roster) {
          const qty = Math.max(1, r.quantity ?? 1);
          for (const [k, v] of Object.entries(r.sizes ?? {})) {
            if (isInHouseItem(k) && (v ?? "").trim()) counts.set(k, (counts.get(k) ?? 0) + qty);
          }
        }
        if (counts.size) {
          inHouseWork.set(
            o.id,
            Array.from(counts.entries()).map(([k, n]) => `${n}× ${itemLabel(k)}`).join(", "),
          );
        }
      }
    } catch {}
  }

  // "Waiting on us" = the design work still needs Slugger. Once a design is
  // approved / ordered / cancelled the work is done, so a trailing client
  // message ("thanks!", "approved") must NOT keep flagging it.
  const DESIGN_DONE = new Set(["approved", "ordered", "cancelled"]);
  const needsAction = activeDesigns.filter((d) => {
    if (DESIGN_DONE.has(d.status)) return false;
    const lastMsg = d.messages?.[d.messages.length - 1];
    return d.status === "changes_requested" || d.status === "submitted" || lastMsg?.from === "client";
  });

  // Money view. Shop/store revenue comes from the orders table (real Stripe
  // amounts incl. tax); team-order revenue rides on quotedTotalCents.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidThisMonth = recentOrders.filter((o) => o.createdAt >= monthStart && (o.status === "paid" || o.status === "fulfilled"));
  // Outstanding invoices: an invoice was sent but the money isn't fully in.
  const outstanding = activeOrders
    .filter((o) => o.invoiceUrl && !o.invoicePaidAt)
    .map((o) => {
      const total = o.quotedTotalCents ?? 0;
      const deposit = o.depositCents ?? Math.round(total / 2);
      const stage = o.depositPaidAt ? "balance" : "deposit";
      const goodsDue = stage === "deposit" ? deposit : total - deposit;
      const due = o.taxExempt ? goodsDue : goodsDue + Math.round(goodsDue * 0.07);
      return { id: o.id, ref: o.reference, team: o.teamName.trim(), stage, due, token: o.manageToken, since: o.updatedAt };
    })
    .filter((o) => o.due > 0);
  const outstandingTotal = outstanding.reduce((s, o) => s + o.due, 0);
  const inProduction = activeOrders.filter((o) => o.status === "in_production").length;
  const daysAgo = (d: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="display text-brand text-sm">Staff Dashboard</span>
          <h1 className="display text-4xl text-foreground mt-1">All Projects</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/customers" className="text-xs display text-foreground border border-line px-3 py-1.5 hover:border-brand/50">
            Customers →
          </Link>
          <AdminLogout />
        </div>
      </div>

      {needsAction.length > 0 && (
        <p className="mt-4 text-sm text-amber-400">
          ⚠ {needsAction.length} design{needsAction.length === 1 ? "" : "s"} waiting on us:{" "}
          {needsAction.map((d) => d.teamName.trim()).join(", ")}
        </p>
      )}

      {/* Money snapshot */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Paid this month", value: money(paidThisMonth.reduce((s, o) => s + o.totalCents, 0)), sub: `${paidThisMonth.length} order${paidThisMonth.length === 1 ? "" : "s"}` },
          { label: "Outstanding invoices", value: money(outstandingTotal), sub: `${outstanding.length} awaiting payment`, warn: outstanding.length > 0 },
          { label: "In production", value: String(inProduction), sub: "team orders" },
          { label: "Team stores", value: String(stores.filter((s) => s.storeActive).length), sub: "open now" },
        ].map((t) => (
          <div key={t.label} className={`border p-3 ${t.warn ? "border-amber-500/50 bg-amber-500/5" : "border-line bg-steel"}`}>
            <p className="text-xs text-muted">{t.label}</p>
            <p className="display text-2xl text-foreground mt-1">{t.value}</p>
            <p className="text-xs text-muted mt-0.5">{t.sub}</p>
          </div>
        ))}
      </div>

      {outstanding.length > 0 && (
        <details className="mt-4 border border-amber-500/40 bg-amber-500/5 group" open>
          <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 list-none">
            <span className="display text-sm text-amber-300">💸 Awaiting payment ({outstanding.length})</span>
            <span className="text-amber-300 transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="divide-y divide-[color:var(--line)] border-t border-amber-500/20">
            {outstanding.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  <Link href={`/team-order/manage/${o.token}`} className="font-mono text-xs text-brand hover:underline">{o.ref}</Link>
                  <span className="ml-2 text-foreground">{o.team}</span>
                  <span className="ml-2 text-xs text-muted">{o.stage} · sent {daysAgo(o.since)}d ago</span>
                </span>
                <span className="display text-foreground">{money(o.due)} due</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <AdminSearch
        statuses={Array.from(new Set([...activeDesigns.map((d) => d.status), ...activeOrders.map((o) => o.status)]))}
      />

      <section className="mt-6">
        <h2 className="display text-xl text-foreground">Design requests ({activeDesigns.length})</h2>
        <div className="mt-3 overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-steel text-left text-xs text-muted uppercase">
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Rev</th>
                <th className="px-3 py-2">Needed by</th>
                <th className="px-3 py-2">Last msg</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {activeDesigns.map((d) => {
                const lastMsg = d.messages?.[d.messages.length - 1];
                return (
                  <tr
                    key={d.reference}
                    className="hover:bg-steel/60"
                    data-section="designs"
                    data-status={d.status}
                    data-search={`${d.teamName} ${d.reference} ${d.contactName} ${d.contactEmail}`.toLowerCase()}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/design/manage/${d.manageToken}`} className="text-brand hover:underline">
                        {d.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">{d.teamName}</td>
                    <td className="px-3 py-2"><Badge label={d.status} /></td>
                    <td className="px-3 py-2 text-muted">{d.contactName}</td>
                    <td className="px-3 py-2 text-muted">{d.revisionsUsed ?? 0}/5</td>
                    <td className="px-3 py-2 text-muted">{fmtDate(d.neededBy)}</td>
                    <td className="px-3 py-2 text-muted">
                      {lastMsg ? (lastMsg.from === "client" ? "⚠ client waiting" : lastMsg.name ?? "staff") : "-"}
                    </td>
                    <td className="px-3 py-2 text-muted">{fmtDate(d.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <AdminArchiveButton kind="design_request" id={d.id} archived={false} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {archivedDesigns.length > 0 && (
        <details className="mt-6 border border-line bg-steel/50 group">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 list-none">
            <span className="display text-sm text-muted">Archived design requests ({archivedDesigns.length})</span>
            <span className="text-brand transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="divide-y divide-[color:var(--line)] border-t border-line">
            {archivedDesigns.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <Link href={`/design/manage/${d.manageToken}`} className="font-mono text-xs text-brand hover:underline">
                    {d.reference}
                  </Link>
                  <span className="ml-2 text-foreground">{d.teamName}</span>
                  <span className="ml-2 text-muted">{d.contactName}</span>
                  {d.archivedNote && <span className="ml-2 text-xs text-amber-400/90">"{d.archivedNote}"</span>}
                  <span className="ml-2 text-xs text-muted">archived {fmtDate(d.archivedAt)}</span>
                </div>
                <AdminArchiveButton kind="design_request" id={d.id} archived={true} />
              </div>
            ))}
          </div>
        </details>
      )}

      <section className="mt-10">
        <h2 className="display text-xl text-foreground">Team orders ({activeOrders.length})</h2>
        <div className="mt-3 overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-steel text-left text-xs text-muted uppercase">
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)]">
              {activeOrders.map((o) => {
                const estimate = o.quotedTotalCents ?? orderEstimates.get(o.id);
                const paid = Boolean(o.invoicePaidAt) || o.status === "paid" || o.status === "shipped";
                const deposit = o.depositCents ?? (estimate ? Math.round(estimate / 2) : 0);
                return (
                  <tr
                    key={o.reference}
                    className="hover:bg-steel/60"
                    data-section="orders"
                    data-status={o.status}
                    data-search={`${o.teamName} ${o.reference} ${o.contactEmail}`.toLowerCase()}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/team-order/manage/${o.manageToken}`} className="text-brand hover:underline">
                        {o.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      <span className="flex flex-wrap items-center gap-2">
                        {o.teamName}
                        {addonsByOrder.has(o.id) && (
                          <AdminAddonDetails addons={addonsByOrder.get(o.id)!} teamName={o.teamName} />
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2"><Badge label={o.status} /></td>
                    <td className="px-3 py-2 text-muted">{o.contactEmail}</td>
                    <td className="px-3 py-2 text-foreground">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="whitespace-nowrap">
                          {estimate ? money(estimate) : "-"}
                          {estimate && !o.quotedTotalCents ? <span className="text-xs text-muted"> est.</span> : null}
                        </span>
                        {!o.invoiceUrl && !paid && (
                          <>
                            <AdminLocalToggle teamOrderId={o.id} local={o.localPricing} />
                            <AdminTaxToggle teamOrderId={o.id} exempt={o.taxExempt} />
                          </>
                        )}
                        {o.localPricing && (o.invoiceUrl || paid) && (
                          <span className="text-xs display text-brand">OCALA</span>
                        )}
                        {o.taxExempt && (o.invoiceUrl || paid) && (
                          <span className="text-xs display text-brand">TAX-EXEMPT</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 min-w-[16rem]">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {/* Pieces we embroider in-house (hats): the factory
                            shipment won't contain these, so keep them in view
                            until the order ships. */}
                        {inHouseWork.has(o.id) && (
                          <span
                            title="Embroidered in-house in Ocala - not part of the factory shipment"
                            className="text-xs display text-amber-300 border border-amber-300/40 px-1.5 py-0.5 whitespace-nowrap"
                          >
                            🧢 IN-HOUSE: {inHouseWork.get(o.id)}
                          </span>
                        )}
                        {/* Inbound leg (factory -> shop): shown until we ship
                            out to the customer. Internal only. */}
                        {o.inboundTrackingNumber && !o.shippedAt && (
                          <a
                            href={inboundTrackingUrlFor(o.inboundTrackingNumber, o.inboundCarrier)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Inbound from production - ${o.inboundCarrier ?? "carrier"} ${o.inboundTrackingNumber}`}
                            className="text-xs display text-violet-400 underline decoration-dotted underline-offset-2 hover:text-violet-300 whitespace-nowrap"
                          >
                            ✈ INBOUND · {o.inboundCarrier ?? "?"}
                          </a>
                        )}
                        {o.shippedAt ? (
                          <>
                            <span className="text-xs display text-green-400 whitespace-nowrap">🚚 SHIPPED</span>
                            {o.trackingNumber && <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />}
                          </>
                        ) : paid ? (
                          o.trackingNumber ? (
                            <>
                              <span className="text-xs display text-amber-400 whitespace-nowrap" title="Label/tracking ready - customer not emailed yet">READY TO SHIP</span>
                              <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />
                              <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber} label="🚚 Mark shipped + email" />
                            </>
                          ) : (
                            <>
                              <span className="text-xs display text-green-400 whitespace-nowrap">PAID</span>
                              <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} />
                              <AdminShipButton kind="team_order" id={o.id} who={o.teamName} label="➕ Add tracking" />
                            </>
                          )
                        ) : o.depositPaidAt && estimate ? (
                          <>
                            <span className="text-xs display text-sky-400 whitespace-nowrap">DEPOSIT ✓</span>
                            <AdminInvoiceButton
                              teamOrderId={o.id}
                              teamName={o.teamName}
                              dueCents={estimate - deposit}
                              stage="balance"
                              resend={Boolean(o.balanceInvoiceUrl)}
                            />
                            {o.trackingNumber ? (
                              <>
                                <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />
                                <AdminShipButton kind="team_order" id={o.id} who={o.teamName} existingTracking={o.trackingNumber} label="🚚 Mark shipped + email" />
                              </>
                            ) : (
                              <>
                                <AdminLabelButton kind="team_order" id={o.id} who={o.teamName} />
                                <AdminShipButton kind="team_order" id={o.id} who={o.teamName} label="➕ Add tracking" />
                              </>
                            )}
                          </>
                        ) : estimate ? (
                          <AdminInvoiceButton
                            teamOrderId={o.id}
                            teamName={o.teamName}
                            dueCents={deposit}
                            stage="deposit"
                            resend={Boolean(o.invoiceUrl)}
                            warnPrintFile={Boolean(o.designRequestId) && !o.printFileVerifiedAt}
                          />
                        ) : (
                          <span className="text-xs text-muted">no roster</span>
                        )}
                        <AdminArchiveButton kind="team_order" id={o.id} archived={false} />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">{fmtDate(o.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {archivedOrders.length > 0 && (
        <details className="mt-6 border border-line bg-steel/50 group">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 list-none">
            <span className="display text-sm text-muted">Archived team orders ({archivedOrders.length})</span>
            <span className="text-brand transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="divide-y divide-[color:var(--line)] border-t border-line">
            {archivedOrders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <Link href={`/team-order/manage/${o.manageToken}`} className="font-mono text-xs text-brand hover:underline">
                    {o.reference}
                  </Link>
                  <span className="ml-2 text-foreground">{o.teamName}</span>
                  <span className="ml-2 text-muted">{o.contactEmail}</span>
                  {o.archivedNote && <span className="ml-2 text-xs text-amber-400/90">"{o.archivedNote}"</span>}
                  <span className="ml-2 text-xs text-muted">archived {fmtDate(o.archivedAt)}</span>
                </div>
                <AdminArchiveButton kind="team_order" id={o.id} archived={true} />
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="display text-xl text-foreground">Team stores ({stores.length})</h2>
          </div>
          <details className="mt-3 group">
            <summary className="cursor-pointer text-xs display text-brand hover:underline list-none">
              ➕ Open a standalone store (no design needed)
            </summary>
            <AdminNewStore
              presets={STORE_ITEM_PRESETS.map((p) => ({ key: p.key, label: p.label, priceCents: p.priceCents }))}
            />
          </details>
          <div className="mt-3 border border-line divide-y divide-[color:var(--line)]">
            {stores.length === 0 && <p className="px-3 py-3 text-sm text-muted">No stores yet.</p>}
            {stores.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <Link href={`/store/${s.storeToken}`} className="text-brand hover:underline">
                    {s.name}
                  </Link>
                  <span className={`ml-2 text-xs display ${s.storeActive ? "text-green-400" : "text-muted"}`}>
                    {s.storeActive ? "OPEN" : "CLOSED"}
                  </span>
                </div>
                <p className="text-muted shrink-0">
                  {s.orderCount} orders · {money(Number(s.revenueCents))}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="display text-xl text-foreground">Recent paid orders</h2>
          <div className="mt-3 border border-line divide-y divide-[color:var(--line)]">
            {recentOrders.length === 0 && <p className="px-3 py-3 text-sm text-muted">No orders yet.</p>}
            {recentOrders.map((o) => (
              <div key={o.reference} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <span className="font-mono text-xs text-foreground">{o.reference}</span>
                  <span className="ml-2 text-muted">{o.customerName ?? "-"}</span>
                  <span className="ml-2 text-xs text-muted">({o.type})</span>
                </div>
                <span className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                  <span className="text-foreground whitespace-nowrap">
                    {money(o.totalCents)} <span className="text-muted text-xs">{fmtDate(o.createdAt)}</span>
                  </span>
                  {o.shippedAt ? (
                    <>
                      <span className="text-xs display text-green-400">🚚</span>
                      {o.trackingNumber && <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />}
                    </>
                  ) : o.status === "paid" ? (
                    o.trackingNumber ? (
                      <>
                        <span className="text-xs display text-amber-400" title="Label/tracking ready - customer not emailed yet">READY</span>
                        <TrackingInfo trackingNumber={o.trackingNumber} labelUrl={o.labelUrl} />
                        <AdminShipButton kind="order" id={o.id} who={o.customerName ?? o.reference} existingTracking={o.trackingNumber} label="🚚 Mark shipped + email" />
                      </>
                    ) : (
                      <>
                        <AdminLabelButton kind="order" id={o.id} who={o.customerName ?? o.reference} />
                        <AdminShipButton kind="order" id={o.id} who={o.customerName ?? o.reference} label="➕ Add tracking" />
                      </>
                    )
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
