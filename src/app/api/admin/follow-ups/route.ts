import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { smsContacts, smsMessages } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { toE164 } from "@/lib/sms";

export const runtime = "nodejs";

const OUTCOMES = {
  no_answer: { label: "No answer", status: "scheduled", needsNext: true },
  voicemail: { label: "Left voicemail", status: "scheduled", needsNext: true },
  spoke_follow_up: { label: "Spoke — follow up", status: "scheduled", needsNext: true },
  sent_link: { label: "Sent link", status: "scheduled", needsNext: true },
  needs_gary: { label: "Needs Gary", status: "needs_gary", needsNext: false },
  completed: { label: "Done", status: "closed", needsNext: false },
  not_interested: { label: "Not interested", status: "closed", needsNext: false },
  do_not_call: { label: "Do not call", status: "do_not_call", needsNext: false },
  archive: { label: "Archived", status: "archived", needsNext: false },
  restore: { label: "Restored to call queue", status: "active", needsNext: false },
  reopen: { label: "Reopened", status: "active", needsNext: false },
} as const;

type Outcome = keyof typeof OUTCOMES | "note";

function fallbackName(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export async function POST(req: Request) {
  const gate = await requireApiRole("follow_up");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { phone?: string; name?: string; outcome?: string; note?: string; nextFollowUpAt?: string | null; references?: string[] } = {};
  try { body = await req.json(); } catch {}
  const phone = toE164(body.phone);
  const outcome = body.outcome as Outcome;
  const config = outcome === "note" ? null : OUTCOMES[outcome];
  const name = (body.name ?? "").trim().slice(0, 80);
  const note = (body.note ?? "").trim().slice(0, 1200);
  const references = (body.references ?? [])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 10);

  if (!phone) return NextResponse.json({ error: "Valid phone number required." }, { status: 400 });
  if (outcome !== "note" && !config) return NextResponse.json({ error: "Choose a valid outcome." }, { status: 400 });
  if (outcome === "note") {
    if (note.length < 2) return NextResponse.json({ error: "Write a short note before saving." }, { status: 400 });
    const now = new Date();
    const savedName = name || fallbackName(phone);
    const refLine = references.length ? ` · ${references.join(", ")}` : "";
    const messageBody = `VA note${refLine}\n${note}`;
    let savedNote: { id: string; body: string; staff: string | null; createdAt: string } | null = null;
    try {
      const db = getDb();
      const [, insertedNotes] = await db.batch([
        db
          .insert(smsContacts)
          .values({ phone, name: savedName })
          .onConflictDoUpdate({ target: smsContacts.phone, set: { name: savedName } }),
        db
          .insert(smsMessages)
          .values({
            phone,
            direction: "note",
            channel: "sms",
            body: messageBody,
            staff: gate.session.name,
            createdAt: now,
          })
          .returning({ id: smsMessages.id }),
      ]);
      savedNote = { id: insertedNotes[0].id, body: messageBody, staff: gate.session.name, createdAt: now.toISOString() };
    } catch (error) {
      console.error("[follow-ups] could not save note", { phoneLast4: phone.slice(-4), error });
      return NextResponse.json({ error: "Could not save note. Please try again." }, { status: 500 });
    }
    console.info("[follow-ups] note saved", { phoneLast4: phone.slice(-4), staff: gate.session.name, references: references.length });
    return NextResponse.json({
      ok: true,
      note: savedNote,
    });
  }
  if (!config) return NextResponse.json({ error: "Choose a valid outcome." }, { status: 400 });
  if (outcome === "reopen" && gate.session.role === "follow_up") {
    return NextResponse.json({ error: "Only staff can reopen a do-not-call contact." }, { status: 403 });
  }
  if (["spoke_follow_up", "needs_gary", "completed", "not_interested"].includes(outcome) && note.length < 2) {
    return NextResponse.json({ error: "Add a short note about what they said." }, { status: 400 });
  }

  let nextFollowUpAt: Date | null = null;
  if (body.nextFollowUpAt) {
    nextFollowUpAt = new Date(body.nextFollowUpAt);
    if (Number.isNaN(nextFollowUpAt.getTime())) return NextResponse.json({ error: "Choose a valid next-call time." }, { status: 400 });
  }
  if (config.needsNext && (!nextFollowUpAt || nextFollowUpAt.getTime() <= Date.now())) {
    return NextResponse.json({ error: "Choose a future date for the next call." }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select({ doNotCallAt: smsContacts.doNotCallAt, followUpStatus: smsContacts.followUpStatus })
    .from(smsContacts)
    .where(eq(smsContacts.phone, phone))
    .limit(1);
  if (existing?.doNotCallAt && outcome !== "reopen") {
    return NextResponse.json({ error: "This contact is on the do-not-call list." }, { status: 409 });
  }
  if (outcome === "restore" && existing?.followUpStatus !== "archived") {
    return NextResponse.json({ error: "Only archived contacts can be restored." }, { status: 409 });
  }

  const now = new Date();
  const state = {
    name: name || fallbackName(phone),
    followUpStatus: config.status,
    nextFollowUpAt: config.needsNext ? nextFollowUpAt : null,
    followUpUpdatedAt: now,
    followUpUpdatedBy: gate.session.name,
    ...(outcome === "do_not_call" ? { doNotCallAt: now } : outcome === "reopen" ? { doNotCallAt: null } : {}),
  };
  const nextLine = nextFollowUpAt
    ? `\nNext call: ${nextFollowUpAt.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET`
    : "";
  const refLine = references.length ? ` · ${references.join(", ")}` : "";
  const messageBody = `Follow-up · ${config.label}${refLine}${note ? `\n${note}` : ""}${nextLine}`;

  try {
    await db.batch([
      db
        .insert(smsContacts)
        .values({ phone, ...state })
        .onConflictDoUpdate({ target: smsContacts.phone, set: state }),
      db.insert(smsMessages).values({
        phone,
        direction: "note",
        channel: "sms",
        body: messageBody,
        staff: gate.session.name,
        createdAt: now,
      }),
    ]);
  } catch (error) {
    console.error("[follow-ups] could not save outcome", { outcome, phoneLast4: phone.slice(-4), error });
    return NextResponse.json({ error: "Could not save follow-up. Please try again." }, { status: 500 });
  }

  const category = config.status === "archived"
    ? "archived"
    : config.status === "closed" || config.status === "do_not_call"
      ? "closed"
      : config.status === "needs_gary"
        ? "needs_gary"
        : config.status === "scheduled"
          ? "scheduled"
          : "due";
  console.info("[follow-ups] outcome saved", { outcome, category, phoneLast4: phone.slice(-4), staff: gate.session.name });

  return NextResponse.json({ ok: true, category });
}
