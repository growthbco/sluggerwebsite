import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_GROUPS, type Service } from "@/lib/services-list";

export const metadata: Metadata = {
  title: "Services & Pricing - Custom Hats, Uniforms & Embroidery",
  description:
    "Every service we offer with upfront pricing - custom embroidered hats from $25, sublimated team uniforms, free design, free digitizing, and team order tools.",
  openGraph: {
    title: "Services & Pricing - Custom Hats, Uniforms & Embroidery",
    description:
      "Every service we offer with upfront pricing - embroidered hats from $25, sublimated uniforms, free design and digitizing, and team order tools.",
    type: "website",
    url: "/services",
  },
  alternates: { canonical: "/services" },
};

const SITE = "https://www.sluggerathletics.com";

// Turn a display price ("$25", "From $25", "Free") into a schema.org price.
function schemaPrice(price: string | null): string | null {
  if (!price) return null;
  if (price === "Free") return "0";
  const m = price.match(/\$(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

function offerJsonLd(s: Service) {
  const price = schemaPrice(s.price);
  return {
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: s.name,
      description: s.description,
      url: `${SITE}${s.href}`,
      provider: { "@type": "LocalBusiness", name: "Slugger Athletics" },
    },
    ...(price !== null ? { price, priceCurrency: "USD" } : {}),
  };
}

export default function ServicesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Slugger Athletics Services",
    url: `${SITE}/services`,
    itemListElement: SERVICE_GROUPS.map((g) => ({
      "@type": "OfferCatalog",
      name: g.title,
      itemListElement: g.services.map(offerJsonLd),
    })),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <span className="display text-brand text-sm">No Minimums · Free Design · Upfront Pricing</span>
        <h1 className="display text-4xl sm:text-6xl text-foreground mt-2">Our Services</h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto">
          Everything we make and how much it costs - custom embroidered hats, fully sublimated
          team uniforms, and the free design and team order tools that come with every job. No
          setup fees, no surprises.
        </p>
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link href="/team-order" className="clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
            Start an Order
          </Link>
          <Link href="/contact" className="clip-slant border border-line text-foreground display text-lg px-8 py-4 hover:bg-foreground/5 transition-colors">
            Get a Quote
          </Link>
        </div>
      </section>

      {/* Service groups */}
      {SERVICE_GROUPS.map((group, i) => (
        <section key={group.title} className={i % 2 === 0 ? "bg-steel border-y border-line" : undefined}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
            <h2 className="display text-3xl sm:text-4xl text-foreground">{group.title}</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.services.map((s) => (
                <div key={s.name} className="bg-ink border border-line p-6 flex flex-col">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="display text-lg text-foreground">{s.name}</h3>
                    {s.price && (
                      <span className="display text-brand whitespace-nowrap">{s.price}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted flex-1">{s.description}</p>
                  <Link href={s.href} className="mt-4 inline-block text-sm text-brand hover:underline">
                    Learn more →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <h2 className="display text-3xl sm:text-4xl text-foreground">Ready When You Are</h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">
          Not sure where to start? Send us your logo or idea and we&apos;ll design it free, show
          you a proof, and quote the whole job. See the{" "}
          <Link href="/pricing" className="text-brand hover:underline">full price list</Link> for
          every item we make.
        </p>
        <p className="mt-6 text-muted">
          Call <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a> or
          email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
        </p>
        <Link href="/team-order" className="inline-block mt-8 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
          Start Your Order
        </Link>
      </section>
    </div>
  );
}
