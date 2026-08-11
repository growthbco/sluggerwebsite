// Mini-CRM lookups shared by the Texts inbox API and the SMS draft-reply AI.

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, teamOrders, designRequests, teamOrderAddons, smsContacts } from "@/db/schema";

const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);

/** Everything we know about the person behind a phone number: matched orders,
 *  design projects, emails, and an approximate lifetime spend. Powers the
 *  customer panel next to the conversation. */
export async function customerContext(phone: string) {
  const db = getDb();
  const key = last10(phone);
  const [orders, designs, custs] = await Promise.all([
    db.select().from(teamOrders),
    db.select().from(designRequests),
    db.select().from(customers),
  ]);
  const myOrders = orders.filter((o) => last10(o.contactPhone) === key);
  const myDesigns = designs.filter((d) => last10(d.contactPhone) === key);
  const myCustomers = custs.filter((c) => last10(c.phone) === key);

  // Approximate lifetime spend: paid-in-full orders at their quoted total,
  // deposit-only orders at the deposit, plus paid add-on batches and paid
  // design fees. Goods-level (tax/shipping vary) - labeled approx in the UI.
  let spendCents = 0;
  for (const o of myOrders) {
    if (o.invoicePaidAt) spendCents += o.quotedTotalCents ?? 0;
    else if (o.depositPaidAt) spendCents += o.depositCents ?? Math.round((o.quotedTotalCents ?? 0) / 2);
    const addons = await db.select().from(teamOrderAddons).where(eq(teamOrderAddons.teamOrderId, o.id));
    for (const a of addons) if (a.status === "paid") spendCents += a.totalCents;
  }
  for (const d of myDesigns) if (d.designFeePaidAt) spendCents += d.designFeeAmountCents;

  const emails = [...new Set([...myOrders.map((o) => o.contactEmail), ...myDesigns.map((d) => d.contactEmail), ...myCustomers.map((c) => c.email)].filter(Boolean).map((e) => e!.toLowerCase()))];

  return {
    emails,
    spendCents,
    orders: myOrders
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map((o) => ({
        id: o.id,
        reference: o.reference,
        teamName: o.teamName,
        status: o.status,
        totalCents: o.quotedTotalCents,
        paid: Boolean(o.invoicePaidAt),
        depositPaid: Boolean(o.depositPaidAt),
      })),
    designs: myDesigns
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map((d) => ({
        id: d.id,
        reference: d.reference,
        teamName: d.teamName,
        status: d.status,
        manageToken: d.manageToken,
      })),
  };
}

// Best-effort name lookup: match the last 10 digits of the customer's number
// against every place we store phones.
export async function namesByPhone(): Promise<Map<string, string>> {
  const db = getDb();
  const map = new Map<string, string>();
  const [cs, ts, ds, sc] = await Promise.all([
    db.select({ phone: customers.phone, name: customers.name }).from(customers),
    db.select({ phone: teamOrders.contactPhone, name: teamOrders.contactName }).from(teamOrders),
    db.select({ phone: designRequests.contactPhone, name: designRequests.contactName }).from(designRequests),
    db.select({ phone: smsContacts.phone, name: smsContacts.name }).from(smsContacts),
  ]);
  // Record-derived names first, then staff-saved contacts OVERRIDE them.
  for (const r of [...cs, ...ts, ...ds]) {
    const k = last10(r.phone);
    if (k.length === 10 && r.name && !map.has(k)) map.set(k, r.name);
  }
  for (const r of sc) {
    const k = last10(r.phone);
    if (k.length === 10 && r.name) map.set(k, r.name);
  }
  return map;
}


