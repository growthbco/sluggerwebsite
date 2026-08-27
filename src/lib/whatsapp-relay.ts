import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { smsMessages, customers } from "@/db/schema";
import { sendSms, toE164 } from "@/lib/sms";

// WhatsApp relay: forward each customer text to the OWNER's WhatsApp so he can
// reply from his phone; his WhatsApp reply is relayed back to the customer as an
// SMS. Inert unless both env vars are set.
//   WHATSAPP_OWNER_NUMBER - the owner's personal WhatsApp number (E164)
//   WHATSAPP_FROM         - the Twilio WhatsApp sender (falls back to TWILIO_FROM)
export function ownerNumber(): string | null {
  return toE164(process.env.WHATSAPP_OWNER_NUMBER || "");
}
export function relayEnabled(): boolean {
  return Boolean(ownerNumber() && (process.env.WHATSAPP_FROM || process.env.TWILIO_FROM));
}
export function isOwner(phone: string | null | undefined): boolean {
  const o = ownerNumber();
  return Boolean(o && toE164(phone || "") === o);
}

const last10 = (s: string) => (s || "").replace(/\D/g, "").slice(-10);

/** Best-effort display name for a phone. Checks everywhere we store a contact -
 *  customers, design requests, team orders, shop orders, AI-lab leads - matched
 *  on the last 10 digits (formats vary). Falls back to the number. */
async function nameForPhone(phone: string): Promise<string> {
  const key = last10(phone);
  if (!key) return phone;
  try {
    const db = getDb();
    const { designRequests, teamOrders, orders, designLabVisitors } = await import("@/db/schema");
    const [cust, dr, to, ord, lab] = await Promise.all([
      db.select({ name: customers.name, phone: customers.phone }).from(customers),
      db.select({ name: designRequests.contactName, phone: designRequests.contactPhone }).from(designRequests),
      db.select({ name: teamOrders.contactName, phone: teamOrders.contactPhone }).from(teamOrders),
      db.select({ name: orders.customerName, phone: orders.customerPhone }).from(orders),
      db.select({ first: designLabVisitors.firstName, last: designLabVisitors.lastName, phone: designLabVisitors.phone }).from(designLabVisitors),
    ]);
    const pool: { name: string | null; phone: string | null }[] = [
      ...cust,
      ...dr,
      ...to,
      ...ord,
      ...lab.map((r) => ({ name: [r.first, r.last].filter(Boolean).join(" ") || null, phone: r.phone })),
    ];
    const hit = pool.find((r) => r.phone && last10(r.phone) === key && (r.name ?? "").trim());
    return hit?.name?.trim() || phone;
  } catch {
    return phone;
  }
}

/** The customer the owner is currently in conversation with = the most recent
 *  INBOUND SMS from anyone other than the owner. Stateless "active thread". */
async function mostRecentCustomerPhone(): Promise<string | null> {
  const o = ownerNumber();
  const [row] = await getDb()
    .select({ phone: smsMessages.phone })
    .from(smsMessages)
    .where(and(eq(smsMessages.direction, "in"), eq(smsMessages.channel, "sms"), o ? ne(smsMessages.phone, o) : undefined))
    .orderBy(desc(smsMessages.createdAt))
    .limit(1);
  return row?.phone ?? null;
}

// Send a WhatsApp message to the owner via an approved CONTENT TEMPLATE, which
// works even outside WhatsApp's 24-hour window. Template body should be
// "New message from {{1}}: {{2}}. ..." Returns false if not configured / fails.
async function sendOwnerViaTemplate(from: string, message: string): Promise<boolean> {
  const sid = process.env.WHATSAPP_TEMPLATE_SID;
  const owner = ownerNumber();
  const waFrom = process.env.WHATSAPP_FROM || process.env.TWILIO_FROM;
  const acct = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !owner || !waFrom || !acct || !token) return false;
  try {
    const params = new URLSearchParams({
      To: `whatsapp:${owner}`,
      From: `whatsapp:${waFrom}`,
      ContentSid: sid,
      ContentVariables: JSON.stringify({ "1": from.slice(0, 120), "2": message.slice(0, 900) || "(attachment)" }),
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acct}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${acct}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Forward an inbound customer text to the owner's WhatsApp. Uses the approved
 *  template (always delivers) when configured, else a free-form message (only
 *  delivers inside the 24-hour window). */
export async function forwardToOwner(fromPhone: string, body: string, mediaUrls: string[] = []): Promise<void> {
  const owner = ownerNumber();
  if (!owner || !relayEnabled()) return;
  const name = await nameForPhone(fromPhone);
  const who = name === fromPhone ? fromPhone : `${name} (${fromPhone})`;
  const message = mediaUrls.length ? `${body || ""} (+${mediaUrls.length} attachment, see admin inbox)`.trim() : body || "(attachment)";

  // Prefer the template so forwards arrive even outside the 24h window.
  if (process.env.WHATSAPP_TEMPLATE_SID) {
    const ok = await sendOwnerViaTemplate(who, message);
    if (ok) return;
  }
  // Free-form fallback (works only inside the 24h window).
  await sendSms(owner, `📩 ${who}:\n${message}\n\nReply here and I'll text them back.`, "whatsapp", mediaUrls);
}

/** Relay the owner's WhatsApp reply to the current customer as an SMS. Returns
 *  the customer it went to (for a confirmation), or null if none. */
export async function relayOwnerReply(body: string, mediaUrls: string[] = []): Promise<{ phone: string; name: string } | null> {
  const owner = ownerNumber();
  if (!owner || !dbEnabled()) return null;
  const target = await mostRecentCustomerPhone();
  if (!target) {
    await sendSms(owner, "No recent customer to reply to. Wait for their next message.", "whatsapp");
    return null;
  }
  const r = await sendSms(target, body, "sms", mediaUrls);
  try {
    await getDb().insert(smsMessages).values({
      phone: target,
      direction: "out",
      channel: "sms",
      body,
      staff: "Owner (WhatsApp)",
      twilioSid: r.sid,
      mediaCount: mediaUrls.length || 0,
      mediaUrls: mediaUrls.length ? mediaUrls : null,
    });
  } catch (e) {
    console.error("relay log failed:", e);
  }
  const name = await nameForPhone(target);
  // Quiet confirmation back to the owner's WhatsApp.
  await sendSms(owner, `✓ Sent to ${name === target ? target : `${name} (${target})`}`, "whatsapp");
  return { phone: target, name };
}
