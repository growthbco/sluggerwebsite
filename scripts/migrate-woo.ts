/**
 * Full migration from the existing WooCommerce store (sluggerathletics.com).
 *
 * - Pulls every product from the public Store API (paginated).
 * - Downloads each product image into /public/products/<id>/.
 * - Writes a normalized catalog to src/data/migrated-products.json that maps
 *   onto our product shape (and later feeds the DB seed).
 *
 * Run: npx tsx scripts/migrate-woo.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const SOURCE = "https://www.sluggerathletics.com";
const API = `${SOURCE}/wp-json/wc/store/v1/products`;
const PUBLIC_DIR = path.join(process.cwd(), "public", "products");
const DATA_FILE = path.join(process.cwd(), "src", "data", "migrated-products.json");

type WooImage = { id: number; src: string; alt?: string };
type WooProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  description: string;
  short_description: string;
  prices: { price: string; regular_price: string; currency_minor_unit: number };
  categories: { id: number; name: string; slug: string }[];
  attributes: { name: string; terms: { name: string }[] }[];
  images: WooImage[];
  is_in_stock: boolean;
};

// Map WooCommerce category names to our four storefront categories.
function mapCategory(cats: { slug: string; name: string }[]): string {
  const slugs = cats.map((c) => c.slug);
  if (slugs.some((s) => s.includes("hoodie"))) return "accessories";
  if (slugs.some((s) => s.includes("jersey") || s.includes("uniform"))) return "uniforms";
  if (slugs.some((s) => s.includes("hat") || s.includes("cap"))) return "hats";
  if (slugs.some((s) => s.includes("chain"))) return "chains";
  return "accessories";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function isSizeChart(src: string): boolean {
  return /size[-_]?chart/i.test(src);
}

async function fetchAll(): Promise<WooProduct[]> {
  const out: WooProduct[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API}?per_page=20&page=${page}`);
    if (!res.ok) throw new Error(`API ${res.status} on page ${page}`);
    const batch = (await res.json()) as WooProduct[];
    if (batch.length === 0) break;
    out.push(...batch);
    const totalPages = Number(res.headers.get("x-wp-totalpages") || "1");
    if (page >= totalPages) break;
    page++;
  }
  return out;
}

async function download(url: string, destDir: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ext = (path.extname(new URL(url).pathname) || ".jpg").split("?")[0];
    const name = createHash("md5").update(url).digest("hex").slice(0, 12) + ext;
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(destDir, name), buf);
    return name;
  } catch {
    return null;
  }
}

async function main() {
  console.log("Fetching products from", API);
  const products = await fetchAll();
  console.log(`Fetched ${products.length} products`);

  await mkdir(PUBLIC_DIR, { recursive: true });
  await mkdir(path.dirname(DATA_FILE), { recursive: true });

  const catalog = [];
  for (const p of products) {
    const dir = path.join(PUBLIC_DIR, String(p.id));
    await mkdir(dir, { recursive: true });

    const realImages = p.images.filter((im) => !isSizeChart(im.src));
    const images: { src: string; alt: string }[] = [];
    for (const im of realImages) {
      const file = await download(im.src, dir);
      if (file) images.push({ src: `/products/${p.id}/${file}`, alt: decodeEntities(im.alt || p.name) });
    }

    const sizeAttr = p.attributes.find((a) => /size/i.test(a.name));
    const item = {
      legacyWooId: String(p.id),
      slug: p.slug,
      name: decodeEntities(p.name),
      description: decodeEntities(p.description || p.short_description),
      category: mapCategory(p.categories),
      priceCents: parseInt(p.prices.price || "0", 10),
      inStock: p.is_in_stock,
      categoriesRaw: p.categories.map((c) => c.name),
      sizes: sizeAttr ? sizeAttr.terms.map((t) => t.name) : [],
      images,
      sourceUrl: p.permalink,
    };
    catalog.push(item);
    console.log(`  ✓ ${item.name} (${images.length} imgs, ${item.category})`);
  }

  await writeFile(DATA_FILE, JSON.stringify(catalog, null, 2));
  console.log(`\nWrote ${catalog.length} products → ${path.relative(process.cwd(), DATA_FILE)}`);
  const imgCount = catalog.reduce((n, c) => n + c.images.length, 0);
  console.log(`Downloaded ${imgCount} product images → public/products/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
