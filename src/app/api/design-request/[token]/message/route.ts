import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, getByStatusToken, addDesignMessage } from "@/lib/design-requests";
import { emailDesignerMessage } from "@/lib/email";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 2000;

// The token doubles as auth AND identity: the private manage link belongs to
// the designer, the status link to the client.
async function resolve(token: string) {
  const asDesigner = await getByManageToken(token);
  if (asDesigner) return { request: asDesigner, from: "designer" as const };
  const asClient = await getByStatusToken(token);
  if (asClient) return { request: asClient, from: "client" as const };
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const resolved = await resolve(token);
  if (!resolved) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  return NextResponse.json({ messages: resolved.request.messages ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const resolved = await resolve(token);
  if (!resolved) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const { request, from } = resolved;

  let body: { text?: string; name?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const text = (body.text ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  // Sender name personalizes designer-side messages only ("Gary · Slugger Athletics").
  const name = from === "designer" ? (body.name ?? "").trim().slice(0, 40) || undefined : undefined;

  try {
    const messages = await addDesignMessage(request.id, from, text, name);
    if (!messages) return NextResponse.json({ error: "Could not save" }, { status: 500 });

    // Nudge the other side. Failures here shouldn't fail the send itself.
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    if (from === "designer") {
      await Promise.allSettled([
        emailDesignerMessage({
          to: request.contactEmail,
          teamName: request.teamName,
          reference: request.reference,
          text,
          fromName: name,
          statusUrl: `${SITE}/design/status/${request.statusToken}`,
        }),
        postDesignThreadUpdate({
          threadId: request.discordThreadId ?? undefined,
          title: `💬 ${name ? `${name} messaged the client` : "Question sent to client"} — ${request.teamName} (${request.reference})`,
          description: text.slice(0, 2000),
          username: "Slugger Design Requests",
        }),
      ]);
    } else {
      await postDesignThreadUpdate({
        threadId: request.discordThreadId ?? undefined,
        title: `💬 Client replied — ${request.teamName} (${request.reference})`,
        description: text.slice(0, 2000),
        username: "Slugger Design Requests",
      });
    }

    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    console.error("addDesignMessage failed:", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
