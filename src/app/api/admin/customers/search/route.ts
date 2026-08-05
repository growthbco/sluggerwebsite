import { NextResponse } from "next/server";
import { desc, ilike, or } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { customers, orders, teamOrders, designRequests } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

type Address = { line1?: string; city?: string; state?: string; postalCode?: string } | null;
type Hit = { name: string; email: string; phone: string | null; creditCents: number; address: Address; addressAt: Date | null; lastSeen: Date | null };

// Admin type-ahead: find an existing customer by name or email so invoices
// (and anything else) can reuse their contact info instead of retyping it.
// Searches everywhere a contact has ever appeared - the customers table plus
// order/team-order/design-request contacts - deduped by email, newest first.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const like = `%${q}%`;

  const db = getDb();
  const [fromCustomers, fromOrders, fromTeamOrders, fromDesigns] = await Promise.all([
    db
      .select({ name: customers.name, email: customers.email, phone: customers.phone, creditCents: customers.referralCreditCents, at: customers.updatedAt })
      .from(customers)
      .where(or(ilike(customers.name, like), ilike(customers.email, like)))
      .orderBy(desc(customers.updatedAt))
      .limit(10),
    db
      .select({ name: orders.customerName, email: orders.customerEmail, address: orders.shippingAddress, at: orders.createdAt })
      .from(orders)
      .where(or(ilike(orders.customerName, like), ilike(orders.customerEmail, like)))
      .orderBy(desc(orders.createdAt))
      .limit(10),
    db
      .select({ name: teamOrders.contactName, email: teamOrders.contactEmail, phone: teamOrders.contactPhone, address: teamOrders.shippingAddress, at: teamOrders.createdAt })
      .from(teamOrders)
      .where(or(ilike(teamOrders.contactName, like), ilike(teamOrders.contactEmail, like)))
      .orderBy(desc(teamOrders.createdAt))
      .limit(10),
    db
      .select({ name: designRequests.contactName, email: designRequests.contactEmail, phone: designRequests.contactPhone, at: designRequests.createdAt })
      .from(designRequests)
      .where(or(ilike(designRequests.contactName, like), ilike(designRequests.contactEmail, like)))
      .orderBy(desc(designRequests.createdAt))
      .limit(10),
  ]);

  // Dedupe by email. The customers-table row wins for phone/credit; the most
  // recent sighting anywhere wins for the name and recency sort.
  const byEmail = new Map<string, Hit>();
  const add = (name: string | null, email: string | null, phone: string | null, creditCents: number, at: Date | null, address: Address = null) => {
    const key = (email ?? "").trim().toLowerCase();
    if (!key) return;
    const addr = address?.postalCode ? address : null;
    const prev = byEmail.get(key);
    if (!prev) {
      byEmail.set(key, { name: name?.trim() || "", email: key, phone, creditCents, address: addr, addressAt: addr ? at : null, lastSeen: at });
      return;
    }
    if (at && (!prev.lastSeen || at > prev.lastSeen)) {
      prev.lastSeen = at;
      if (name?.trim()) prev.name = name.trim();
    }
    if (!prev.name && name?.trim()) prev.name = name.trim();
    if (!prev.phone && phone) prev.phone = phone;
    if (creditCents > prev.creditCents) prev.creditCents = creditCents;
    // Most recent address on file wins.
    if (addr && (!prev.addressAt || (at && at > prev.addressAt))) {
      prev.address = addr;
      prev.addressAt = at;
    }
  };
  for (const c of fromCustomers) add(c.name, c.email, c.phone, c.creditCents, c.at);
  for (const o of fromOrders) add(o.name, o.email, null, 0, o.at, o.address);
  for (const t of fromTeamOrders) add(t.name, t.email, t.phone, 0, t.at, t.address);
  for (const d of fromDesigns) add(d.name, d.email, d.phone, 0, d.at);

  const results = [...byEmail.values()]
    .sort((a, b) => (b.lastSeen?.getTime() ?? 0) - (a.lastSeen?.getTime() ?? 0))
    .slice(0, 8)
    .map(({ name, email, phone, creditCents, address }) => ({
      name,
      email,
      phone,
      creditCents,
      zip: address?.postalCode ?? null,
      cityState: address ? [address.city, address.state].filter(Boolean).join(", ") || null : null,
    }));

  return NextResponse.json({ results });
}
