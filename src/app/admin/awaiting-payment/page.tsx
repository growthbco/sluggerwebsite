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
        invoiceRemindersSent: teamOrders.invoiceRemindersSent,
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
      teamOrderId: o.id,
      canMarkUnresponsive: stage === "Deposit" && (o.invoiceRemindersSent ?? 0) >= 2,
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

  // Oldest receivables deserve attention first. The client keeps this order
  // when the list is searched or filtered.
  items.sort((a, b) => +new Date(a.sinceISO) - +new Date(b.sinceISO));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <AdminPageHeader eyebrow="Financials" title="Awaiting payment" />
      <p className="-mt-3 max-w-2xl text-sm leading-6 text-muted">
        Track every sent invoice with money still due. Older balances appear first so the next follow-up is easy to spot.
      </p>

      <div className="mt-7">
        <AdminAwaitingList items={items} generatedAtISO={new Date().toISOString()} />
      </div>
      <p className="mt-5 max-w-3xl text-xs leading-5 text-muted">
        Team-order reminders go out automatically after 3 days, then once more 4 days later. Void a custom invoice only after it has been replaced or combined.
      </p>
    </div>
  );
}
