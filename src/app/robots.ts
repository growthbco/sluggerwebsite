import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/transactional paths out of the index.
      disallow: ["/api/", "/admin", "/cart", "/checkout/", "/team-order/join/", "/team-order/manage/", "/design/manage/", "/design/status/", "/store/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
