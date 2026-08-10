import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { smsMessages, smsContacts, customers, teamOrders, designRequests, teamOrderAddons } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { sendSms, toE164 } from "@/lib/sms";

export const runtime = "nodejs";

const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);

// Best-effort name lookup: match the last 10 digits of the customer's number
// against every place we store phones.
async function namesByPhone(): Promise<Map<string, string>> {
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

/** Everything we know about the person behind a phone number: matched orders,
 *  design projects, emails, and an approximate lifetime spend. Powers the
 *  customer panel next to the conversation. */
async function customerContext(phone: string) {
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

// GET -> conversation list; ?phone= -> full thread; ?phone=&context=1 -> CRM panel.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const db = getDb();
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone");

  if (phone && url.searchParams.get("context") === "1") {
    return NextResponse.json(await customerContext(phone));
  }

  if (phone) {
    const messages = await db
      .select()
      .from(smsMessages)
      .where(eq(smsMessages.phone, phone))
      .orderBy(smsMessages.createdAt)
      .limit(500);
    return NextResponse.json({ messages });
  }

  // Latest + latest-inbound per phone (inbound timestamp drives unread).
  const rows = await db
    .select({
      phone: smsMessages.phone,
      lastAt: sql<string>`max(${smsMessages.createdAt})`,
      lastInAt: sql<string | null>`max(${smsMessages.createdAt}) filter (where ${smsMessages.direction} = 'in')`,
      count: sql<number>`count(*)`,
    })
    .from(smsMessages)
    .groupBy(smsMessages.phone)
    .orderBy(desc(sql`max(${smsMessages.createdAt})`))
    .limit(150);
  const latest = await db.select().from(smsMessages).orderBy(desc(smsMessages.createdAt)).limit(400);
  const lastBody = new Map<string, { body: string; direction: string; channel: string }>();
  for (const m of latest) if (!lastBody.has(m.phone)) lastBody.set(m.phone, { body: m.body, direction: m.direction, channel: m.channel });
  const [names, contacts] = await Promise.all([namesByPhone(), db.select().from(smsContacts)]);
  const meta = new Map(contacts.map((c) => [c.phone, c]));
  const conversations = rows.map((r) => {
    const c = meta.get(r.phone);
    return {
      phone: r.phone,
      name: names.get(last10(r.phone)) ?? null,
      lastAt: r.lastAt,
      count: Number(r.count),
      last: lastBody.get(r.phone) ?? null,
      starred: Boolean(c?.starredAt),
      archived: Boolean(c?.archivedAt),
      unread: Boolean(r.lastInAt && (!c?.lastReadAt || new Date(r.lastInAt) > c.lastReadAt)),
    };
  });
  return NextResponse.json({ conversations });
}

// PUT {phone, name?, star?, archive?, markRead?} -> contact + conversation state.
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  let body: { phone?: string; name?: string; star?: boolean; archive?: boolean; markRead?: boolean } = {};
  try { body = await req.json(); } catch {}
  const phone = toE164(body.phone ?? "");
  if (!phone) return NextResponse.json({ error: "Phone required." }, { status: 400 });
  const name = (body.name ?? "").trim().slice(0, 80);

  const set: Record<string, unknown> = {};
  if (name) set.name = name;
  if (typeof body.star === "boolean") set.starredAt = body.star ? new Date() : null;
  if (typeof body.archive === "boolean") set.archivedAt = body.archive ? new Date() : null;
  if (body.markRead === true) set.lastReadAt = new Date();
  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const db = getDb();
  // Contacts require a name; fall back to the pretty number for state-only rows.
  const d = phone.replace(/\D/g, "").slice(-10);
  const fallbackName = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  await db
    .insert(smsContacts)
    .values({ phone, name: name || fallbackName, ...set })
    .onConflictDoUpdate({ target: smsContacts.phone, set });
  return NextResponse.json({ ok: true, phone });
}

// POST {phone, body, channel?, name?, note?} -> send + log; note=true stores an
// internal staff note in the thread WITHOUT texting the customer.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  let body: { phone?: string; body?: string; channel?: string; name?: string; note?: boolean } = {};
  try { body = await req.json(); } catch {}
  const phone = toE164(body.phone ?? "");
  const text = (body.body ?? "").trim().slice(0, 1500);
  const contactName = (body.name ?? "").trim().slice(0, 80);
  const channel = body.channel === "whatsapp" ? "whatsapp" : "sms";
  if (!phone) return NextResponse.json({ error: "Enter a valid US phone number." }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Type a message." }, { status: 400 });

  if (contactName) {
    await getDb().insert(smsContacts).values({ phone, name: contactName }).onConflictDoUpdate({ target: smsContacts.phone, set: { name: contactName } });
  }

  if (body.note === true) {
    const [row] = await getDb()
      .insert(smsMessages)
      .values({ phone, direction: "note", channel: "sms", body: text, staff: "admin" })
      .returning();
    return NextResponse.json({ ok: true, message: row });
  }

  const result = await sendSms(phone, text, channel);
  if (!result.ok) return NextResponse.json({ error: "Twilio rejected the message - check the number and try again." }, { status: 502 });

  const [row] = await getDb()
    .insert(smsMessages)
    .values({ phone, direction: "out", channel, body: text, staff: "admin", twilioSid: result.sid ?? null })
    .returning();
  return NextResponse.json({ ok: true, message: row });
}
