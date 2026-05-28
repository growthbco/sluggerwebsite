/**
 * Batch-generates uniform 3-view mockups (hero / front / back) for every
 * jersey & hoodie in the catalog, using each product's existing image as the
 * design input. Writes src/data/mockups.json so the storefront uses them.
 *
 * Run: npx tsx scripts/generate-catalog-mockups.ts
 * Needs GEMINI_API_KEY in .env.local. Throttled to respect rate limits.
 */
import { GoogleGenAI } from "@google/genai";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { config } from "dotenv";
import path from "node:path";

config({ path: ".env.local" });

const MODEL = "gemini-2.5-flash-image";
const OUT_DIR = path.join(process.cwd(), "public", "mockups");
const CATALOG = path.join(process.cwd(), "src", "data", "migrated-products.json");
const MANIFEST = path.join(process.cwd(), "src", "data", "mockups.json");
const THROTTLE_MS = 1500;

type Product = {
  slug: string;
  name: string;
  category: string;
  images: { src: string }[];
};

// Decide the garment word (or skip). Only apparel that suits a front/back layout.
function garmentFor(p: Product): string | null {
  const n = p.name.toLowerCase();
  if (/hat|snapback|cap/.test(n)) return null;
  if (/chain/.test(n)) return null;
  if (/shorts?/.test(n)) return null;
  if (/hoodie|pullover/.test(n)) return "hoodie";
  if (/long sleeve|long-sleeve/.test(n)) return "long-sleeve athletic jersey";
  if (/jersey/.test(n) || p.category === "uniforms") return "short-sleeve athletic jersey";
  return null;
}

const BASE = (garment: string) =>
  [
    `Create a professional e-commerce product mockup of a custom sublimated ${garment}.`,
    "Give it a realistic three-dimensional look with soft fabric shading, like a premium product render.",
    "Place it on a clean, pure WHITE studio background with soft, even shadows.",
    "Apply the EXACT artwork, colors, text, numbers and logos from the provided design image — do not redraw, restyle or alter any text or logos; reproduce them faithfully.",
    "No background scenery, no people, no watermark, no extra text.",
  ].join(" ");

const VIEWS = [
  { suffix: "hero", instr: `Show EXACTLY TWO of the same garment — the FRONT large in the foreground at a slight three-quarter angle, and the BACK smaller and angled behind it, slightly overlapping. Do NOT add a third garment.` },
  { suffix: "front", instr: "Show ONE garment only — the FRONT view, facing straight on, centered. No second garment." },
  { suffix: "back", instr: "Show ONE garment only — the BACK view (name/number area), facing straight on, centered. No second garment." },
];

const mimeFor = (f: string) =>
  /\.jpe?g$/i.test(f) ? "image/jpeg" : /\.webp$/i.test(f) ? "image/webp" : "image/png";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("✗ GEMINI_API_KEY not set in .env.local");
    process.exit(1);
  }

  const products: Product[] = JSON.parse(await readFile(CATALOG, "utf8"));
  const targets = products.filter((p) => garmentFor(p) && p.images[0]);
  console.log(`${targets.length} apparel products to render (×3 views = ${targets.length * 3} images)\n`);

  const ai = new GoogleGenAI({ apiKey });
  await mkdir(OUT_DIR, { recursive: true });

  const manifest: Record<string, { hero?: string; front?: string; back?: string }> = existsSync(
    MANIFEST,
  )
    ? JSON.parse(await readFile(MANIFEST, "utf8"))
    : {};

  for (const p of targets) {
    const garment = garmentFor(p)!;
    const srcDisk = path.join(process.cwd(), "public", p.images[0].src);
    if (!existsSync(srcDisk)) {
      console.log(`  ✗ ${p.slug}: source image missing`);
      continue;
    }
    const designPart = {
      inlineData: {
        mimeType: mimeFor(srcDisk),
        data: (await readFile(srcDisk)).toString("base64"),
      },
    };

    manifest[p.slug] ??= {};
    for (const view of VIEWS) {
      const outRel = `/mockups/${p.slug}-${view.suffix}.png`;
      // Resumable: skip views already rendered.
      if (existsSync(path.join(process.cwd(), "public", outRel))) {
        manifest[p.slug][view.suffix as "hero" | "front" | "back"] = outRel;
        await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
        console.log(`  · ${p.slug}-${view.suffix} (exists, skipped)`);
        continue;
      }
      try {
        const res = await ai.models.generateContent({
          model: MODEL,
          contents: [{ text: `${BASE(garment)} ${view.instr}` }, designPart],
        });
        const img = res.candidates?.[0]?.content?.parts?.find((x) => x.inlineData);
        if (!img?.inlineData?.data) {
          console.log(`  ✗ ${p.slug}-${view.suffix}: no image`);
          continue;
        }
        await writeFile(path.join(process.cwd(), "public", outRel), Buffer.from(img.inlineData.data, "base64"));
        manifest[p.slug][view.suffix as "hero" | "front" | "back"] = outRel;
        await writeFile(MANIFEST, JSON.stringify(manifest, null, 2)); // save incrementally
        console.log(`  ✓ ${p.slug}-${view.suffix}`);
      } catch (e) {
        console.log(`  ✗ ${p.slug}-${view.suffix}: ${(e as Error).message.slice(0, 80)}`);
      }
      await sleep(THROTTLE_MS);
    }
  }

  console.log(`\nDone. Manifest → src/data/mockups.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
