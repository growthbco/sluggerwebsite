// AI for the design-request message thread, two modes sharing one grounding:
//
// 1. assistDesignThread - auto-replies to CLIENT messages (answer routine
//    questions, escalate sensitive ones, stay silent otherwise).
// 2. suggestStaffReply - drafts a reply for a STAFF member to edit and send
//    from /design/manage. Drafts may touch any topic (a human reviews), but
//    never invent discounts, prices, or promises not in the facts.
//
// Same Gemini setup as the roster importer and print-file check.

import { PRICE_LIST } from "@/lib/pricing";
import { FAQS } from "@/lib/faqs";
import { MAX_REVISIONS, type DesignMessage } from "@/lib/design-requests";
import { itemLabel } from "@/lib/order-items";

const MODEL = process.env.GEMINI_ASSISTANT_MODEL || "gemini-flash-latest";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type AssistantResult = {
  action: "answer" | "escalate" | "none";
  reply?: string;
  reason?: string;
};

export type DesignContext = {
  reference: string;
  teamName: string;
  status: string;
  revisionsUsed: number | null;
  proofCount: number;
  rush: boolean | null;
  neededBy: Date | null;
};

export type OrderContext = {
  reference: string;
  status: string;
  items: string[];
  rosterCount: number;
  estimateCents: number | null;
  quotedTotalCents: number | null;
  depositPaidAt: Date | null;
  invoicePaidAt: Date | null;
  shippedAt: Date | null;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function statusMeaning(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "the design fee checkout hasn't been completed yet",
    submitted: "the request is in and the designer will start soon",
    in_design: "the designer is working on the mockup now",
    proof_sent: "a proof has been sent and we're waiting on the client to approve it or request changes",
    changes_requested: "the client asked for changes and the designer is revising",
    approved: "the design is approved and the next step is the team order / roster",
    ordered: "a team order has been placed against this design",
    cancelled: "this request was cancelled",
  };
  return map[status] ?? status;
}

/** The grounded knowledge both modes share: business facts, price list,
 *  FAQs, this project's live state, and the recent conversation. */
function buildGrounding(design: DesignContext, order: OrderContext | null, messages: DesignMessage[]): string {
  const projectLines = [
    `Reference: ${design.reference}`,
    `Team: ${design.teamName}`,
    `Design status: ${design.status} (${statusMeaning(design.status)})`,
    `Revision rounds used: ${design.revisionsUsed ?? 0} of ${MAX_REVISIONS} included`,
    `Proof images sent so far: ${design.proofCount}`,
    design.neededBy
      ? `Client needs it by: ${design.neededBy.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${design.rush ? " (rush)" : ""}`
      : null,
  ].filter(Boolean) as string[];

  if (order) {
    projectLines.push(
      `Linked team order ${order.reference}: ${order.items.map(itemLabel).join(" + ") || "jersey"}, ${order.rosterCount} player${order.rosterCount === 1 ? "" : "s"} on the roster`,
      order.quotedTotalCents
        ? `Invoiced total: ${money(order.quotedTotalCents)} plus tax`
        : order.estimateCents
          ? `Estimated total: ${money(order.estimateCents)} plus tax (final invoice comes from Slugger)`
          : "No quote yet (roster not priced)",
      order.shippedAt
        ? "The order HAS SHIPPED - tracking was emailed to the contact on file"
        : order.invoicePaidAt
          ? "Paid in full - in production / preparing to ship"
          : order.depositPaidAt
            ? "50% deposit paid - production has started; the balance is due before shipping"
            : "Not paid yet - a 50% deposit starts production",
    );
  } else {
    projectLines.push("No team order linked yet - after the design is approved, the roster/order comes next.");
  }

  const history = messages
    .slice(-12)
    .map((m) => `${m.from === "client" ? "CLIENT" : `STAFF${m.name ? ` (${m.name})` : ""}`}: ${(m.text || "(attachment)").slice(0, 500)}`)
    .join("\n");

  const priceList = PRICE_LIST.map(
    (g) => `${g.group}: ` + g.rows.map((r) => `${r.item} ${money(r.priceCents)}`).join(", "),
  ).join("\n");

  return [
    "FACTS YOU MAY USE (the ONLY facts you may state):",
    "- Slugger Athletics makes custom team uniforms and embroidered hats in Ocala, Florida.",
    "- Contact: text (352) 660-1232, email apparel@sluggerathletics.com.",
    "- EVERYTHING is fully custom and made to order. Features like quarter-zips, collar styles, sleeve length, fonts, a cursive name instead of a number, and color tweaks are all possible - when a client asks IF something can be done, the honest answer is usually yes, it is their call, so ask which way they want it instead of assuming. If a custom feature is not on the price list, say the team will confirm any price difference.",
    "- Payment flow: Slugger emails an invoice; a 50% deposit starts production and the balance (plus shipping) is due before the order ships. 7% Florida sales tax applies to goods.",
    "- Production: most orders ship 2-3 weeks after design approval and deposit; rush is about a week. Hats are embroidered in-house and small hat orders are often ready in days.",
    `- Revisions: ${MAX_REVISIONS} revision rounds are included with a design.`,
    "",
    "PRICE LIST (per piece, plus tax, no minimums, design included):",
    priceList,
    "",
    "FAQS:",
    FAQS.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n"),
    "",
    "THIS PROJECT RIGHT NOW:",
    projectLines.join("\n"),
    "",
    "CONVERSATION (oldest first):",
    history,
  ].join("\n");
}

async function callGemini(prompt: string, schema: object): Promise<Record<string, string> | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error("design assistant failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
  } catch (e) {
    console.error("design assistant error:", e);
    return null;
  }
}

/** Decide how (or whether) to auto-respond to the newest client message.
 *  Returns null when the assistant is unavailable (no API key, API error) -
 *  callers must treat that as "do nothing", never as an answer. */
export async function assistDesignThread(input: {
  design: DesignContext;
  order: OrderContext | null;
  messages: DesignMessage[];
}): Promise<AssistantResult | null> {
  const prompt = [
    "You are the AI assistant on Slugger Athletics' private design-request message thread. The CLIENT just sent the last message below; decide how to respond.",
    "",
    buildGrounding(input.design, input.order, input.messages),
    "",
    "Choose exactly one action:",
    '- "answer": ONLY if the client asked something you can answer completely and confidently from the facts above (order status, what happens next, pricing from the list, turnaround, sizing, revisions, how approval works, whether a custom feature is possible). Write a short, warm, plain-text reply (2-5 sentences, no markdown, no em dashes - use hyphens). Do not promise anything beyond the stated facts. Do not sign a name.',
    '- "escalate": if the message involves a discount, price negotiation, refund, cancellation, complaint, changing an already-approved design, payment trouble, a callback request, or anything the facts do not fully cover. Also escalate if you are unsure. Do NOT write a client reply; give a one-line reason instead.',
    '- "none": if no reply is needed (a thank-you, an acknowledgment, or the client is clearly mid-conversation with a specific staff member - e.g. staff asked them a question and this is their answer). Never interrupt an ongoing negotiation.',
    "",
    "Reply in the language the client wrote in - if they wrote in Spanish, answer in natural Spanish (keep product names and dollar amounts as-is). Same for any other language.",
    "Never contradict anything a staff member said earlier in the conversation.",
    'Return ONLY JSON: { "action": "answer" | "escalate" | "none", "reply": string, "reason": string }',
  ].join("\n");

  const out = (await callGemini(prompt, {
    type: "OBJECT",
    properties: {
      action: { type: "STRING", enum: ["answer", "escalate", "none"] },
      reply: { type: "STRING" },
      reason: { type: "STRING" },
    },
    required: ["action"],
  })) as AssistantResult | null;

  if (!out) return null;
  if (out.action !== "answer" && out.action !== "escalate" && out.action !== "none") return null;
  if (out.action === "answer" && !(out.reply ?? "").trim()) return null;
  // Belt and suspenders: the reply is customer-facing, keep it bounded.
  if (out.reply) out.reply = out.reply.trim().slice(0, 1200);
  return out;
}

/** Draft a reply for a staff member to review, edit, and send. Unlike the
 *  auto-assistant this may address any topic - a human approves it - but it
 *  still never invents numbers or commitments: where a business decision is
 *  needed it leaves an explicit [YOUR CALL: ...] placeholder. */
export async function suggestStaffReply(input: {
  design: DesignContext;
  order: OrderContext | null;
  messages: DesignMessage[];
  staffName?: string;
}): Promise<string | null> {
  const prompt = [
    `You are drafting a message for ${input.staffName || "a staff member"} at Slugger Athletics to send to the client on their design-request thread. The draft goes into the staff member's message box for them to edit before sending - it is a suggestion, not an auto-reply.`,
    "",
    buildGrounding(input.design, input.order, input.messages),
    "",
    "Draft the most helpful next message from staff to the client:",
    "- Usually that means answering the client's most recent unanswered question(s); if everything is answered, a short, useful next-step nudge.",
    "- Everything Slugger makes is custom: when the client asks whether something can be done (a quarter-zip, cursive name instead of a number, etc.), the answer is that it is their choice - confirm it is doable and ask which way they want it.",
    "- You may address sensitive topics (discount asks, complaints) since a human reviews this, but NEVER invent a specific discount, price, or date that is not in the facts. Where a business decision is needed, insert a placeholder like [YOUR CALL: discount amount] so the staff member fills it in.",
    "- Match the tone of earlier staff messages: friendly, brief, plain text. 2-6 sentences. No markdown, no em dashes - use hyphens. Do not sign a name.",
    "- Write in the language the client writes in.",
    'Return ONLY JSON: { "draft": string }',
  ].join("\n");

  const out = await callGemini(prompt, {
    type: "OBJECT",
    properties: { draft: { type: "STRING" } },
    required: ["draft"],
  });
  const draft = (out?.draft ?? "").trim();
  return draft ? draft.slice(0, 1500) : null;
}
