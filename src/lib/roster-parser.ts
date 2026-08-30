// AI roster import: turn whatever a coach has (pasted text message, spreadsheet
// cells, or a photo/screenshot of a roster) into clean roster rows. The result
// is ALWAYS reviewed by the coach before it's saved - the AI only fills the
// grid, it never submits.

import { sizeFieldsForItems } from "@/lib/order-items";
import { generateOpenAiStructured, type OpenAiInputPart } from "@/lib/openai-structured";

export type ParsedRosterRow = {
  name: string;
  number: string;
  sizes: Record<string, string>;
  notes?: string;
};

export type ParseItemDef = { key: string; label: string; sizes: string[] };

export async function parseRoster(input: {
  text?: string;
  image?: { mime: string; base64: string };
  itemKeys: string[];
  /** Explicit item definitions (e.g. store items like hats). Falls back to
   *  the team-order item types when absent. */
  itemDefs?: ParseItemDef[];
}): Promise<ParsedRosterRow[]> {
  if (!input.text && !input.image) throw new Error("Nothing to parse");

  const defs: ParseItemDef[] =
    input.itemDefs?.length
      ? input.itemDefs
      : sizeFieldsForItems(input.itemKeys);
  const items = defs.map((d) => d.key);
  const sizeRules = defs
    .map((d) => `  - "${d.key}" (${d.label}): allowed sizes are exactly: ${d.sizes.join(", ")}`)
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

  const parts: OpenAiInputPart[] = [{ type: "input_text", text: prompt }];
  if (input.text) parts.push({ type: "input_text", text: `ROSTER SOURCE TEXT:\n${input.text}` });
  if (input.image) {
    parts.push({
      type: "input_image",
      image_url: `data:${input.image.mime};base64,${input.image.base64}`,
      detail: "high",
    });
  }

  let parsed: { players?: ParsedRosterRow[] };
  try {
    parsed = await generateOpenAiStructured<{ players?: ParsedRosterRow[] }>({
      operation: "roster_parse",
      schemaName: "team_roster",
      parts,
      metadata: { hasImage: Boolean(input.image) },
      schema: {
        type: "object",
        properties: {
          players: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                number: { type: "string" },
                sizes: {
                  type: "object",
                  properties: Object.fromEntries(items.map((k) => [k, { type: "string" }])),
                  required: items,
                  additionalProperties: false,
                },
                notes: { type: "string" },
              },
              required: ["name", "number", "sizes", "notes"],
              additionalProperties: false,
            },
          },
        },
        required: ["players"],
        additionalProperties: false,
      },
    });
  } catch (error) {
    console.error("OpenAI roster parse failed:", error);
    throw new Error("The AI reader had trouble - try again or enter players manually.");
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
