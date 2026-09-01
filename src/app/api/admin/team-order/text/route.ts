import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { smsContacts, smsMessages, teamOrders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { sendSms, toE164 } from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireApiRole("conversations");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 403 ? "Forbidden" : "Unauthorized" },
      { status: gate.status },
    );
  }
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; message?: string } = {};
  try { body = await req.json(); } catch {}
  const teamOrderId = body.teamOrderId?.trim();
  const message = body.message?.trim().slice(0, 1500) ?? "";
  if (!teamOrderId) return NextResponse.json({ error: "Team order required." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Type a message first." }, { status: 400 });

  const db = getDb();
  const [order] = await db
    .select({
      contactName: teamOrders.contactName,
      contactPhone: teamOrders.contactPhone,
      smsOptInAt: teamOrders.smsOptInAt,
    })
    .from(teamOrders)
    .where(eq(teamOrders.id, teamOrderId))
    .limit(1);

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.smsOptInAt) {
    return NextResponse.json({ error: "This customer did not opt in to SMS updates." }, { status: 400 });
  }
  const phone = toE164(order.contactPhone);
  if (!phone) {
    return NextResponse.json({ error: "This order does not have a valid customer phone number." }, { status: 400 });
  }

  const result = await sendSms(phone, message);
  if (!result.ok) {
    return NextResponse.json(
      { error: "The text provider rejected the message. Check the number and try again." },
      { status: 502 },
    );
  }

  await Promise.all([
    db
      .insert(smsContacts)
      .values({ phone, name: order.contactName })
      .onConflictDoUpdate({ target: smsContacts.phone, set: { name: order.contactName } }),
    db.insert(smsMessages).values({
      phone,
      direction: "out",
      channel: "sms",
      body: message,
      staff: gate.session.name,
      twilioSid: result.sid ?? null,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
