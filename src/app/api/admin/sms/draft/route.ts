import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { smsMessages, smsContacts } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { toE164 } from "@/lib/sms";
import { customerContext } from "@/lib/sms-crm";
import { draftSmsReply } from "@/lib/design-assistant";

export const runtime = "nodejs";
export const maxDuration = 60;

// AI draft for the Texts inbox: reads the whole conversation AND the
// customer's real orders/designs, then writes a reply into the staff
// member's box. Human edits and sends - never auto-replies.
export async function POST(req: Request) {
  const gate = await requireApiRole("customer");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { phone?: string; direction?: string } = {};
  try { body = await req.json(); } catch {}
  const phone = toE164(body.phone ?? "");
  if (!phone) return NextResponse.json({ error: "Phone required." }, { status: 400 });

  const db = getDb();
  const [messages, [contact], context] = await Promise.all([
    db.select().from(smsMessages).where(eq(smsMessages.phone, phone)).orderBy(smsMessages.createdAt).limit(500),
    db.select().from(smsContacts).where(eq(smsContacts.phone, phone)).limit(1),
    customerContext(phone),
  ]);

  const draft = await draftSmsReply({
    contactName: contact?.name ?? null,
    thread: messages.map((m) => ({ direction: m.direction, body: m.body, at: m.createdAt.toISOString() })),
    context,
    direction: (body.direction ?? "").trim().slice(0, 600) || undefined,
  });
  if (!draft) return NextResponse.json({ error: "Couldn't draft a reply - try again." }, { status: 502 });
  return NextResponse.json({ draft });
}
