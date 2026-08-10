import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { generateJson } from "@/lib/design-assistant";

export const runtime = "nodejs";

// Admin-only AI writing help for the custom invoice builder: item
// descriptions and notes/terms blocks, drafted from whatever context the
// staff member has typed so far. The draft lands in the field for editing -
// nothing is sent anywhere automatically.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let body: {
    kind?: "description" | "terms";
    itemName?: string;
    customerName?: string;
    lines?: { name: string; quantity: number }[];
    hint?: string;
  } = {};
  try { body = await req.json(); } catch {}
  const kind = body.kind === "terms" ? "terms" : "description";

  const context = [
    "Slugger Athletics is a custom team gear shop in Ocala, Florida: custom uniforms, embroidered hats, 3D hype chains and related services. Payment is collected via a secure online link.",
    body.customerName ? `Customer: ${body.customerName}` : null,
    body.lines?.length ? `Invoice items: ${body.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}` : null,
    body.hint ? `Staff notes about what they want: ${body.hint}` : null,
  ].filter(Boolean).join("\n");

  const prompt =
    kind === "description"
      ? [
          "Write a short, professional one-or-two-sentence line-item description for an invoice.",
          context,
          `Item to describe: ${body.itemName ?? ""}`,
          "Plain text only, no markdown, no em dashes (use hyphens), no price mentions. Describe what the customer is getting, concretely.",
          'Return ONLY JSON: { "text": string }',
        ].join("\n\n")
      : [
          "Write a brief notes/terms block for the bottom of an invoice from Slugger Athletics. 3-6 short lines covering only what applies: payment due on receipt via the included link; custom/personalized items are made to order and non-refundable once production starts; turnaround starts after payment; contact apparel@sluggerathletics.com or text (352) 414-7270 with questions.",
          context,
          "Plain text, one point per line, no markdown, no em dashes (use hyphens), friendly but professional. Do not invent prices, dates, or policies beyond the ones above unless the staff notes ask for them.",
          'Return ONLY JSON: { "text": string }',
        ].join("\n\n");

  try {
    const out = (await generateJson(prompt, {
      type: "OBJECT",
      properties: { text: { type: "STRING" } },
      required: ["text"],
    })) as { text?: string } | null;
    const text = (out?.text ?? "").trim().slice(0, 2000);
    if (!text) return NextResponse.json({ error: "AI draft came back empty - try again" }, { status: 502 });
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    console.error("ai-draft error:", e);
    return NextResponse.json({ error: "AI draft failed - try again" }, { status: 500 });
  }
}
