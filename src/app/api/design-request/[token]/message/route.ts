import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, getByStatusToken, addDesignMessage } from "@/lib/design-requests";
import { getByDesignRequestId, getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { assistDesignThread } from "@/lib/design-assistant";
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

  let body: { text?: string; name?: string; attachments?: string[] } = {};
  try {
    body = await req.json();
  } catch {}
  const text = (body.text ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  // Only accept our own Blob URLs, cap the count. A message can be just files.
  const attachments = (body.attachments ?? [])
    .filter((u): u is string => typeof u === "string" && /^https:\/\/[^ ]+\.public\.blob\.vercel-storage\.com\//.test(u))
    .slice(0, 10);
  if (!text && attachments.length === 0) {
    return NextResponse.json({ error: "Write a message or attach a file first." }, { status: 400 });
  }
  // Sender name personalizes designer-side messages only ("Gary · Slugger Athletics").
  const name = from === "designer" ? (body.name ?? "").trim().slice(0, 40) || undefined : undefined;

  try {
    let messages = await addDesignMessage(request.id, from, text, name, attachments);
    if (!messages) return NextResponse.json({ error: "Could not save" }, { status: 500 });

    // Notifications describe attachments even when there's no text.
    const attachNote = attachments.length ? `📎 ${attachments.length} attachment${attachments.length === 1 ? "" : "s"}` : "";
    const notifyText = [text, attachNote].filter(Boolean).join("\n") || attachNote;

    // Nudge the other side. Failures here shouldn't fail the send itself.
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const firstImage = attachments.find((u) => /\.(png|jpe?g|webp|gif)$/i.test(u));
    if (from === "designer") {
      await Promise.allSettled([
        emailDesignerMessage({
          to: request.contactEmail,
          teamName: request.teamName,
          reference: request.reference,
          text: notifyText,
          fromName: name,
          statusUrl: `${SITE}/design/status/${request.statusToken}`,
        }),
        postDesignThreadUpdate({
          threadId: request.discordThreadId ?? undefined,
          title: `💬 ${name ? `${name} messaged the client` : "Question sent to client"} - ${request.teamName} (${request.reference})`,
          description: notifyText.slice(0, 2000),
          imageUrl: firstImage,
          username: "Slugger Design Requests",
        }),
      ]);
    } else {
      await postDesignThreadUpdate({
        threadId: request.discordThreadId ?? undefined,
        title: `💬 Client replied - ${request.teamName} (${request.reference})`,
        description: notifyText.slice(0, 2000),
        imageUrl: firstImage,
        username: "Slugger Design Requests",
      });

      // AI assistant: answer routine questions instantly; escalate anything
      // sensitive (discounts, refunds, complaints) to staff instead of
      // replying. Best-effort - a failure here never fails the client's send.
      if (text) {
        try {
          const order = await getByDesignRequestId(request.id);
          const roster = order ? await getRoster(order.id) : [];
          const result = await assistDesignThread({
            design: {
              reference: request.reference,
              teamName: request.teamName,
              status: request.status,
              revisionsUsed: request.revisionsUsed,
              proofCount: request.proofImages?.length ?? 0,
              rush: request.rush,
              neededBy: request.neededBy,
            },
            order: order
              ? {
                  reference: order.reference,
                  status: order.status,
                  items: order.items ?? ["jersey"],
                  rosterCount: roster.length,
                  estimateCents: roster.length ? computeTeamOrderQuote(order, roster).totalCents : null,
                  quotedTotalCents: order.quotedTotalCents,
                  depositPaidAt: order.depositPaidAt,
                  invoicePaidAt: order.invoicePaidAt,
                  shippedAt: order.shippedAt,
                }
              : null,
            messages,
          });
          if (result?.action === "answer" && result.reply) {
            const updated = await addDesignMessage(request.id, "designer", result.reply, "AI Assistant");
            if (updated) messages = updated;
            // Log the exchange to Discord so staff can correct a bad answer.
            // flagStaff (discount asks): the AI sent the holding reply per
            // policy, but the real number needs a human - ping for follow-up.
            await postDesignThreadUpdate({
              threadId: request.discordThreadId ?? undefined,
              title: result.flagStaff
                ? `🤖💰 AI answered a discount ask - follow up personally - ${request.teamName} (${request.reference})`
                : `🤖 AI Assistant answered - ${request.teamName} (${request.reference})`,
              description: `**Q:** ${text.slice(0, 600)}\n**A:** ${result.reply.slice(0, 1200)}`,
              username: "Slugger Design Requests",
              mention: Boolean(result.flagStaff),
            });
          } else if (result?.action === "escalate") {
            await postDesignThreadUpdate({
              threadId: request.discordThreadId ?? undefined,
              title: `🙋 Needs a human reply - ${request.teamName} (${request.reference})`,
              description: `${result.reason ? `${result.reason}\n` : ""}**Client:** ${text.slice(0, 1000)}`,
              username: "Slugger Design Requests",
              mention: true,
            });
          }
        } catch (e) {
          console.error("design assistant hook failed:", e);
        }
      }
    }

    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    console.error("addDesignMessage failed:", e);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
