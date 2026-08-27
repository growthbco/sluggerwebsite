import { SPORT_PAGES } from "@/lib/sport-pages";
import { PRICE_LIST } from "@/lib/pricing";

export const dynamic = "force-static";
export const revalidate = 86400; // rebuild daily

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
const money = (c: number) => `$${(c / 100).toFixed(0)}`;

// /llms.txt - a concise, factual summary for AI crawlers (ChatGPT, Perplexity,
// Google AI). Generated from the live sport pages so prices never drift. Flag
// football is listed first (our fastest-growing search source).
export function GET() {
  const order = ["custom-flag-football-uniforms", "custom-football-uniforms"];
  const pages = [...SPORT_PAGES].sort((a, b) => {
    const ia = order.indexOf(a.slug), ib = order.indexOf(b.slug);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const sections = pages
    .map((p) => {
      const prices = (p.pricing ?? []).map((x) => `${x.label} ${money(x.cents)}`).join(", ");
      const faq = (p.faqs ?? [])[0];
      return [
        `## ${p.sport} - Custom Uniforms & Jerseys`,
        prices ? `Pricing: ${prices}.` : "",
        faq ? `${faq.q} ${faq.a}` : "",
        `${SITE}/${p.slug}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const body = `# Slugger Athletics

> Slugger Athletics makes fully custom, sublimated team uniforms and jerseys for every sport - baseball, softball, flag football, football, basketball, soccer, volleyball, cheer, and more - plus embroidered hats, in Ocala, Florida, shipping nationwide. Design any uniform in minutes with a FREE AI design mockup before anything is produced. Names, numbers, and team colors always included, one flat price from youth to adult sizes, 6-piece minimum per design. Local pickup in Ocala, serving Central Florida (Ocala, Orlando, Tampa, Gainesville) and shipping nationwide.

## Contact
- Text: (352) 414-7270
- Email: apparel@sluggerathletics.com
- Location: Ocala, Florida
- Order flow: free design mockup, then a 50% deposit starts production and the balance is due before shipping. Most orders ship 2-3 weeks after approval; rush is about a week.

${sections}

## Full price list (per piece, plus 7% FL tax; custom design included; 6-piece minimum per design)
${PRICE_LIST.map((g) => `### ${g.group}\n` + g.rows.map((r) => `- ${r.item}: ${money(r.priceCents)}${r.note ? ` (${r.note})` : ""}`).join("\n")).join("\n")}
Full pricing and bundles: ${SITE}/pricing

## Design your own
- Free AI jersey maker (design a concept in minutes): ${SITE}/custom-jersey-maker
- Team uniforms hub: ${SITE}/team-uniforms
- Pricing and bundles: ${SITE}/pricing
- Custom cheer uniforms: ${SITE}/custom-cheer-uniforms
- Custom hockey jerseys: ${SITE}/custom-hockey-jerseys
- Custom embroidered hats: ${SITE}/custom-hats
- Custom beanies: ${SITE}/custom-beanies
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
