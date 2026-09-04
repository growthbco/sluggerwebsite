// Mini-CRM lookups shared by the Texts inbox API and the SMS draft-reply AI.

import { eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { customers, teamOrders, designRequests, teamOrderAddons, smsContacts, designLabVisitors } from "@/db/schema";

const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);

/** Everything we know about the person behind a phone number: matched orders,
 *  design projects, emails, and an approximate lifetime spend. Powers the
 *  customer panel next to the conversation. */
export async function customerContext(phone: string) {
  const db = getDb();
  const key = last10(phone);
  // Match on the last 10 digits in SQL (numbers are stored in mixed formats),
  // and pull ONLY the columns the panel uses - not whole rows of every table.
  const phoneMatch = (col: AnyPgColumn) =>
    sql`right(regexp_replace(coalesce(${col}, ''), '[^0-9]', '', 'g'), 10) = ${key}`;
  const [myOrders, myDesigns, myCustomers] = await Promise.all([
    db
      .select({
        id: teamOrders.id,
        reference: teamOrders.reference,
        teamName: teamOrders.teamName,
        status: teamOrders.status,
        contactEmail: teamOrders.contactEmail,
        quotedTotalCents: teamOrders.quotedTotalCents,
        invoicePaidAt: teamOrders.invoicePaidAt,
        depositPaidAt: teamOrders.depositPaidAt,
        depositCents: teamOrders.depositCents,
        rushShipping: teamOrders.rushShipping,
        createdAt: teamOrders.createdAt,
      })
      .from(teamOrders)
      .where(phoneMatch(teamOrders.contactPhone)),
    db
      .select({
        id: designRequests.id,
        reference: designRequests.reference,
        teamName: designRequests.teamName,
        status: designRequests.status,
        contactEmail: designRequests.contactEmail,
        manageToken: designRequests.manageToken,
        designFeePaymentId: designRequests.designFeePaymentId,
        designFeeAmountCents: designRequests.designFeeAmountCents,
        createdAt: designRequests.createdAt,
      })
      .from(designRequests)
      .where(phoneMatch(designRequests.contactPhone)),
    db
      .select({ email: customers.email })
      .from(customers)
      .where(phoneMatch(customers.phone)),
  ]);

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
  // Only a REAL Stripe payment counts as spend - a waived fee sets
  // designFeePaidAt just to mark it handled, so gate on designFeePaymentId
  // or every waived $35 shows as phantom spend the customer never paid.
  for (const d of myDesigns) if (d.designFeePaymentId) spendCents += d.designFeeAmountCents;

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
        rushShipping: o.rushShipping,
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
  const [cs, ts, ds, dl, sc] = await Promise.all([
    db.select({ phone: customers.phone, name: customers.name }).from(customers),
    db.select({ phone: teamOrders.contactPhone, name: teamOrders.contactName }).from(teamOrders),
    db.select({ phone: designRequests.contactPhone, name: designRequests.contactName }).from(designRequests),
    db.select({ phone: designLabVisitors.phone, first: designLabVisitors.firstName, last: designLabVisitors.lastName }).from(designLabVisitors),
    db.select({ phone: smsContacts.phone, name: smsContacts.name }).from(smsContacts),
  ]);
  // Design-lab leads store first/last separately - join into one name.
  const dlNames = dl.map((r) => ({ phone: r.phone, name: [r.first, r.last].map((s) => (s ?? "").trim()).filter(Boolean).join(" ") }));
  // Record-derived names first (order/design contacts win over lab leads),
  // then staff-saved contacts OVERRIDE them.
  for (const r of [...cs, ...ts, ...ds, ...dlNames]) {
    const k = last10(r.phone);
    if (k.length === 10 && r.name && !map.has(k)) map.set(k, r.name);
  }
  for (const r of sc) {
    const k = last10(r.phone);
    // Skip auto-generated "(708) 910-8532" fallback names that state-only
    // contact rows (star/archive/mark-read) store because smsContacts.name is
    // NOT NULL. Letting those override would replace a real record-derived name
    // with the phone number. A real name always contains a letter.
    if (k.length === 10 && r.name && /[a-zA-Z]/.test(r.name)) map.set(k, r.name);
  }
  return map;
}
