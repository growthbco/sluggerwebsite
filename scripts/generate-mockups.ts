/**
 * Generates UNIFORM jersey product mockups from flat design art using
 * Google Gemini 2.5 Flash Image ("nano-banana"), image-to-image editing.
 *
 * Setup:
 *   1. Get a Gemini API key: https://aistudio.google.com/apikey
 *   2. Add to .env.local:  GEMINI_API_KEY="..."
 *   3. Drop flat design PNGs into  ./designs/   (filename = product name/slug).
 *      Optionally add  ./designs/_reference.png  — a sample jersey mockup whose
 *      STYLE (front+back angle, white background) every output should match.
 *   4. Run:  npx tsx scripts/generate-mockups.ts
 *
 * Outputs uniform mockups to  ./public/mockups/<name>.png  and prints a summary.
 */
import { GoogleGenAI } from "@google/genai";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { config } from "dotenv";
import path from "node:path";

config({ path: ".env.local" });

const MODEL = "gemini-2.5-flash-image";
const DESIGNS_DIR = path.join(process.cwd(), "designs");
const OUT_DIR = path.join(process.cwd(), "public", "mockups");

// The consistent look every product should share (the "Big League" style).
// Shared constraints applied to every render so the whole catalog stays uniform.
const BASE_PROMPT = [
  "Create a professional e-commerce product mockup of a custom sublimated short-sleeve athletic jersey.",
  "Give the jersey a realistic three-dimensional look with soft fabric shading, like a premium product render.",
  "Place it on a clean, pure WHITE studio background with soft, even shadows.",
  "Apply the EXACT artwork, colors, text, numbers, and logos from the provided design image onto the jersey — do not redraw, restyle, or alter any text or logos; reproduce them faithfully.",
  "Use a consistent camera angle, lighting, jersey shape, and framing across products.",
  "No background scenery, no people, no watermark, no extra text.",
].join(" ");

// Three images per product: a styled hero shot + standalone front + standalone back.
const VIEWS: { suffix: string; instr: string }[] = [
  {
    suffix: "hero",
    instr:
      "Show EXACTLY TWO jerseys of the same design — the FRONT large in the foreground at a slight three-quarter angle, and the BACK smaller and angled behind it, slightly overlapping. Do NOT add a third jersey or any duplicate.",
  },
  {
    suffix: "front",
    instr:
      "Show ONE jersey only — the FRONT view, facing straight on, centered. Do not show the back. No second jersey.",
  },
  {
    suffix: "back",
    instr:
      "Show ONE jersey only — the BACK view (showing the name/number area), facing straight on, centered. Do not show the front. No second jersey.",
  },
];

const mimeFor = (file: string) =>
  file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".jpeg")
    ? "image/jpeg"
    : file.toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/png";

async function fileToPart(file: string) {
  const data = await readFile(file);
  return { inlineData: { mimeType: mimeFor(file), data: data.toString("base64") } };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "✗ GEMINI_API_KEY is not set.\n" +
        "  Get one at https://aistudio.google.com/apikey and add it to .env.local",
    );
    process.exit(1);
  }

  let files: string[];
  try {
    files = await readdir(DESIGNS_DIR);
  } catch {
    console.error(`✗ No ./designs folder. Create it and drop your flat design PNGs in.`);
    process.exit(1);
  }

  const reference = files.find((f) => /^_reference\./i.test(f));
  const designs = files.filter(
    (f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith("_") && !f.startsWith("."),
  );

  if (designs.length === 0) {
    console.error("✗ No design files found in ./designs (skip names starting with _ or .).");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  await mkdir(OUT_DIR, { recursive: true });

  const refPart = reference ? await fileToPart(path.join(DESIGNS_DIR, reference)) : null;
  console.log(
    `Generating ${designs.length} mockup(s) with ${MODEL}` +
      (refPart ? ` (matching style of ${reference})` : "") + "\n",
  );

  let ok = 0;
  const total = designs.length * VIEWS.length;
  for (const file of designs) {
    const name = file.replace(/\.[^.]+$/, "");
    const designPart = await fileToPart(path.join(DESIGNS_DIR, file));

    for (const view of VIEWS) {
      try {
        const parts: object[] = [{ text: `${BASE_PROMPT} ${view.instr}` }, designPart];
        if (refPart) {
          parts.push({ text: "Match the presentation style of this reference mockup:" }, refPart);
        }

        const res = await ai.models.generateContent({ model: MODEL, contents: parts });
        const imgPart = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        if (!imgPart?.inlineData?.data) {
          console.log(`  ✗ ${name}-${view.suffix}: model returned no image`);
          continue;
        }
        const out = path.join(OUT_DIR, `${name}-${view.suffix}.png`);
        await writeFile(out, Buffer.from(imgPart.inlineData.data, "base64"));
        ok++;
        console.log(`  ✓ ${name}-${view.suffix} → public/mockups/${name}-${view.suffix}.png`);
      } catch (e) {
        console.log(`  ✗ ${name}-${view.suffix}: ${(e as Error).message}`);
      }
    }
  }

  console.log(`\nDone. ${ok}/${total} images generated → public/mockups/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
