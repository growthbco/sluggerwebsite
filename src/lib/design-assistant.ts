// AI assistant for the design-request message thread. When a client sends a
// message, it either answers instantly (status, pricing, process, sizing -
// anything covered by the FAQs, price list, or this project's own data),
// stays silent (acknowledgments, mid-conversation replies meant for a human),
// or escalates to staff (discounts, refunds, complaints, anything uncertain).
// It NEVER negotiates pricing and never invents facts. Same Gemini setup as
// the roster importer and print-file check.

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

type OrderContext = {
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

function priceListText(): string {
  return PRICE_LIST.map(
    (g) => `${g.group}: ` + g.rows.map((r) => `${r.item} ${money(r.priceCents)}`).join(", "),
  ).join("\n");
}

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

/** Decide how (or whether) to respond to the newest client message.
 *  Returns null when the assistant is unavailable (no API key, API error) -
 *  callers must treat that as "do nothing", never as an answer. */
export async function assistDesignThread(input: {
  design: {
    reference: string;
    teamName: string;
    status: string;
    revisionsUsed: number | null;
    proofCount: number;
    rush: boolean | null;
    neededBy: Date | null;
  };
  order: OrderContext | null;
  messages: DesignMessage[];
}): Promise<AssistantResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const { design, order } = input;
  const projectLines = [
    `Reference: ${design.reference}`,
    `Team: ${design.teamName}`,
    `Design status: ${design.status} (${statusMeaning(design.status)})`,
    `Revision rounds used: ${design.revisionsUsed ?? 0} of ${MAX_REVISIONS} included`,
    `Proof images sent so far: ${design.proofCount}`,
    design.neededBy
      ? `Client needs it by: ${design.neededBy.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${design.rush ? " (rush)" : ""}`
      : null,
  ].filter(Boolean);

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

  const history = input.messages
    .slice(-12)
    .map((m) => `${m.from === "client" ? "CLIENT" : `STAFF${m.name ? ` (${m.name})` : ""}`}: ${(m.text || "(attachment)").slice(0, 500)}`)
    .join("\n");

  const prompt = [
    "You are the AI assistant on Slugger Athletics' private design-request message thread. Slugger Athletics makes custom team uniforms and embroidered hats in Ocala, Florida. The CLIENT just sent the last message below; decide how to respond.",
    "",
    "FACTS YOU MAY USE (the ONLY facts you may state):",
    "- Contact: text (352) 660-1232, email apparel@sluggerathletics.com.",
    "- Payment flow: Slugger emails an invoice; a 50% deposit starts production and the balance is due before shipping. 7% Florida sales tax applies to goods.",
    "- Production: most orders ship 2-3 weeks after design approval and deposit; rush is about a week. Hats are embroidered in-house and small hat orders are often ready in days.",
    `- Revisions: ${MAX_REVISIONS} revision rounds are included with a design.`,
    "",
    "PRICE LIST (per piece, plus tax, no minimums, design included):",
    priceListText(),
    "",
    "FAQS:",
    FAQS.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n"),
    "",
    "THIS PROJECT RIGHT NOW:",
    projectLines.join("\n"),
    "",
    "CONVERSATION (oldest first):",
    history,
    "",
    "Choose exactly one action:",
    '- "answer": ONLY if the client asked something you can answer completely and confidently from the facts above (order status, what happens next, pricing from the list, turnaround, sizing, revisions, how approval works). Write a short, warm, plain-text reply (2-5 sentences, no markdown, no em dashes - use hyphens). Do not promise anything beyond the stated facts. Do not sign a name.',
    '- "escalate": if the message involves a discount, price negotiation, refund, cancellation, complaint, changing an already-approved design, payment trouble, a callback request, or anything the facts do not fully cover. Also escalate if you are unsure. Do NOT write a client reply; give a one-line reason instead.',
    '- "none": if no reply is needed (a thank-you, an acknowledgment, or the client is clearly mid-conversation with a specific staff member - e.g. staff asked them a question and this is their answer). Never interrupt an ongoing negotiation.',
    "",
    "Never contradict anything a staff member said earlier in the conversation.",
    'Return ONLY JSON: { "action": "answer" | "escalate" | "none", "reply": string, "reason": string }',
  ].join("\n");

  try {
    const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              action: { type: "STRING", enum: ["answer", "escalate", "none"] },
              reply: { type: "STRING" },
              reason: { type: "STRING" },
            },
            required: ["action"],
          },
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error("design assistant failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const out = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as AssistantResult;
    if (out.action !== "answer" && out.action !== "escalate" && out.action !== "none") return null;
    if (out.action === "answer" && !(out.reply ?? "").trim()) return null;
    // Belt and suspenders: the reply is customer-facing, keep it bounded.
    if (out.reply) out.reply = out.reply.trim().slice(0, 1200);
    return out;
  } catch (e) {
    console.error("design assistant error:", e);
    return null;
  }
}
