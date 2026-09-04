import { NextResponse } from "next/server";
import { dbEnabled, getDb } from "@/db";
import { smsContacts, smsMessages } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { getContactFollowUps } from "@/lib/contact-follow-ups";
import { sendSms, textedRecently, toE164, withinTextingHours } from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireApiRole("follow_up");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { phone?: string; reference?: string } = {};
  try { body = await req.json(); } catch {}
  const phone = toE164(body.phone);
  const reference = (body.reference ?? "").trim().slice(0, 30);
  if (!phone || !reference) return NextResponse.json({ error: "Choose a valid customer step." }, { status: 400 });
  if (!withinTextingHours()) {
    return NextResponse.json({ error: "Pickup-link texts can be sent from 8 AM to 7 PM Eastern." }, { status: 409 });
  }

  // Resolve the phone, stalled step, message, and private continuation URL on
  // the server. A follow-up login cannot turn this endpoint into a general SMS
  // sender or supply an arbitrary customer/link.
  const queue = await getContactFollowUps();
  const contact = queue.find((item) => item.phone === phone);
  if (!contact || contact.category === "closed" || contact.category === "archived" || contact.doNotCall) {
    return NextResponse.json({ error: "This customer is not available for a pickup-link text." }, { status: 409 });
  }
  const reason = contact.reasons.find((item) => item.reference === reference && item.resumeUrl && item.textMessage);
  if (!reason?.textMessage) return NextResponse.json({ error: "No secure pickup link is available for that step." }, { status: 409 });
  if (await textedRecently(phone, reference, 60)) {
    return NextResponse.json({ error: "That pickup link was already texted within the last hour." }, { status: 409 });
  }

  const result = await sendSms(phone, reason.textMessage);
  if (!result.ok) return NextResponse.json({ error: "The text could not be delivered. Check the number and try again." }, { status: 502 });

  const now = new Date();
  const nextFollowUpAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const state = {
    name: contact.name,
    followUpStatus: "scheduled",
    nextFollowUpAt,
    followUpUpdatedAt: now,
    followUpUpdatedBy: gate.session.name,
  };
  const db = getDb();
  try {
    await db.batch([
      db
        .insert(smsContacts)
        .values({ phone, ...state })
        .onConflictDoUpdate({ target: smsContacts.phone, set: state }),
      db.insert(smsMessages).values({
        phone,
        direction: "out",
        channel: "sms",
        body: reason.textMessage!,
        staff: gate.session.name,
        twilioSid: result.sid ?? null,
        createdAt: now,
      }),
    ]);
  } catch (error) {
    // The SMS may already have been accepted by Twilio, so log the SID and
    // return success with a warning rather than encouraging a duplicate send.
    console.error("[follow-ups/text] sent but could not save follow-up state", {
      phoneLast4: phone.slice(-4),
      reference,
      twilioSid: result.sid ?? null,
      error,
    });
    return NextResponse.json({
      ok: true,
      nextFollowUpAt: nextFollowUpAt.toISOString(),
      warning: "The text was sent, but the follow-up record could not be updated. Tell Gary before sending it again.",
    });
  }

  console.info("[follow-ups/text] pickup link sent", { phoneLast4: phone.slice(-4), reference, staff: gate.session.name });

  return NextResponse.json({ ok: true, nextFollowUpAt: nextFollowUpAt.toISOString() });
}
