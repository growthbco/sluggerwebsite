import { NextResponse } from "next/server";
import { postContactToDiscord } from "@/lib/discord";
import { emailContactSubmission } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    name?: string;
    email?: string;
    phone?: string;
    subject?: string;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const message = body.message?.trim();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const payload = {
    name,
    email,
    phone: body.phone?.trim(),
    subject: body.subject?.trim(),
    message,
  };

  // Email to apparel@sluggerathletics.com is the primary delivery; Discord is
  // an optional secondary notification. Run both; don't fail the user if either
  // isn't configured yet.
  const [emailed, posted] = await Promise.all([
    emailContactSubmission(payload),
    postContactToDiscord(payload),
  ]);

  return NextResponse.json({ ok: true, emailed, notified: posted });
}
