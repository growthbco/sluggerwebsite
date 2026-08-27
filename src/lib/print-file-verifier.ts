/**
 * Print-file QA: read a jersey print-file image with OpenAI, extract every
 * jersey's {name, number, size}, and diff against the submitted roster so the
 * designer can catch typos / missing players / wrong sizes BEFORE printing.
 *
 * This replaces a slow customer-facing "please re-read every jersey on this
 * proof" step that historically caused costly reprints.
 */

import {
  generateOpenAiStructured,
  OPENAI_VISION_MODEL,
  type OpenAiInputPart,
} from "@/lib/openai-structured";

export type RosterEntry = {
  name: string;
  number: string;
  size: string; // jersey size
};

export type Extracted = { name: string; number: string; size: string; frontNumber?: string };

export type Mismatch = {
  kind: "missing" | "extra" | "wrong_size" | "wrong_number" | "name_typo";
  roster?: { name?: string; number?: string; size?: string };
  printed?: { name?: string; number?: string; size?: string };
  detail: string;
};

export type VerifyResult = {
  ok: boolean;
  summary: string;
  extracted: Extracted[];
  mismatches: Mismatch[];
  verifiedAt: string;
  model: string;
};

/** Loose normalizer: trim, uppercase, strip non-alphanum for fuzzy name match. */
function normName(s: string | undefined | null): string {
  return (s ?? "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function normNumber(s: string | undefined | null): string {
  return (s ?? "").toString().replace(/[^0-9]/g, "");
}
/** Map jersey sizes onto a canonical form so equivalent spellings match
 *  ("2X" = "2XL" = "2X-Large" = "2XLarge", "Large" = "L", etc.). */
function normSize(s: string | undefined | null): string {
  let raw = (s ?? "").toString().toUpperCase().trim();
  // Print files label groups with a trailing count ("2XLARGE-2", "MEDIUM-4");
  // drop that count so only the size remains.
  raw = raw.replace(/[-\s]\d+$/, "");
  // Collapse separators so "2X-LARGE" / "2X LARGE" / "2XLARGE" all match.
  const t = raw.replace(/[^A-Z0-9]/g, "");
  const map: Record<string, string> = {
    YOUTHSMALL: "YS", YSMALL: "YS", YS: "YS",
    YOUTHMEDIUM: "YM", YMEDIUM: "YM", YMED: "YM", YM: "YM",
    YOUTHLARGE: "YL", YLARGE: "YL", YL: "YL",
    YOUTHXLARGE: "YXL", YXLARGE: "YXL", YXL: "YXL",
    SMALL: "S", SM: "S", S: "S",
    MEDIUM: "M", MED: "M", MD: "M", M: "M",
    LARGE: "L", LG: "L", L: "L",
    XLARGE: "XL", XL: "XL", "1XL": "XL", "1XLARGE": "XL",
    XXLARGE: "2XL", XXL: "2XL", "2XLARGE": "2XL", "2XL": "2XL", "2X": "2XL",
    XXXLARGE: "3XL", XXXL: "3XL", "3XLARGE": "3XL", "3XL": "3XL", "3X": "3XL",
    "4XLARGE": "4XL", "4XL": "4XL", "4X": "4XL",
    "5XLARGE": "5XL", "5XL": "5XL", "5X": "5XL",
    "2T": "2T", "3T": "3T", "4T": "4T", "5T": "5T", "6T": "6T",
  };
  return map[t] ?? t;
}

/** Levenshtein distance for spotting near-miss name typos. */
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp: number[] = Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

async function extractJerseysFromImage(imageUrl: string): Promise<Extracted[]> {
  // OpenAI accepts PDFs as input files and images as data URLs.
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch print file (${imgRes.status})`);
  const mime = imgRes.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const b64 = buf.toString("base64");

  const prompt = [
    "You are reading a jersey print-file layout (an image or a PDF page).",
    "The image shows jerseys grouped under size labels (e.g. 'SMALL-2', 'MEDIUM-4', 'LARGE-4', '6T-2', '3T-1', 'XLARGE-1', '2XLARGE-1').",
    "Each player jersey (the BACK) shows the player NAME (large, arched across the upper back) and usually their NUMBER (very large, centered below the name).",
    "",
    "CRITICAL - read each jersey carefully:",
    "- SOME jerseys have a NAME but NO number at all (common on bowling, rec, and adult-league teams). That is completely normal - do NOT invent a number, and do NOT read the team logo/monogram as a number. Return number as an empty string \"\" for those. A jersey with just a name is still a valid jersey to return.",
    "- A team LOGO, MONOGRAM, or WORDMARK (small initials/emblem such as 'GA', 'SA', a mascot, or a team name at the top collar or on the chest) is NOT part of the player's name. NEVER prepend or append it. If a jersey shows a monogram above the name, ignore the monogram and return only the actual player name.",
    "- The NUMBER belongs to the SAME jersey as the name directly above it. Do not borrow a number from an adjacent jersey. Two different jerseys may share the same number - that is fine, read each independently.",
    "- Each player usually has TWO panels shown together: the FRONT and the BACK of the same jersey. Read the BACK for the player name + large number, and pair it with its matching FRONT panel.",
    "- SOME jerseys ALSO have a small player NUMBER on the FRONT (upper chest, usually beside the team logo). When the front panel of a jersey shows a chest number, read it independently and return it as frontNumber. It SHOULD equal that jersey's back number - we compare them, so read each on its own, don't just copy the back number. If the front has no number (only the team name/logo), return frontNumber as an empty string.",
    "- Read digits exactly as printed, including stylized fonts. If a digit is genuinely ambiguous, still give your single best reading.",
    "",
    "For every player jersey, return one object with:",
    "  name        - the player name only, uppercase, WITHOUT any logo/monogram text",
    "  number      - the printed jersey BACK number (digits only)",
    "  frontNumber - the small chest number on the FRONT of the same jersey (digits only), or \"\" if the front has no number",
    "  size        - the size label of the group it belongs to. Use only: 2T, 3T, 4T, 5T, 6T, YS, YM, YL, S, M, L, XL, 2XL, 3XL.",
    "          (so 'SMALL' → 'S', 'MEDIUM' → 'M', 'LARGE' → 'L', 'XLARGE' → 'XL', '2XLARGE' → '2XL').",
    "",
    "Return ONLY valid JSON with shape: { \"jerseys\": [ { \"name\": \"...\", \"number\": \"...\", \"frontNumber\": \"...\", \"size\": \"...\" }, ... ] }.",
    "No commentary, no markdown fences.",
  ].join("\n");

  const mediaPart: OpenAiInputPart = mime.includes("pdf")
    ? { type: "input_file", filename: "print-file.pdf", file_data: `data:${mime};base64,${b64}` }
    : { type: "input_image", image_url: `data:${mime};base64,${b64}`, detail: "high" };
  const parsed = await generateOpenAiStructured<{ jerseys?: Extracted[] }>({
    operation: "print_file_qa",
    schemaName: "print_file_jerseys",
    timeoutMs: 180000,
    metadata: { mime, bytes: buf.length },
    parts: [{ type: "input_text", text: prompt }, mediaPart],
    schema: {
      type: "object",
      properties: {
        jerseys: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              number: { type: "string" },
              frontNumber: { type: "string" },
              size: { type: "string" },
            },
            required: ["name", "number", "frontNumber", "size"],
            additionalProperties: false,
          },
        },
      },
      required: ["jerseys"],
      additionalProperties: false,
    },
  });
  // Keep a jersey if it has a name OR a number - name-only jerseys (bowling,
  // rec, adult league) are valid and must still be diffed against the roster.
  return (parsed.jerseys ?? []).filter((j) => j.name || j.number);
}

/** Diff the extracted jerseys against the roster ground truth. */
export function diffPrintFileVsRoster(
  extracted: Extracted[],
  roster: RosterEntry[],
): { ok: boolean; summary: string; mismatches: Mismatch[] } {
  const mismatches: Mismatch[] = [];

  // Front/back number check: when a jersey has a chest number on the front, it
  // must match the big number on the back. Flag any that disagree.
  for (const e of extracted) {
    const front = normNumber(e.frontNumber ?? "");
    const back = normNumber(e.number);
    if (front && back && front !== back) {
      mismatches.push({
        kind: "wrong_number",
        printed: { name: e.name, number: `front ${e.frontNumber} / back ${e.number}`, size: e.size },
        detail: `${e.name || "Jersey"}: FRONT chest number (${e.frontNumber}) does not match the BACK number (${e.number}).`,
      });
    }
  }

  // Track which extracted items got matched so we can flag extras.
  const printedRemaining = extracted.map((e) => ({
    name: e.name,
    number: e.number,
    size: normSize(e.size),
    nName: normName(e.name),
    nNum: normNumber(e.number),
    matched: false,
  }));

  for (const r of roster) {
    const rName = normName(r.name);
    const rNum = normNumber(r.number);
    const rSize = normSize(r.size);

    // 1. Exact match on name + number.
    let idx = printedRemaining.findIndex((p) => !p.matched && p.nName === rName && p.nNum === rNum);
    if (idx >= 0) {
      const p = printedRemaining[idx];
      p.matched = true;
      if (p.size !== rSize) {
        mismatches.push({
          kind: "wrong_size",
          roster: { name: r.name, number: r.number, size: r.size },
          printed: { name: p.name, number: p.number, size: p.size },
          detail: `${r.name}${r.number ? ` #${r.number}` : ""}: roster says ${rSize}, print file shows ${p.size}.`,
        });
      }
      continue;
    }

    // 2. Match on name only (number wrong).
    idx = printedRemaining.findIndex((p) => !p.matched && p.nName === rName);
    if (idx >= 0) {
      const p = printedRemaining[idx];
      p.matched = true;
      mismatches.push({
        kind: "wrong_number",
        roster: { name: r.name, number: r.number, size: r.size },
        printed: { name: p.name, number: p.number, size: p.size },
        detail: `${r.name}: roster #${rNum}, print file #${p.nNum}.`,
      });
      continue;
    }

    // 3. Match on number only - likely name typo. Use Levenshtein to confirm.
    idx = printedRemaining.findIndex((p) => !p.matched && p.nNum === rNum);
    if (idx >= 0) {
      const p = printedRemaining[idx];
      const dist = lev(rName, p.nName);
      // close enough to be confidently a typo, not a different player
      if (dist > 0 && dist <= Math.max(2, Math.floor(rName.length / 3))) {
        p.matched = true;
        mismatches.push({
          kind: "name_typo",
          roster: { name: r.name, number: r.number, size: r.size },
          printed: { name: p.name, number: p.number, size: p.size },
          detail: `Possible name typo: roster "${r.name}" vs printed "${p.name}" (same #${rNum}).`,
        });
        continue;
      }
    }

    // 4. Nothing matched - roster player is missing from the print file.
    mismatches.push({
      kind: "missing",
      roster: { name: r.name, number: r.number, size: r.size },
      detail: `${r.name}${r.number ? ` #${r.number}` : ""} (${rSize}) is on the roster but not on the print file.`,
    });
  }

  // 5. Any printed jerseys we never matched are extras.
  for (const p of printedRemaining) {
    if (!p.matched) {
      mismatches.push({
        kind: "extra",
        printed: { name: p.name, number: p.number, size: p.size },
        detail: `${p.name} #${p.number} (${p.size}) is on the print file but not on the roster.`,
      });
    }
  }

  const ok = mismatches.length === 0;
  const summary = ok
    ? `All ${roster.length} roster players match the print file (${extracted.length} jerseys printed).`
    : `${mismatches.length} issue${mismatches.length === 1 ? "" : "s"} found across ${roster.length} roster vs ${extracted.length} printed.`;

  return { ok, summary, mismatches };
}

/** End-to-end: fetch image -> OpenAI -> diff. */
export async function verifyPrintFile(
  imageUrl: string,
  roster: RosterEntry[],
): Promise<VerifyResult> {
  return verifyPrintFiles([imageUrl], roster);
}

/** Verify one or more print-file sheets against the roster. Jerseys are read
 *  from every sheet and combined before the diff, so a roster split across
 *  multiple files still checks out as one. */
export async function verifyPrintFiles(
  imageUrls: string[],
  roster: RosterEntry[],
): Promise<VerifyResult> {
  const urls = imageUrls.filter(Boolean);
  if (urls.length === 0) throw new Error("No print files to verify.");
  const perFile = await Promise.all(urls.map((u) => extractJerseysFromImage(u)));
  const extracted = perFile.flat();
  const { ok, summary, mismatches } = diffPrintFileVsRoster(extracted, roster);
  return {
    ok,
    summary,
    extracted,
    mismatches,
    verifiedAt: new Date().toISOString(),
    model: OPENAI_VISION_MODEL,
  };
}
