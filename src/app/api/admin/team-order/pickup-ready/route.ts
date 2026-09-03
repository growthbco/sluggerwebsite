import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { smsContacts, smsMessages, teamOrders } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { pickupReadyMessage } from "@/lib/pickup-ready-message";
import { sendSms, textedRecently, toE164 } from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireApiRole("customer");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string } = {};
  try { body = await req.json(); } catch {}
  const teamOrderId = body.teamOrderId?.trim();
  if (!teamOrderId) return NextResponse.json({ error: "Team order required." }, { status: 400 });

  const db = getDb();
  const [order] = await db
    .select({
      reference: teamOrders.reference,
      teamName: teamOrders.teamName,
      contactName: teamOrders.contactName,
      contactPhone: teamOrders.contactPhone,
      smsOptInAt: teamOrders.smsOptInAt,
      localPickup: teamOrders.localPickup,
      status: teamOrders.status,
      invoicePaidAt: teamOrders.invoicePaidAt,
      deliveredAt: teamOrders.deliveredAt,
    })
    .from(teamOrders)
    .where(eq(teamOrders.id, teamOrderId))
    .limit(1);

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.localPickup) return NextResponse.json({ error: "This order is not set for local pickup." }, { status: 400 });
  if (!order.invoicePaidAt && !["paid", "shipped"].includes(order.status)) {
    return NextResponse.json({ error: "The order must be paid in full before sending a ready-for-pickup text." }, { status: 400 });
  }
  if (order.deliveredAt) return NextResponse.json({ error: "This order is already marked picked up." }, { status: 400 });
  if (!order.smsOptInAt) return NextResponse.json({ error: "This customer did not opt in to SMS updates." }, { status: 400 });
  const phone = toE164(order.contactPhone);
  if (!phone) return NextResponse.json({ error: "This order does not have a valid customer phone number." }, { status: 400 });

  const duplicateNeedle = `${order.reference}) is ready for pickup`;
  if (await textedRecently(phone, duplicateNeedle, 24 * 60)) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  const text = pickupReadyMessage(order);
  const result = await sendSms(phone, text);
  if (!result.ok) return NextResponse.json({ error: "The text provider rejected the message. Check the number and try again." }, { status: 502 });

  await Promise.all([
    db
      .insert(smsContacts)
      .values({ phone, name: order.contactName })
      .onConflictDoUpdate({ target: smsContacts.phone, set: { name: order.contactName } }),
    db.insert(smsMessages).values({
      phone,
      direction: "out",
      channel: "sms",
      body: text,
      staff: gate.session.name,
      twilioSid: result.sid ?? null,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
