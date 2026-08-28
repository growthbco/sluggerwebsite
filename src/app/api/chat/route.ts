import { NextResponse } from "next/server";
import { answerPublicChat, type ChatTurn } from "@/lib/design-assistant";

export const runtime = "nodejs";

// Public site chat: stateless - the widget sends the visible history each
// time. Hard caps keep abuse cheap; no PII is stored server-side.
//
// Order lookups: when the visitor's messages contain BOTH an order reference
// and an email, the server verifies the pair against the database and injects
// a VERIFIED status block (or a FAILED marker) into the model's context. The
// model never sees unverified order data, so it cannot leak it. On failure we
// never confirm whether the reference exists.
async function lookupOrder(reference: string, email: string): Promise<string> {
  const FAILED =
    "ORDER VERIFICATION FAILED: the reference + email pair did not match our records. Do NOT say whether the order exists. Ask them to double-check both (the reference is in every email from us), or text (352) 414-7270.";
  try {
    const { dbEnabled, getDb } = await import("@/db");
    if (!dbEnabled()) return FAILED;
    const { teamOrders, designRequests, customInvoices } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { trackingUrlFor } = await import("@/lib/tracking");
    const db = getDb();
    const ref = reference.toUpperCase();
    const mail = email.trim().toLowerCase();
    const emailMatches = (onFile: string | null | undefined) => (onFile ?? "").trim().toLowerCase() === mail;

    if (ref.startsWith("TO-")) {
      const [o] = await db.select().from(teamOrders).where(eq(teamOrders.reference, ref)).limit(1);
      if (!o || !emailMatches(o.contactEmail)) return FAILED;
      const lines = [
        `VERIFIED ORDER STATUS for ${ref} (email on file matches - you may share ALL of the following):`,
        `- Team: ${o.teamName}`,
        o.shippedAt
          ? `- SHIPPED on ${o.shippedAt.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric" })}${o.trackingNumber ? ` - tracking number ${o.trackingNumber}, track it at ${trackingUrlFor(o.trackingNumber)}` : ""}`
          : o.invoicePaidAt
            ? "- Paid in full - in production / preparing to ship. Customer tracking is emailed only when the final package ships to them; internal designer/factory tracking is not shared."
            : o.depositPaidAt
              ? "- Deposit received - order is IN PRODUCTION. The balance invoice comes before shipping."
              : "- Roster received - the invoice email is the next step. Check the inbox (and spam) for it.",
      ];
      return lines.join("\n");
    }
    if (ref.startsWith("DR-")) {
      const [d] = await db.select().from(designRequests).where(eq(designRequests.reference, ref)).limit(1);
      if (!d || !emailMatches(d.contactEmail)) return FAILED;
      const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
      const meanings: Record<string, string> = {
        pending_payment: "not submitted yet",
        submitted: "in the designer's queue",
        in_design: "being designed right now",
        proof_sent: "proof sent - waiting on their review/approval",
        changes_requested: "being revised per their change requests",
        approved: "approved - next step is the team order/roster",
        ordered: "approved with a team order placed",
        cancelled: "cancelled",
      };
      return [
        `VERIFIED DESIGN STATUS for ${ref} (email on file matches - you may share ALL of the following):`,
        `- Team: ${d.teamName}`,
        `- Status: ${meanings[d.status] ?? d.status}`,
        `- Their private status page (safe to share since they verified): ${SITE}/design/status/${d.statusToken}`,
      ].join("\n");
    }
    if (ref.startsWith("INV-")) {
      const [inv] = await db.select().from(customInvoices).where(eq(customInvoices.reference, ref)).limit(1);
      if (!inv || !emailMatches(inv.customerEmail)) return FAILED;
      return [
        `VERIFIED INVOICE STATUS for ${ref} (email on file matches - you may share):`,
        `- Total: $${(inv.totalCents / 100).toFixed(2)}`,
        inv.status === "paid" ? "- PAID - all set." : `- Not paid yet${inv.payUrl ? ` - payment link: ${inv.payUrl}` : ""}`,
      ].join("\n");
    }
    return FAILED;
  } catch (e) {
    console.error("chat order lookup failed:", e);
    return FAILED;
  }
}

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

  // Server-side verification: reference + email must appear in the visitor's
  // own messages (recent turns), then get checked against the DB.
  const userText = messages.filter((m) => m.role === "user").map((m) => m.text).join(" ");
  const refMatch = userText.match(/\b(TO|DR|INV)-[A-Z0-9]{6}\b/i);
  const emailMatch = userText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  let extraContext: string | undefined;
  if (refMatch && emailMatch) {
    extraContext = await lookupOrder(refMatch[0], emailMatch[0]);
  }

  const reply = await answerPublicChat(messages, extraContext);
  if (!reply) {
    return NextResponse.json({
      reply: "I'm having trouble right now - the fastest way to reach us is a text to (352) 414-7270, or email apparel@sluggerathletics.com.",
    });
  }
  return NextResponse.json({ reply });
}
