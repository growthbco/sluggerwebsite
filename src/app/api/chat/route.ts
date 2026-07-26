import { NextResponse } from "next/server";
import { answerPublicChat, type ChatTurn } from "@/lib/design-assistant";

export const runtime = "nodejs";

// Public site chat: stateless - the widget sends the visible history each
// time. Hard caps keep abuse cheap; no PII is stored server-side.
export async function POST(req: Request) {
  let body: { messages?: ChatTurn[] } = {};
  try { body = await req.json(); } catch {}
  const messages = (body.messages ?? [])
    .filter((m): m is ChatTurn => (m?.role === "user" || m?.role === "bot") && typeof m?.text === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 600) }));
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || !last.text.trim()) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }

  const reply = await answerPublicChat(messages);
  if (!reply) {
    return NextResponse.json({
      reply: "I'm having trouble right now - the fastest way to reach us is a text to (352) 660-1232, or email apparel@sluggerathletics.com.",
    });
  }
  return NextResponse.json({ reply });
}
