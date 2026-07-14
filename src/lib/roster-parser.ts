// AI roster import: turn whatever a coach has (pasted text message, spreadsheet
// cells, or a photo/screenshot of a roster) into clean roster rows. The result
// is ALWAYS reviewed by the coach before it's saved - the AI only fills the
// grid, it never submits.

import { sizesFor, itemLabel } from "@/lib/order-items";

const MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type ParsedRosterRow = {
  name: string;
  number: string;
  sizes: Record<string, string>;
  notes?: string;
};

export async function parseRoster(input: {
  text?: string;
  image?: { mime: string; base64: string };
  itemKeys: string[];
}): Promise<ParsedRosterRow[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  if (!input.text && !input.image) throw new Error("Nothing to parse");

  const items = input.itemKeys.length ? input.itemKeys : ["jersey"];
  const sizeRules = items
    .map((k) => `  - "${k}" (${itemLabel(k)}): allowed sizes are exactly: ${sizesFor(k).join(", ")}`)
    .join("\n");

  const prompt = [
    "You are reading a sports team roster a coach received (pasted text, spreadsheet cells, or a photo/screenshot - possibly handwritten).",
    "Extract every player as one object: { name, number, sizes, notes }.",
    "",
    "Rules:",
    "- name: the player's name as written (keep capitalization reasonable, e.g. 'Smith' or 'DE LA CRUZ').",
    "- number: jersey number digits only; empty string if none given.",
    `- sizes: an object whose keys are ONLY these item keys:\n${sizeRules}`,
    "- Map size synonyms onto the EXACT allowed size strings above (e.g. 'L'/'large' → 'Large', 'YM'/'youth med' → 'Youth Medium', 'XXL' → '2X-Large').",
    "- If the source gives ONE size per player, apply it to every item key EXCEPT socks; only set a socks size when the source explicitly gives one.",
    "- If a size can't be mapped confidently, put the raw text as the value so a human can fix it, and mention it in notes.",
    "- notes: anything extra tied to that player (e.g. 'goalie', 'C on chest'); empty string if none.",
    "- Skip headers, totals, and rows that clearly aren't players.",
    "",
    'Return ONLY valid JSON: { "players": [ ... ] }. No commentary, no markdown fences.',
  ].join("\n");

  const parts: unknown[] = [{ text: prompt }];
  if (input.text) parts.push({ text: `ROSTER SOURCE TEXT:\n${input.text}` });
  if (input.image) parts.push({ inline_data: { mime_type: input.image.mime, data: input.image.base64 } });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          players: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                number: { type: "STRING" },
                sizes: {
                  type: "OBJECT",
                  properties: Object.fromEntries(items.map((k) => [k, { type: "STRING" }])),
                },
                notes: { type: "STRING" },
              },
              required: ["name"],
            },
          },
        },
        required: ["players"],
      },
    },
  };

  const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("Gemini roster parse failed:", res.status, await res.text());
    throw new Error("The AI reader had trouble - try again or enter players manually.");
  }
  const data = await res.json();
  const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: { players?: ParsedRosterRow[] } = {};
  try {
    parsed = JSON.parse(textOut);
  } catch {
    throw new Error("Could not read a roster from that - try a clearer photo or paste the text.");
  }

  return (parsed.players ?? [])
    .filter((p) => (p.name ?? "").trim())
    .slice(0, 200)
    .map((p) => ({
      name: String(p.name ?? "").trim().slice(0, 60),
      number: String(p.number ?? "").replace(/[^0-9]/g, "").slice(0, 4),
      sizes: Object.fromEntries(
        Object.entries(p.sizes ?? {})
          .filter(([k, v]) => items.includes(k) && String(v ?? "").trim())
          .map(([k, v]) => [k, String(v).trim().slice(0, 30)]),
      ),
      notes: String(p.notes ?? "").trim().slice(0, 200) || undefined,
    }));
}
