import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sluggerathletics.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/transactional paths out of the index.
      disallow: ["/api/", "/cart", "/checkout/", "/team-order/join/", "/team-order/manage/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
