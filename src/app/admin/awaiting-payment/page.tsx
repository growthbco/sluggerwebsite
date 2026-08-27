import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, teamOrderAddons, customInvoices } from "@/db/schema";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminAwaitingList, type Unpaid } from "@/components/admin-awaiting-list";

export const metadata: Metadata = { title: "Awaiting Payment", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

// One place for every invoice that's out the door but not yet paid: team-order
// deposits/balances, pending add-on invoices, and unpaid custom invoices.
export default async function AdminAwaitingPaymentPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/awaiting-payment")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const db = getDb();
  const [torders, pendingAddons, invoices] = await Promise.all([
    // Only the fields this page reads - not the full order rows (which carry
    // heavy print-file / roster JSON we don't need here).
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        teamName: teamOrders.teamName,
        contactName: teamOrders.contactName,
        contactEmail: teamOrders.contactEmail,
        archivedAt: teamOrders.archivedAt,
        invoicePaidAt: teamOrders.invoicePaidAt,
        invoiceUrl: teamOrders.invoiceUrl,
        balanceInvoiceUrl: teamOrders.balanceInvoiceUrl,
        quotedTotalCents: teamOrders.quotedTotalCents,
        depositCents: teamOrders.depositCents,
        depositPaidAt: teamOrders.depositPaidAt,
        taxExempt: teamOrders.taxExempt,
        localPickup: teamOrders.localPickup,
        updatedAt: teamOrders.updatedAt,
      })
      .from(teamOrders),
    db.select().from(teamOrderAddons).where(eq(teamOrderAddons.status, "pending")),
    db
      .select()
      .from(customInvoices)
      .where(and(ne(customInvoices.status, "paid"), ne(customInvoices.status, "void")))
      .orderBy(desc(customInvoices.createdAt)),
  ]);
  const orderById = new Map(torders.map((t) => [t.id, t]));

  const items: Unpaid[] = [];

  // Team-order deposit / balance invoices sent but unpaid.
  for (const o of torders) {
    if (o.archivedAt || o.invoicePaidAt || !o.invoiceUrl) continue;
    const total = o.quotedTotalCents ?? 0;
    const deposit = o.depositCents ?? Math.round(total / 2);
    const stage: "Deposit" | "Final balance" = o.depositPaidAt ? "Final balance" : "Deposit";
    const goodsDue = stage === "Deposit" ? deposit : total - deposit;
    if (goodsDue <= 0) continue;
    const due = o.taxExempt ? goodsDue : goodsDue + Math.round(goodsDue * 0.07);
    const payUrl = (stage === "Final balance" ? o.balanceInvoiceUrl : o.invoiceUrl) ?? null;
    items.push({
      key: `to-${o.id}`,
      kind: stage,
      customer: o.teamName.trim() || o.contactName,
      email: o.contactEmail ?? null,
      ref: o.reference,
      amountCents: due,
      sinceISO: o.updatedAt.toISOString(),
      payUrl,
      href: `/admin/team-order/${o.id}`,
      // Final balance not sent yet -> offer to send/email it right here.
      sendInvoice: stage === "Final balance" && !payUrl
        ? { orderId: o.id, stage: "balance", ship: o.localPickup ? "pickup" : "auto" }
        : undefined,
    });
  }

  // Pending add-on invoices - resolve each live Stripe payment link.
  for (const a of pendingAddons) {
    const t = orderById.get(a.teamOrderId);
    const goods = a.rows.reduce((s, r) => s + r.unitPriceCents * r.quantity, 0);
    if (goods <= 0) continue;
    let payUrl: string | null = null;
    if (a.stripeCheckoutSessionId?.startsWith("plink_")) {
      try {
        const { getStripe } = await import("@/lib/stripe");
        const pl = await getStripe().paymentLinks.retrieve(a.stripeCheckoutSessionId);
        if (pl.active) payUrl = pl.url;
      } catch {}
    }
    items.push({
      key: `addon-${a.id}`,
      kind: "Add-on",
      customer: t?.teamName.trim() || t?.contactName || "Add-on",
      email: t?.contactEmail ?? null,
      ref: t?.reference ?? "-",
      amountCents: goods + Math.round(goods * 0.07),
      sinceISO: a.createdAt.toISOString(),
      detail: a.rows.map((r) => `${r.quantity}× ${r.label}${r.design ? ` (${r.design})` : ""}`).join(", "),
      payUrl,
      href: t ? `/admin/team-order/${t.id}` : null,
    });
  }

  // Custom invoices sent but unpaid (voided ones already filtered out above).
  for (const inv of invoices) {
    items.push({
      key: `inv-${inv.id}`,
      kind: "Custom invoice",
      customer: inv.customerName,
      email: inv.customerEmail ?? null,
      ref: inv.reference,
      amountCents: inv.totalCents,
      sinceISO: inv.createdAt.toISOString(),
      detail: (inv.lines ?? []).map((l) => `${l.quantity}× ${l.name}`).join(", ") || undefined,
      payUrl: inv.payUrl ?? null,
      href: inv.payUrl ?? null,
      invoiceId: inv.id,
    });
  }

  items.sort((a, b) => +new Date(b.sinceISO) - +new Date(a.sinceISO));
  const total = items.reduce((s, i) => s + i.amountCents, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <AdminPageHeader eyebrow="Financials" title={`Awaiting Payment (${items.length})`}>
        <p className="display text-2xl text-amber-300 tabular-nums">{money(total)} <span className="text-sm text-muted">due</span></p>
      </AdminPageHeader>
      <p className="mt-2 text-muted text-sm">Every invoice that&apos;s out the door with money still due - team-order deposits &amp; balances, add-on invoices, and custom invoices. Click a row to open it.</p>

      <div className="mt-6">
        <AdminAwaitingList items={items} />
      </div>
      <p className="mt-4 text-xs text-muted">Team-order reminder emails/texts go out automatically after 3 days, then 4 more (max 2 per invoice). Void a custom invoice to remove it (e.g. after combining it into another).</p>
    </div>
  );
}
