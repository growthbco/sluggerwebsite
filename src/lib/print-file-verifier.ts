/**
 * Print-file QA: read a jersey print-file image with Gemini, extract every
 * jersey's {name, number, size}, and diff against the submitted roster so the
 * designer can catch typos / missing players / wrong sizes BEFORE printing.
 *
 * This replaces a slow customer-facing "please re-read every jersey on this
 * proof" step that historically caused costly reprints.
 */

const MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type RosterEntry = {
  name: string;
  number: string;
  size: string; // jersey size
};

export type Extracted = { name: string; number: string; size: string };

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

/** Ask Gemini to extract jerseys from the print-file image as structured JSON. */
async function extractJerseysFromImage(imageUrl: string): Promise<Extracted[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  // Fetch the image and inline as base64; Gemini's REST API takes inline_data.
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch print file (${imgRes.status})`);
  const mime = imgRes.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const b64 = buf.toString("base64");

  const prompt = [
    "You are reading a jersey print-file layout (an image or a PDF page).",
    "The image shows jerseys grouped under size labels (e.g. 'SMALL-2', 'MEDIUM-4', 'LARGE-4', '6T-2', '3T-1', 'XLARGE-1', '2XLARGE-1').",
    "Each jersey shows the player NAME (large, across the upper back) and NUMBER (large, below the name).",
    "Ignore jerseys that show only a logo or wordmark on the back (those are the front of the jersey, not a player back).",
    "",
    "For every jersey with a player name + number, return one object with:",
    "  name   – uppercase player name as printed (string)",
    "  number – the printed jersey number (string of digits, no leading zero unless printed)",
    "  size   – the size label of the group it belongs to. Use only: 2T, 3T, 4T, 5T, 6T, YS, YM, YL, S, M, L, XL, 2XL, 3XL.",
    "          (so 'SMALL' → 'S', 'MEDIUM' → 'M', 'LARGE' → 'L', 'XLARGE' → 'XL', '2XLARGE' → '2XL').",
    "",
    "Return ONLY valid JSON with shape: { \"jerseys\": [ { \"name\": \"...\", \"number\": \"...\", \"size\": \"...\" }, ... ] }.",
    "No commentary, no markdown fences.",
  ].join("\n");

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data: b64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          jerseys: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                number: { type: "STRING" },
                size: { type: "STRING" },
              },
              required: ["name", "number", "size"],
            },
          },
        },
        required: ["jerseys"],
      },
    },
  };

  const url = `${API_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${txt.slice(0, 400)}`);
  }
  const json = await res.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned no text content");

  let parsed: { jerseys?: Extracted[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned non-JSON output");
  }
  return (parsed.jerseys ?? []).filter((j) => j.name && j.number);
}

/** Diff the extracted jerseys against the roster ground truth. */
export function diffPrintFileVsRoster(
  extracted: Extracted[],
  roster: RosterEntry[],
): { ok: boolean; summary: string; mismatches: Mismatch[] } {
  const mismatches: Mismatch[] = [];

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
          detail: `${r.name} #${r.number}: roster says ${rSize}, print file shows ${p.size}.`,
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

    // 3. Match on number only — likely name typo. Use Levenshtein to confirm.
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

    // 4. Nothing matched — roster player is missing from the print file.
    mismatches.push({
      kind: "missing",
      roster: { name: r.name, number: r.number, size: r.size },
      detail: `${r.name} #${r.number} (${rSize}) is on the roster but not on the print file.`,
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

/** End-to-end: fetch image → Gemini → diff. */
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
    model: MODEL,
  };
}
