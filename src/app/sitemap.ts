import type { MetadataRoute } from "next";
import { products } from "@/lib/catalog";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sluggerathletics.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    "", "/shop", "/shop/uniforms", "/shop/hats", "/shop/chains", "/shop/accessories",
    "/drops", "/team-uniforms", "/embroidery", "/custom-hats", "/hype-chains", "/gallery",
    "/team-order", "/services", "/pricing", "/track", "/size-guide", "/faq", "/contact", "/shipping", "/returns",
    "/privacy", "/terms",
  ];

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${SITE}${p}`,
    lastModified: now,
    changeFrequency: p === "" ? "weekly" : "monthly",
    priority: p === "" ? 1 : 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE}/product/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...productEntries];
}
