import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { smsMessages, smsContacts, customers, teamOrders, designRequests } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { sendSms, toE164 } from "@/lib/sms";

export const runtime = "nodejs";

// Best-effort name lookup: match the last 10 digits of the customer's number
// against every place we store phones.
async function namesByPhone(): Promise<Map<string, string>> {
  const db = getDb();
  const map = new Map<string, string>();
  const key = (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
  const [cs, ts, ds, sc] = await Promise.all([
    db.select({ phone: customers.phone, name: customers.name }).from(customers),
    db.select({ phone: teamOrders.contactPhone, name: teamOrders.contactName }).from(teamOrders),
    db.select({ phone: designRequests.contactPhone, name: designRequests.contactName }).from(designRequests),
    db.select({ phone: smsContacts.phone, name: smsContacts.name }).from(smsContacts),
  ]);
  // Record-derived names first, then staff-saved contacts OVERRIDE them.
  for (const r of [...cs, ...ts, ...ds]) {
    const k = key(r.phone);
    if (k.length === 10 && r.name && !map.has(k)) map.set(k, r.name);
  }
  for (const r of sc) {
    const k = key(r.phone);
    if (k.length === 10 && r.name) map.set(k, r.name);
  }
  return map;
}

// GET -> conversation list; GET ?phone=+1... -> full thread.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const db = getDb();
  const phone = new URL(req.url).searchParams.get("phone");

  if (phone) {
    const messages = await db
      .select()
      .from(smsMessages)
      .where(eq(smsMessages.phone, phone))
      .orderBy(smsMessages.createdAt)
      .limit(500);
    return NextResponse.json({ messages });
  }

  // Latest message per phone.
  const rows = await db
    .select({
      phone: smsMessages.phone,
      lastAt: sql<string>`max(${smsMessages.createdAt})`,
      count: sql<number>`count(*)`,
    })
    .from(smsMessages)
    .groupBy(smsMessages.phone)
    .orderBy(desc(sql`max(${smsMessages.createdAt})`))
    .limit(100);
  const latest = await db.select().from(smsMessages).orderBy(desc(smsMessages.createdAt)).limit(300);
  const lastBody = new Map<string, { body: string; direction: string; channel: string }>();
  for (const m of latest) if (!lastBody.has(m.phone)) lastBody.set(m.phone, { body: m.body, direction: m.direction, channel: m.channel });
  const names = await namesByPhone();
  const conversations = rows.map((r) => ({
    phone: r.phone,
    name: names.get(r.phone.replace(/\D/g, "").slice(-10)) ?? null,
    lastAt: r.lastAt,
    count: Number(r.count),
    last: lastBody.get(r.phone) ?? null,
  }));
  return NextResponse.json({ conversations });
}

// PUT {phone, name} -> save/rename a contact for the inbox.
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  let body: { phone?: string; name?: string } = {};
  try { body = await req.json(); } catch {}
  const phone = toE164(body.phone ?? "");
  const name = (body.name ?? "").trim().slice(0, 80);
  if (!phone || !name) return NextResponse.json({ error: "Phone and name required." }, { status: 400 });
  await getDb()
    .insert(smsContacts)
    .values({ phone, name })
    .onConflictDoUpdate({ target: smsContacts.phone, set: { name } });
  return NextResponse.json({ ok: true, phone, name });
}

// POST {phone, body, channel?, name?} -> send + log (+ save contact name).
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  let body: { phone?: string; body?: string; channel?: string; name?: string } = {};
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
  const result = await sendSms(phone, text, channel);
  if (!result.ok) return NextResponse.json({ error: "Twilio rejected the message - check the number and try again." }, { status: 502 });

  const [row] = await getDb()
    .insert(smsMessages)
    .values({ phone, direction: "out", channel, body: text, staff: "admin", twilioSid: result.sid ?? null })
    .returning();
  return NextResponse.json({ ok: true, message: row });
}
