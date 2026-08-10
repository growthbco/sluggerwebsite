// AI for the design-request message thread, two modes sharing one grounding:
//
// 1. assistDesignThread - auto-replies to CLIENT messages (answer routine
//    questions, escalate sensitive ones, stay silent otherwise).
// 2. suggestStaffReply - drafts a reply for a STAFF member to edit and send
//    from /design/manage. Drafts may touch any topic (a human reviews), but
//    never invent discounts, prices, or promises not in the facts.
//
// Text generation runs on Claude (the owner prefers its wording) with the
// original Gemini setup kept as an automatic fallback; image work stays on
// Gemini elsewhere in the codebase.

import Anthropic from "@anthropic-ai/sdk";
import { PRICE_LIST, BUNDLES, BUNDLE_UPGRADE_NOTE } from "@/lib/pricing";
import { FAQS } from "@/lib/faqs";
import { MAX_REVISIONS, type DesignMessage } from "@/lib/design-requests";
import { itemLabel } from "@/lib/order-items";

const MODEL = process.env.GEMINI_ASSISTANT_MODEL || "gemini-flash-latest";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type AssistantResult = {
  action: "answer" | "escalate" | "none";
  reply?: string;
  reason?: string;
  /** Answer was sent but staff should personally follow up (discount asks). */
  flagStaff?: boolean;
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

/** Facts staff have taught the assistant from the admin page. Fail-open:
 *  a DB hiccup means the bot just runs without the extra notes. */
async function loadTaughtFacts(): Promise<string[]> {
  try {
    const { dbEnabled, getDb } = await import("@/db");
    if (!dbEnabled()) return [];
    const { assistantFacts } = await import("@/db/schema");
    const rows = await getDb().select().from(assistantFacts).orderBy(assistantFacts.createdAt);
    return rows.map((r) => r.fact);
  } catch (e) {
    console.error("loadTaughtFacts failed:", e);
    return [];
  }
}

/** The grounded knowledge both modes share: business facts, price list,
 *  FAQs, this project's live state, and the recent conversation. */
function buildGrounding(design: DesignContext, order: OrderContext | null, messages: DesignMessage[], taughtFacts: string[] = []): string {
  const projectLines = [
    `Reference: ${design.reference}`,
    `Team: ${design.teamName}`,
    `Design status: ${design.status} (${statusMeaning(design.status)})`,
    `Revision rounds used: ${design.revisionsUsed ?? 0} of ${MAX_REVISIONS} included`,
    `Proof images sent so far: ${design.proofCount}`,
    design.neededBy
      ? `Client needs it by: ${design.neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" })}${design.rush ? " (rush)" : ""}`
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
    "- Contact: text (352) 414-7270, email apparel@sluggerathletics.com.",
    "- EVERYTHING is fully custom and made to order. Features like quarter-zips, collar styles, sleeve length, fonts, a cursive name instead of a number, and color tweaks are all possible - when a client asks IF something can be done, the honest answer is usually yes, it is their call, so ask which way they want it instead of assuming. If a custom feature is not on the price list, say the team will confirm any price difference.",
    "- Discounts: possible, and they depend on the TOTAL number of pieces in the order - more pieces means more room to work. NEVER name a specific discount, percentage, or lower price. The right response: say we can work with them since it depends on piece count, ask what total or per-player number they were hoping to be at, and offer a quick phone call to land on a number - text (352) 414-7270.",
    "- Payment flow: Slugger emails an invoice; a 50% deposit starts production and the balance (plus shipping) is due before the order ships. 7% Florida sales tax applies to goods.",
    "- Production: most orders ship 2-3 weeks after design approval and deposit; rush is about a week. Hats are embroidered in-house and small hat orders are often ready in days.",
    "- Rush orders: a flat $100 rush order fee (priority production, ships direct to the client). Staff must first confirm the deadline is doable - if a client asks whether we can hit a date on a rush order, never guarantee it yourself; say the team is confirming and will follow up.",
    `- Revisions: ${MAX_REVISIONS} revision rounds are included with a design - but ONLY BEFORE the client approves it. Once the design is approved (status approved/ordered), and especially once any payment has been made, production starts immediately and the design is LOCKED: no design changes are possible. Never promise a design change or mention revision rounds after approval.`,
    "- Standard branding on final jerseys: every finished production jersey includes a size barcode tag on the lower-right front, the SA (Slugger Athletics) logo at the top of the back, and a neck label that reads Slugger Athletics. These may not show on every mockup/proof but ARE on the final product. If a customer asks about the barcode/tag/neck label, confirm this is standard on all finished jerseys.",
    "",
    ...(taughtFacts.length
      ? [
          "",
          "SHOP-TAUGHT NOTES (added by Slugger staff - authoritative, and they OVERRIDE the general facts above if they conflict):",
          taughtFacts.map((f) => `- ${f}`).join("\n"),
        ]
      : []),
    "",
    "PRICE LIST (per piece, plus tax, design included; ALL custom orders - INCLUDING embroidered hats - have a 6-piece minimum per design. HAT FEES: the mockup is FREE; creating the stitch-ready embroidery file from a logo carries a one-time digitizing fee - customers who bring their own embroidery file (DST/EMB) skip that fee entirely. Hats are embroidered in-house: when the blank hats are in stock they are usually ready in a COUPLE OF DAYS; if the blanks must be ordered in, about a WEEK or so. The 6-hat minimum always applies):",
    priceList,
    "",
    "2026 BUNDLES (per player, plus tax - suggest the matching bundle when someone is pricing multiple pieces, especially Home & Away when they only mention jerseys):",
    BUNDLES.map((b) => `${b.name}: ${b.includes.join(" + ")} = $${(b.priceCents / 100).toFixed(0)} (vs $${(b.compareAtCents / 100).toFixed(0)} separately)`).join("\n"),
    BUNDLE_UPGRADE_NOTE,
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

// Gemini responseSchema uses uppercase type names; Claude structured outputs
// take standard JSON Schema. Convert so both providers share one schema.
function toJsonSchema(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...s };
  if (typeof out.type === "string") out.type = (out.type as string).toLowerCase();
  if (out.properties && typeof out.properties === "object") {
    out.properties = Object.fromEntries(
      Object.entries(out.properties as Record<string, Record<string, unknown>>).map(([k, v]) => [k, toJsonSchema(v)]),
    );
    out.additionalProperties = false;
  }
  if (out.items && typeof out.items === "object") out.items = toJsonSchema(out.items as Record<string, unknown>);
  return out;
}

let anthropic: Anthropic | null = null;

async function callClaude(prompt: string, schema: object): Promise<Record<string, string> | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    anthropic ??= new Anthropic({ timeout: 25000, maxRetries: 1 });
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      output_config: { format: { type: "json_schema", schema: toJsonSchema(schema as Record<string, unknown>) } },
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error("claude assistant error (falling back to gemini):", e);
    return null;
  }
}

/** Grounded JSON generation: Claude first, Gemini as fallback. Shared by the
 *  design-thread assistant, staff reply drafts, public chat, and invoice AI. */
export async function generateJson(prompt: string, schema: object): Promise<Record<string, string> | null> {
  return (await callClaude(prompt, schema)) ?? (await callGemini(prompt, schema));
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

/** Shared human-tone rules for every client-facing reply (public chat, the
 *  design-thread auto-answer, and the staff draft), so they all read like a
 *  real person - not a repetitive, exclamation-happy bot. */
const TONE_RULES = [
  "- Do NOT repeat yourself: never restate a price, the hat minimum, the digitizing fee, the mockup-is-free policy, or any detail you already gave earlier in this conversation - the client already read it. Answer only what is new.",
  "- Go easy on exclamation points: at most ONE per message, often zero. Warm and calm, not hype-y. Do not open every message with 'Happy to help!' / 'Awesome!' / 'Sounds great!'.",
  "- NEVER use the long dash characters (the em dash or the en dash). Use a plain hyphen (-), a comma, or a period instead.",
  "- Ask at most ONE short follow-up question, and only when you genuinely need it. Do not tack an upsell question onto every reply.",
];

/** Decide how (or whether) to auto-respond to the newest client message.
 *  Returns null when the assistant is unavailable (no API key, API error) -
 *  callers must treat that as "do nothing", never as an answer. */
export async function assistDesignThread(input: {
  design: DesignContext;
  order: OrderContext | null;
  messages: DesignMessage[];
}): Promise<AssistantResult | null> {
  const taughtFacts = await loadTaughtFacts();
  const prompt = [
    "You are the AI assistant on Slugger Athletics' private design-request message thread. The CLIENT just sent the last message below; decide how to respond.",
    "",
    buildGrounding(input.design, input.order, input.messages, taughtFacts),
    "",
    "Choose exactly one action:",
    '- "answer": ONLY if the client asked something you can answer completely and confidently from the facts above (order status, what happens next, pricing from the list, turnaround, sizing, revisions, how approval works, whether a custom feature is possible). Write a short, warm, plain-text reply (2-5 sentences, no markdown, no em dashes - use hyphens). Do not promise anything beyond the stated facts. Do not sign a name.',
    '- A FIRST-TIME discount ask also gets "answer": use the discount policy above (depends on piece count, ask their target number, offer a call) and set flagStaff true so the team follows up personally. Never name a number.',
    '- "escalate": if the message involves a refund, cancellation, complaint, payment trouble, a callback request, an ongoing back-and-forth negotiation staff is already handling, or anything the facts do not fully cover. Also escalate if you are unsure. Do NOT write a client reply; give a one-line reason instead.',
    '- HARD RULE: when THIS PROJECT\'s design status is approved or ordered, or a deposit/payment has been made, ANY request to change the design (colors, elements, silhouettes, fonts, layout - anything visual) gets "answer" with a HOLDING reply only, plus flagStaff true. The holding reply: apologize briefly, explain the design was already approved and the deposit is in so production starts immediately and the design is locked at that point, and say you will check with the designer and get back to them. NEVER promise the change, never mention revision rounds.',
    '- DESIGN CHANGES BEFORE APPROVAL: if the design is NOT yet approved and the client is describing changes to the proof (in chat, or by attaching marked-up images), "answer" with a short reply that STEERS them to the built-in tool: ask them to use the "Request Changes" button on their proof page, where they can drop a pin on the exact spot and type the change so it goes straight to the designer with nothing lost. Acknowledge their request warmly, tell them you have flagged it for the designer, and set flagStaff true. Do not try to restate or action the change yourself in chat.',
    '- "none": if no reply is needed (a thank-you, an acknowledgment, or the client is clearly mid-conversation with a specific staff member - e.g. staff asked them a question and this is their answer). Never interrupt an ongoing negotiation.',
    "",
    "Reply in the language the client wrote in - if they wrote in Spanish, answer in natural Spanish (keep product names and dollar amounts as-is). Same for any other language.",
    "Never contradict anything a staff member said earlier in the conversation.",
    "When you do write a reply, follow these tone rules:",
    ...TONE_RULES,
    'Return ONLY JSON: { "action": "answer" | "escalate" | "none", "reply": string, "reason": string, "flagStaff": boolean }',
  ].join("\n");

  const out = (await generateJson(prompt, {
    type: "OBJECT",
    properties: {
      action: { type: "STRING", enum: ["answer", "escalate", "none"] },
      reply: { type: "STRING" },
      reason: { type: "STRING" },
      flagStaff: { type: "BOOLEAN" },
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
  /** Text the staff member already typed - THE answer/direction to finish,
   *  not a topic suggestion. Their intent wins over everything else. */
  direction?: string;
}): Promise<string | null> {
  const taughtFacts = await loadTaughtFacts();
  const prompt = [
    `You are drafting a message for ${input.staffName || "a staff member"} at Slugger Athletics to send to the client on their design-request thread. The draft goes into the staff member's message box for them to edit before sending - it is a suggestion, not an auto-reply.`,
    "",
    buildGrounding(input.design, input.order, input.messages, taughtFacts),
    "",
    ...(input.direction
      ? [
          "THE STAFF MEMBER STARTED THE REPLY THEMSELVES. This is their answer and their intent - finish it, do not replace it:",
          `"""${input.direction}"""`,
          "",
          "Turn that into one complete, polished, client-ready message: keep their meaning, decisions, and any facts or numbers they state (their words are AUTHORITATIVE and override the general facts above if they conflict), fix grammar and flow, keep their tone, and complete any unfinished thought in the direction they were clearly going. Do not add new promises, prices, or topics they did not raise.",
        ]
      : [
          "Draft the most helpful next message from staff to the client:",
          "- Usually that means answering the client's most recent unanswered question(s); if everything is answered, a short, useful next-step nudge.",
        ]),
    "- Everything Slugger makes is custom: when the client asks whether something can be done (a quarter-zip, cursive name instead of a number, etc.), the answer is that it is their choice - confirm it is doable and ask which way they want it.",
    "- Discount asks: follow the discount policy in the facts - we can work with them, it depends on the total piece count, ask what number they were hoping for, and offer a quick phone call. Never name a specific discount or price.",
    "- Design changes after approval/payment: the design is locked once approved and production starts on payment. Draft a reply that says the team will check whether production has already started before anything can be considered - never promise the change.",
    "- You may address other sensitive topics (complaints, exceptions) since a human reviews this, but NEVER invent a specific price, amount, or date that is not in the facts. Where a business decision is needed, insert a placeholder like [YOUR CALL: amount] so the staff member fills it in.",
    "- Match the tone of earlier staff messages: friendly, brief, plain text. 2-6 sentences. No markdown. Do not sign a name.",
    ...TONE_RULES,
    "- Write in the language the client writes in.",
    'Return ONLY JSON: { "draft": string }',
  ].join("\n");

  const out = await generateJson(prompt, {
    type: "OBJECT",
    properties: { draft: { type: "STRING" } },
    required: ["draft"],
  });
  const draft = (out?.draft ?? "").trim();
  return draft ? draft.slice(0, 1500) : null;
}

/* ------------------------------------------------------------------ */
/* Public site chat                                                    */
/* ------------------------------------------------------------------ */

export type ChatTurn = { role: "user" | "bot"; text: string };

/** Answer a visitor's question in the public site chat widget. Grounded in
 *  the same shop knowledge as the design-thread assistant, but with no
 *  project context - order-specific questions get pointed at the customer's
 *  own status link or a text to the shop. Returns null on any failure. */
export async function answerPublicChat(history: ChatTurn[], extraContext?: string): Promise<string | null> {
  const taughtFacts = await loadTaughtFacts();
  // Reuse the shared grounding with a neutral "no project" context.
  const grounding = buildGrounding(
    { reference: "-", teamName: "-", status: "-", revisionsUsed: null, proofCount: 0, rush: null, neededBy: null },
    null,
    [],
    taughtFacts,
  )
    // Strip the project-specific tail (meaningless in public chat).
    .split("THIS PROJECT RIGHT NOW:")[0];

  const convo = history
    .slice(-10)
    .map((t) => `${t.role === "user" ? "VISITOR" : "YOU"}: ${t.text.slice(0, 500)}`)
    .join("\n");

  const prompt = [
    "You are the website chat assistant for Slugger Athletics (sluggerathletics.com), a custom team gear shop in Ocala, Florida. A site visitor is chatting with you.",
    "",
    grounding,
    "USEFUL LINKS you may share (plain URLs): /design (start a free design), /custom-jersey-maker (the FREE online Custom Jersey Maker - visitors pick sport, style, and colors, describe their idea, and instantly see a front-and-back AI jersey concept; 3 free concepts, then email unlocks more; our real designer produces the final design), /team-order (start a team order), /pricing (2026 pricing and bundles), /custom-hats, /team-uniforms, /faq, /track.",
    "",
    "ORDER STATUS LOOKUPS: visitors CAN check their own order status here. To verify them, you need BOTH their order reference (looks like TO-XXXXXX, DR-XXXXXX, or INV-XXXXXX - it is in every email we sent them) AND the email address they ordered with. Ask for whichever is missing. The verification itself happens on our server - a block below will say VERIFIED or FAILED. Never guess at order details yourself, and never reveal emails, private links, or internal shipment info beyond what a VERIFIED block explicitly provides.",
    ...(extraContext ? ["", extraContext] : []),
    "",
    "CONVERSATION:",
    convo,
    "",
    "Reply to the visitor's last message:",
    "- Answer ONLY from the facts above. Short, warm, plain text - 1-4 sentences. No markdown.",
    ...TONE_RULES,
    "- Never invent prices, dates, or policies. If you do not know, say so and offer the text line: (352) 414-7270.",
    "- Questions about a SPECIFIC existing order or design: you cannot see orders - point them to the status link in their email, or to text (352) 414-7270.",
    "- Discount asks: we can work with them, it depends on total piece count - ask their target number and offer a call. Never name a discount.",
    "- When it fits naturally, point them to starting a free design at /design - that is the goal.",
    "- Reply in the visitor's language.",
    'Return ONLY JSON: { "reply": string }',
  ].join("\n");

  const out = await generateJson(prompt, {
    type: "OBJECT",
    properties: { reply: { type: "STRING" } },
    required: ["reply"],
  });
  const reply = (out?.reply ?? "").trim();
  return reply ? reply.slice(0, 1200) : null;
}


/* ------------------------------------------------------------------ */
/* Texts inbox: draft an SMS reply grounded in the customer's history  */
/* ------------------------------------------------------------------ */

export type SmsThreadMsg = { direction: string; body: string; at: string };
export type SmsCustomerContext = {
  emails: string[];
  spendCents: number;
  orders: { reference: string; teamName: string; status: string; totalCents: number | null; paid: boolean; depositPaid: boolean }[];
  designs: { reference: string; teamName: string; status: string }[];
};

const ORDER_STATUS_MEANING: Record<string, string> = {
  collecting: "the roster link is open and players are still adding themselves",
  submitted: "the roster is in and we owe them the deposit invoice",
  quoted: "the invoice went out and we're waiting on the 50% deposit",
  in_production: "the deposit is paid and their gear is being made now",
  paid: "it's paid in full and about to ship",
  shipped: "it already shipped",
};

/** Draft an SMS reply for the Texts inbox: grounded in the whole conversation
 *  plus the customer's real orders and design projects, so questions like
 *  "where's my order?" get answered with their actual status. A human edits
 *  and sends - this never auto-replies. */
export async function draftSmsReply(input: {
  contactName: string | null;
  thread: SmsThreadMsg[];
  context: SmsCustomerContext;
  direction?: string;
}): Promise<string | null> {
  const taughtFacts = await loadTaughtFacts();
  const thread = input.thread.slice(-40);
  const convo = thread
    .map((m) => `${m.direction === "in" ? "CUSTOMER" : m.direction === "note" ? "INTERNAL STAFF NOTE (customer never saw this)" : "SLUGGER"}: ${m.body}`)
    .join("\n");
  const orderLines = input.context.orders.map((o) => {
    const meaning = ORDER_STATUS_MEANING[o.status] ?? o.status;
    return `- Order ${o.reference} (${o.teamName}): status "${o.status}" - ${meaning}.${o.totalCents ? ` Total ${money(o.totalCents)}.` : ""}${o.paid ? " Paid in full." : o.depositPaid ? " Deposit paid, balance still due." : ""}`;
  });
  const designLines = input.context.designs.map((d) => `- Design ${d.reference} (${d.teamName}): ${statusMeaning(d.status)}.`);

  const prompt = [
    `You are drafting a TEXT MESSAGE for Slugger Athletics staff to send${input.contactName ? ` to ${input.contactName}` : ""} from the shop's texting line. The draft goes into the staff member's box to edit before sending - it is a suggestion, never an auto-reply.`,
    "",
    "THIS CUSTOMER'S REAL RECORDS (authoritative - use these to answer status questions):",
    ...(orderLines.length ? ["Orders:", ...orderLines] : ["Orders: none on file for this phone number."]),
    ...(designLines.length ? ["Design projects:", ...designLines] : []),
    "",
    "TAUGHT FACTS (official policies and pricing):",
    taughtFacts.length ? taughtFacts.map((f) => `- ${f}`).join("\n") : "(none)",
    "",
    "THE CONVERSATION SO FAR (oldest to newest):",
    convo || "(no messages yet - this is an outreach text)",
    "",
    ...(input.direction
      ? [
          "THE STAFF MEMBER STARTED THE REPLY THEMSELVES - finish it, do not replace it. Their words are authoritative:",
          `"""${input.direction}"""`,
        ]
      : [
          "Draft the most helpful next text: usually answering the customer's most recent unanswered question using their REAL order/design records above.",
        ]),
    "- This is SMS: 1-3 short sentences, plain text, no markdown, no links unless one genuinely helps.",
    "- NEVER invent a status, date, price, or tracking number that is not in the records above. If the records do not answer it, draft a message that says you will check and follow up.",
    "- Do not sign a name.",
    ...TONE_RULES,
    "- Write in the language the customer writes in.",
    'Return ONLY JSON: { "draft": string }',
  ].join("\n");

  const out = await generateJson(prompt, {
    type: "OBJECT",
    properties: { draft: { type: "STRING" } },
    required: ["draft"],
  });
  const draft = (out?.draft ?? "").trim();
  return draft ? draft.slice(0, 1000) : null;
}
