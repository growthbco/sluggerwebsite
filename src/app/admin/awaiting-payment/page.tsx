import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders, teamOrderAddons, customInvoices } from "@/db/schema";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Awaiting Payment", robots: { index: false } };
export const dynamic = "force-dynamic";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

type Unpaid = {
  key: string;
  kind: "Deposit" | "Final balance" | "Add-on" | "Custom invoice";
  customer: string;
  ref: string;
  amountCents: number;
  since: Date;
  detail?: string;
  payUrl: string | null;
  orderId?: string;
};

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
    db.select().from(teamOrders),
    db.select().from(teamOrderAddons).where(eq(teamOrderAddons.status, "pending")),
    db.select().from(customInvoices).where(eq(customInvoices.status, "sent")).orderBy(desc(customInvoices.createdAt)),
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
    items.push({
      key: `to-${o.id}`,
      kind: stage,
      customer: o.teamName.trim() || o.contactName,
      ref: o.reference,
      amountCents: due,
      since: o.updatedAt,
      payUrl: (stage === "Final balance" ? o.balanceInvoiceUrl : o.invoiceUrl) ?? null,
      orderId: o.id,
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
      customer: t?.teamName.trim() ?? "Add-on",
      ref: t?.reference ?? "-",
      amountCents: goods + Math.round(goods * 0.07),
      since: a.createdAt,
      detail: a.rows.map((r) => `${r.quantity}× ${r.label}${r.design ? ` (${r.design})` : ""}`).join(", "),
      payUrl,
      orderId: t?.id,
    });
  }

  // Custom invoices sent but unpaid.
  for (const inv of invoices) {
    items.push({
      key: `inv-${inv.id}`,
      kind: "Custom invoice",
      customer: inv.customerName,
      ref: inv.reference,
      amountCents: inv.totalCents,
      since: inv.createdAt,
      payUrl: inv.payUrl ?? null,
    });
  }

  items.sort((a, b) => +b.since - +a.since);
  const total = items.reduce((s, i) => s + i.amountCents, 0);
  const now = new Date();
  const daysAgo = (d: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));

  const KIND_TONE: Record<Unpaid["kind"], string> = {
    Deposit: "border-sky-500/50 text-sky-400 bg-sky-500/10",
    "Final balance": "border-amber-500/50 text-amber-300 bg-amber-500/10",
    "Add-on": "border-brand/50 text-brand bg-brand/10",
    "Custom invoice": "border-violet-500/50 text-violet-400 bg-violet-500/10",
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">← Dashboard</Link>
      <h1 className="display text-4xl text-foreground mt-3">💸 Awaiting Payment ({items.length})</h1>
      <p className="mt-2 text-muted">Every invoice that&apos;s out the door with money still due - {money(total)} total. Includes team-order deposits &amp; balances, add-on invoices, and custom invoices.</p>

      <div className="mt-6 border border-amber-500/40 divide-y divide-[color:var(--line)]">
        {items.length === 0 && <p className="px-4 py-6 text-sm text-muted">Nothing outstanding - everyone&apos;s paid up. 🎉</p>}
        {items.map((it) => (
          <div key={it.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className={`inline-block border px-2 py-0.5 text-xs display mr-2 ${KIND_TONE[it.kind]}`}>{it.kind}</span>
              {it.orderId ? (
                <Link href={`/admin/team-order/${it.orderId}`} className="font-mono text-xs text-brand hover:underline">{it.ref}</Link>
              ) : (
                <span className="font-mono text-xs text-muted">{it.ref}</span>
              )}
              <span className="ml-2 text-foreground">{it.customer}</span>
              {it.detail && <span className="block text-xs text-muted mt-0.5">{it.detail}</span>}
              <span className="block text-xs text-muted mt-0.5">sent {daysAgo(it.since)}d ago</span>
            </span>
            <span className="flex items-center gap-3 shrink-0">
              {it.payUrl && (
                <a href={it.payUrl} target="_blank" rel="noopener noreferrer" className="text-xs display text-brand border border-brand/50 px-2 py-1 hover:bg-brand/10">Pay link</a>
              )}
              <span className="display text-foreground whitespace-nowrap">{money(it.amountCents)}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Team-order reminder emails/texts go out automatically after 3 days, then 4 more (max 2 per invoice).</p>
    </div>
  );
}
