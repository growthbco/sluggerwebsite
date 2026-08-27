import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import { redirect } from "next/navigation";
import { dbEnabled, getDb } from "@/db";
import { customers, teamOrders, designRequests, teamOrderAddons } from "@/db/schema";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { AdminCustomersList, type CustomerRow } from "@/components/admin-customers-list";

export const metadata: Metadata = { title: "Customers", robots: { index: false } };
export const dynamic = "force-dynamic";

// The mini-CRM directory: one row per customer, merged by email across every
// place we know them from (orders, design requests, portal profiles), with
// approximate lifetime spend and a one-tap jump into texting them.
export default async function AdminCustomersPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/customers")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const db = getDb();
  // Only the columns this CRM roll-up actually reads - NOT the whole rows.
  // Full-row selects here pulled every order's print-file JSON + every design's
  // message thread / proof arrays on each load, which is heavy egress for a page
  // that just needs contacts + spend.
  const [orders, designs, custs, addons] = await Promise.all([
    db
      .select({
        id: teamOrders.id,
        contactEmail: teamOrders.contactEmail,
        contactName: teamOrders.contactName,
        contactPhone: teamOrders.contactPhone,
        invoicePaidAt: teamOrders.invoicePaidAt,
        quotedTotalCents: teamOrders.quotedTotalCents,
        depositPaidAt: teamOrders.depositPaidAt,
        depositCents: teamOrders.depositCents,
        updatedAt: teamOrders.updatedAt,
        createdAt: teamOrders.createdAt,
      })
      .from(teamOrders),
    db
      .select({
        contactEmail: designRequests.contactEmail,
        contactName: designRequests.contactName,
        contactPhone: designRequests.contactPhone,
        designFeePaymentId: designRequests.designFeePaymentId,
        designFeeAmountCents: designRequests.designFeeAmountCents,
        updatedAt: designRequests.updatedAt,
        createdAt: designRequests.createdAt,
      })
      .from(designRequests),
    db
      .select({
        email: customers.email,
        name: customers.name,
        phone: customers.phone,
        updatedAt: customers.updatedAt,
        referralCode: customers.referralCode,
        referredByCode: customers.referredByCode,
        referralCreditCents: customers.referralCreditCents,
        referralRewardedAt: customers.referralRewardedAt,
      })
      .from(customers),
    db
      .select({
        teamOrderId: teamOrderAddons.teamOrderId,
        status: teamOrderAddons.status,
        totalCents: teamOrderAddons.totalCents,
      })
      .from(teamOrderAddons),
  ]);
  const paidAddonsByOrder = new Map<string, number>();
  for (const a of addons) {
    if (a.status === "paid") paidAddonsByOrder.set(a.teamOrderId, (paidAddonsByOrder.get(a.teamOrderId) ?? 0) + a.totalCents);
  }

  type Agg = CustomerRow & { _last: number };
  const byEmail = new Map<string, Agg>();
  const get = (emailRaw: string | null, name: string, phone: string | null): Agg | null => {
    const email = (emailRaw ?? "").trim().toLowerCase();
    if (!email) return null;
    let a = byEmail.get(email);
    if (!a) {
      a = { email, name, phone: null, orders: 0, designs: 0, spendCents: 0, lastActivity: "", latestOrderId: null, _last: 0 };
      byEmail.set(email, a);
    }
    if (name && (!a.name || a.name.length < name.length)) a.name = name;
    if (phone && !a.phone) a.phone = phone;
    return a;
  };

  for (const o of orders) {
    const a = get(o.contactEmail, o.contactName, o.contactPhone);
    if (!a) continue;
    a.orders += 1;
    if (o.invoicePaidAt) a.spendCents += o.quotedTotalCents ?? 0;
    else if (o.depositPaidAt) a.spendCents += o.depositCents ?? Math.round((o.quotedTotalCents ?? 0) / 2);
    a.spendCents += paidAddonsByOrder.get(o.id) ?? 0;
    const t = (o.updatedAt ?? o.createdAt).getTime();
    if (t > a._last) { a._last = t; a.latestOrderId = o.id; }
  }
  for (const d of designs) {
    const a = get(d.contactEmail, d.contactName, d.contactPhone);
    if (!a) continue;
    a.designs += 1;
    // Only a REAL Stripe payment counts as spend - waived/free designs set
    // designFeePaidAt but never charged, so gate on designFeePaymentId.
    if (d.designFeePaymentId) a.spendCents += d.designFeeAmountCents;
    const t = (d.updatedAt ?? d.createdAt).getTime();
    if (t > a._last) a._last = t;
  }
  for (const c of custs) {
    const a = get(c.email, c.name ?? "", c.phone);
    if (a && c.updatedAt && c.updatedAt.getTime() > a._last) a._last = c.updatedAt.getTime();
  }

  const rows: CustomerRow[] = [...byEmail.values()]
    .sort((a, b) => b._last - a._last)
    .slice(0, 500)
    .map(({ _last, ...r }) => ({ ...r, lastActivity: new Date(_last).toISOString() }));

  // Referral activity, straight from the customers table. Each customer has a
  // referralCode; anyone they referred carries that code in referredByCode.
  const codeToName = new Map(custs.filter((c) => c.referralCode).map((c) => [c.referralCode, (c.name || c.email || "a customer").trim()]));
  const referred = custs
    .filter((c) => c.referredByCode)
    .map((c) => ({
      name: (c.name || c.email || "Unknown").trim(),
      by: codeToName.get(c.referredByCode!) ?? c.referredByCode!,
      creditCents: c.referralCreditCents ?? 0,
      rewarded: Boolean(c.referralRewardedAt),
    }))
    .sort((a, b) => b.creditCents - a.creditCents);
  const totalCreditCents = custs.reduce((s, c) => s + (c.referralCreditCents ?? 0), 0);
  const rewardedCount = custs.filter((c) => c.referralRewardedAt).length;
  const money = (c: number) => `$${(c / 100).toFixed(0)}`;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <AdminPageHeader eyebrow="Menu" title="Customers" />
      <p className="mt-2 text-muted">
        Everyone who has ordered, started a design, or made a portal account - one row per person, with
        their orders, approximate lifetime spend, and a one-tap text.
      </p>
      {/* Referral activity - proof the /r/<code> links are converting. */}
      <section className="mt-8 rounded-xl border border-line bg-foreground/[0.02] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl text-foreground">Referrals</h2>
          <p className="text-sm text-muted">
            <strong className="text-foreground">{referred.length}</strong> referred ·{" "}
            <strong className="text-foreground">{rewardedCount}</strong> reward{rewardedCount === 1 ? "" : "s"} granted ·{" "}
            <strong className="text-foreground">{money(totalCreditCents)}</strong> credit earned
          </p>
        </div>
        {referred.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No referrals yet. When someone orders after clicking a customer&apos;s /r/ link, they show up here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[color:var(--line)]">
            {referred.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                <span className="text-foreground"><strong>{r.name}</strong> <span className="text-muted">referred by</span> {r.by}</span>
                <span className="text-muted">
                  {r.creditCents > 0 ? `${money(r.creditCents)} credit` : "no credit yet"}
                  {" · "}
                  <span className={r.rewarded ? "text-green-400" : "text-amber-300"}>{r.rewarded ? "rewarded" : "pending"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <AdminCustomersList rows={rows} />
      </div>
    </div>
  );
}
