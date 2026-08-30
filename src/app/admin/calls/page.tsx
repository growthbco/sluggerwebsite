import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminEnabled, canAccess, getAdminSession } from "@/lib/admin-auth";
import { AdminPageHeader } from "@/components/admin-page-header";
import { dbEnabled, getDb } from "@/db";
import { customers, designRequests, teamOrders, orders, designLabVisitors, smsMessages } from "@/db/schema";
import { listRecentCalls, twilioVoiceEnabled, type CallRecord } from "@/lib/twilio-calls";
import { AdminCallsList, type CallRow } from "@/components/admin-calls-list";

export const metadata: Metadata = { title: "Calls", robots: { index: false } };
export const dynamic = "force-dynamic";

const last10 = (s: string) => (s || "").replace(/\D/g, "").slice(-10);
function fmtPhone(raw: string): string {
  const d = last10(raw);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw || "Unknown";
}

// Best-effort caller name across everywhere we store a contact, matched on the
// last 10 digits. Internal identity strings ("client:owner") never make it in.
async function namesByPhone(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!dbEnabled()) return map;
  const add = (phone: string | null | undefined, name: string | null | undefined) => {
    const k = last10(phone || "");
    const clean = (name || "").trim();
    if (k && clean && !/:/.test(clean) && !map.has(k)) map.set(k, clean);
  };
  try {
    const db = getDb();
    const [cust, dr, to, ord, lab] = await Promise.all([
      db.select({ name: customers.name, phone: customers.phone }).from(customers),
      db.select({ name: designRequests.contactName, phone: designRequests.contactPhone }).from(designRequests),
      db.select({ name: teamOrders.contactName, phone: teamOrders.contactPhone }).from(teamOrders),
      db.select({ name: orders.customerName, phone: orders.customerPhone }).from(orders),
      db.select({ first: designLabVisitors.firstName, last: designLabVisitors.lastName, phone: designLabVisitors.phone }).from(designLabVisitors),
    ]);
    cust.forEach((r) => add(r.phone, r.name));
    dr.forEach((r) => add(r.phone, r.name));
    to.forEach((r) => add(r.phone, r.name));
    ord.forEach((r) => add(r.phone, r.name));
    lab.forEach((r) => add(r.phone, [r.first, r.last].filter(Boolean).join(" ")));
  } catch {
    /* names are a nicety - never block the log */
  }
  return map;
}

// Last-10 digits that already have an SMS/WhatsApp thread, so a row can offer
// to jump straight into the existing conversation.
async function phonesWithThreads(): Promise<Set<string>> {
  const set = new Set<string>();
  if (!dbEnabled()) return set;
  try {
    const rows = await getDb().selectDistinct({ phone: smsMessages.phone }).from(smsMessages);
    rows.forEach((r) => { const k = last10(r.phone || ""); if (k.length === 10) set.add(k); });
  } catch {}
  return set;
}

function statusLabel(c: CallRecord): string {
  if (c.answered) return "Answered";
  switch (c.status) {
    case "busy": return "Busy";
    case "canceled": return "Canceled";
    case "failed": return "Failed";
    default: return "Missed";
  }
}

export default async function AdminCallsPage() {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/calls")) redirect("/admin");

  const [calls, names, threads] = await Promise.all([listRecentCalls(40), namesByPhone(), phonesWithThreads()]);

  const rows: CallRow[] = calls.map((c) => {
    const digits = last10(c.otherParty);
    const isSoftphone = /^client:/i.test(c.otherParty) || digits.length !== 10;
    const key = digits.length === 10 ? digits : "";
    return {
      sid: c.sid,
      direction: c.direction,
      name: isSoftphone ? null : names.get(key) ?? null,
      phone: isSoftphone ? null : fmtPhone(c.otherParty),
      digits: key || null,
      isSoftphone,
      time: c.startTime,
      durationSec: c.durationSec,
      answered: c.answered,
      statusLabel: statusLabel(c),
      recordingSid: c.recordingSid ?? null,
      recordingSec: c.recordingSec ?? null,
      threadExists: key ? threads.has(key) : false,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-14">
      <AdminPageHeader eyebrow="Menu" title="Calls" />
      <p className="mt-2 text-muted">
        Your call history on (352) 414-7270, newest first. Recorded calls play right here, straight from Twilio and
        only while you are signed in.
      </p>

      <div className="mt-8">
        {!twilioVoiceEnabled() ? (
          <p className="text-muted">Calling isn&apos;t configured yet.</p>
        ) : (
          <AdminCallsList calls={rows} />
        )}
      </div>
    </div>
  );
}
