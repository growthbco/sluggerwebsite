// Real catalog migrated from the existing WooCommerce store.
// Reads src/data/migrated-products.json and exposes it in the storefront shape.
import migrated from "@/data/migrated-products.json";
// AI-generated uniform mockups (hero/front/back) keyed by product slug.
import mockups from "@/data/mockups.json";

type MockupSet = { hero?: string; front?: string; back?: string };
const mockupMap = mockups as Record<string, MockupSet>;

export type Category = "hats" | "uniforms" | "chains" | "accessories";

export type CatalogProduct = {
  legacyWooId: string;
  slug: string;
  name: string;
  description: string;
  category: Category;
  priceCents: number;
  inStock: boolean;
  categoriesRaw: string[];
  sizes: string[];
  images: { src: string; alt: string }[];
  sourceUrl: string;
};

const FALLBACK_IMG =
  "https://placehold.co/800x800/13160b/b8a36c/png?text=Slugger&font=oswald";

// If a product has AI mockups, use them (hero → front → back) as its images so
// the styled, uniform shots show on cards + gallery; otherwise keep migrated imgs.
function resolveImages(p: CatalogProduct): { src: string; alt: string }[] {
  const m = mockupMap[p.slug];
  if (m && (m.hero || m.front || m.back)) {
    const ordered = [m.hero, m.front, m.back].filter(Boolean) as string[];
    return ordered.map((src, i) => ({ src, alt: `${p.name} - view ${i + 1}` }));
  }
  return p.images.length ? p.images : [{ src: FALLBACK_IMG, alt: p.name }];
}

export const products: CatalogProduct[] = (migrated as CatalogProduct[]).map((p) => ({
  ...p,
  images: resolveImages(p),
}));

export function primaryImage(p: CatalogProduct): string {
  return p.images[0]?.src ?? FALLBACK_IMG;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function getProduct(slug: string): CatalogProduct | undefined {
  return products.find((p) => p.slug === slug);
}

export function byCategory(cat: Category): CatalogProduct[] {
  return products.filter((p) => p.category === cat);
}

// Products whose names match Slugger's themed drop collections.
export function featured(limit = 8): CatalogProduct[] {
  return products.filter((p) => p.inStock).slice(0, limit);
}

const DROP_KEYWORDS = ["horror", "myers", "freddy", "pennywise", "jason", "neon", "christmas", "vice"];
export function dropProducts(limit = 6): CatalogProduct[] {
  return products
    .filter((p) => DROP_KEYWORDS.some((k) => p.name.toLowerCase().includes(k)))
    .slice(0, limit);
}
