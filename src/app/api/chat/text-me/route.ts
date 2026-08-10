import { NextResponse } from "next/server";
import { dbEnabled, getDb } from "@/db";
import { smsMessages, smsContacts } from "@/db/schema";
import { sendSms, toE164, smsEnabled } from "@/lib/sms";
import { postContactToDiscord } from "@/lib/discord";

export const runtime = "nodejs";

// Website chat -> SMS handoff. The visitor actively checks the consent box,
// leaves name + phone, and we move the conversation to text: they get a
// greeting SMS from (352) 414-7270 and the thread lands in /admin/texts where
// staff reply like any other conversation.
export async function POST(req: Request) {
  if (!dbEnabled() || !smsEnabled()) {
    return NextResponse.json({ error: "Texting isn't available right now - call or email us instead." }, { status: 503 });
  }

  let body: { name?: string; phone?: string; question?: string; consent?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  const name = (body.name ?? "").trim().slice(0, 60);
  const phone = toE164(body.phone ?? "");
  const question = (body.question ?? "").trim().slice(0, 500);
  if (body.consent !== true) return NextResponse.json({ error: "Please check the text-message consent box first." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit US phone number." }, { status: 400 });

  const db = getDb();
  try {
    // Remember who this number is so the Texts inbox shows a name.
    await db
      .insert(smsContacts)
      .values({ phone, name })
      .onConflictDoUpdate({ target: smsContacts.phone, set: { name } });

    const greeting = `Hey ${name.split(" ")[0]}, it's Slugger Athletics! Got your message from the website - we'll text you right back here. Save this number! Reply STOP to opt out.`;
    const sent = await sendSms(phone, greeting);
    if (!sent.ok) return NextResponse.json({ error: "Couldn't reach that number - double-check it and try again." }, { status: 502 });

    // Book-keep both sides in the inbox thread: their website question (so
    // staff have context without hunting) and our greeting.
    if (question) {
      await db.insert(smsMessages).values({ phone, direction: "in", channel: "sms", body: `[from website chat] ${question}`, mediaCount: 0 });
    }
    await db.insert(smsMessages).values({ phone, direction: "out", channel: "sms", body: greeting, mediaCount: 0, staff: "Chat widget", twilioSid: sent.sid });

    await postContactToDiscord({
      name,
      email: "-",
      phone,
      subject: "💬→📱 Website chat wants texting",
      message: `${question || "(no question typed)"}\n\nReply from the Texts inbox: ${process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com"}/admin/texts`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("chat text-me failed:", e);
    return NextResponse.json({ error: "Something went wrong - try again." }, { status: 500 });
  }
}
