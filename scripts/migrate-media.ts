/**
 * Pulls the entire WordPress media library (gallery / marketing / team photos)
 * from the existing site so nothing is lost in the rebuild.
 *
 * - Lists every image via the WP REST media endpoint (paginated).
 * - Downloads full-size originals into /public/media/.
 * - Skips size-chart images. Records metadata to src/data/site-media.json.
 *
 * Run: npx tsx scripts/migrate-media.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE = "https://www.sluggerathletics.com";
const MEDIA_API = `${SOURCE}/wp-json/wp/v2/media`;
const OUT_DIR = path.join(process.cwd(), "public", "media");
const DATA_FILE = path.join(process.cwd(), "src", "data", "site-media.json");

type WpMedia = {
  id: number;
  media_type: string;
  mime_type: string;
  source_url: string;
  alt_text?: string;
  title?: { rendered?: string };
};

function isSizeChart(url: string): boolean {
  return /size[-_]?chart/i.test(url);
}

function decode(s: string): string {
  return (s || "")
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/<[^>]+>/g, "")
    .trim();
}

async function listAll(): Promise<WpMedia[]> {
  const out: WpMedia[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${MEDIA_API}?per_page=100&page=${page}&media_type=image`);
    if (!res.ok) break;
    const batch = (await res.json()) as WpMedia[];
    if (!batch.length) break;
    out.push(...batch);
    const totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
    if (page >= totalPages) break;
    page++;
  }
  return out;
}

async function download(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const base = path.basename(new URL(url).pathname).split("?")[0];
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(OUT_DIR, base), buf);
    return base;
  } catch {
    return null;
  }
}

async function main() {
  console.log("Listing media from", MEDIA_API);
  const media = (await listAll()).filter(
    (m) => m.media_type === "image" && m.source_url && !isSizeChart(m.source_url),
  );
  console.log(`Found ${media.length} images to keep`);

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.dirname(DATA_FILE), { recursive: true });

  const records = [];
  let ok = 0;
  for (const m of media) {
    const file = await download(m.source_url);
    if (file) {
      ok++;
      records.push({
        id: m.id,
        file: `/media/${file}`,
        alt: decode(m.alt_text || m.title?.rendered || ""),
        title: decode(m.title?.rendered || ""),
        sourceUrl: m.source_url,
      });
    }
  }

  await writeFile(DATA_FILE, JSON.stringify(records, null, 2));
  console.log(`Downloaded ${ok}/${media.length} images → public/media/`);
  console.log(`Wrote metadata → ${path.relative(process.cwd(), DATA_FILE)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
