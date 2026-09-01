import Link from "next/link";
import Image from "next/image";
import { ExpandableImage } from "@/components/expandable-image";
import { SPORT_PAGES, type SportPage } from "@/lib/sport-pages";
import { SERVICE_AREAS } from "@/lib/service-areas";
import { galleryPhotos } from "@/lib/gallery";
import { BUNDLES, formatDollars } from "@/lib/pricing";

const SPORT_HERO_IMAGES: Record<string, string> = {
  "custom-cheer-uniforms": "/sports/generated/cheer-sa-catalog.png",
  "custom-baseball-uniforms": "/sports/generated/baseball-sa-catalog.png",
  "custom-softball-uniforms": "/sports/generated/softball-sa-catalog.png",
  "custom-basketball-uniforms": "/sports/generated/basketball-sa-catalog.png",
  "custom-soccer-uniforms": "/sports/generated/soccer-sa-catalog.png",
  "custom-flag-football-uniforms": "/sports/generated/flag-football-sa-catalog.png",
  "custom-football-uniforms": "/sports/generated/football-sa-catalog.png",
  "custom-pickleball-shirts": "/sports/generated/pickleball-sa-catalog.png",
  "custom-volleyball-uniforms": "/sports/generated/volleyball-sa-catalog.png",
  "custom-hockey-jerseys": "/sports/generated/hockey-sa-catalog.png",
  "custom-bowling-shirts": "/sports/generated/bowling-sa-catalog.png",
};

// Rich sport landing page: branded mockup + REAL uniform photos, deep
// sport-specific copy, pricing, bundles, FAQs (with FAQPage schema), and the
// two funnel CTAs. Shared by all /custom-<sport>-* pages.
export function SportPageTemplate({ page, photoOffset = 0 }: { page: SportPage; photoOffset?: number }) {
  const isCheer = page.slug === "custom-cheer-uniforms";
  const hasBasketballChart = page.slug === "custom-basketball-uniforms";
  const heroImage = SPORT_HERO_IMAGES[page.slug];
  const startingPrice = page.pricing?.[0];
  const heroHighlights = isCheer
    ? ["Top + skirt sets from $120", "Top and bottom sized separately", "Youth and adult sizing", "Free custom design before ordering"]
    : [
        startingPrice ? `${startingPrice.label} · ${formatDollars(startingPrice.cents)}` : "Custom team pricing",
        "Names and numbers included",
        "Free custom design before ordering",
        "Ships nationwide",
      ];
  // Real product shots of THIS sport come first. The general gallery pool is
  // untagged and is almost entirely baseball/softball team photos, so we only
  // fill from it on baseball/softball pages where it's on-topic. Every other
  // sport shows just its own mockup + realPhotos - no mismatched-sport images.
  const real = page.realPhotos ?? [];
  const galleryOnTopic = ["Baseball", "Softball"].includes(page.sport);
  const photos = galleryOnTopic
    ? [...galleryPhotos.slice(photoOffset), ...galleryPhotos.slice(0, photoOffset)].slice(0, Math.max(0, 5 - real.length))
    : [];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: page.h1,
      // Reference the single canonical business entity (defined sitewide in
      // layout.tsx) instead of a duplicate anonymous node - so it inherits the
      // rating, hours, and sameAs.
      provider: { "@id": "https://sluggerathletics.com/#business" },
      areaServed: [{ "@type": "City", name: "Ocala, Florida" }, { "@type": "Country", name: "United States" }],
      description: page.metaDescription,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://sluggerathletics.com/" },
        { "@type": "ListItem", position: 2, name: page.h1, item: `https://sluggerathletics.com/${page.slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className={heroImage ? "grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]" : "max-w-3xl"}>
        <div>
          <span className="display text-brand text-sm">Custom {page.sport} · Ocala, FL · Ships Nationwide</span>
          <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">{page.h1}</h1>
          <p className="mt-4 text-muted text-lg">{page.intro}</p>
          {heroImage && (
            <div className="mt-5 grid gap-2 text-sm text-foreground sm:grid-cols-2">
              {heroHighlights.map((highlight) => (
                <p key={highlight} className="border-l-2 border-brand pl-3">{highlight}</p>
              ))}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/design" className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-6 py-3 transition-colors">
              Start a Free Design
            </Link>
            <Link href="/pricing" className="border border-brand/70 text-foreground hover:bg-brand/10 display px-6 py-3 transition-colors">
              See 2026 Pricing
            </Link>
            <Link href="/custom-jersey-maker" className="border border-brand/70 text-brand hover:bg-brand/10 display px-6 py-3 transition-colors">
              ⚡ Try the AI Design Lab
            </Link>
            {hasBasketballChart && (
              <Link href="#basketball-size-chart" className="border border-line text-foreground hover:border-brand/60 display px-6 py-3 transition-colors">
                View Size Chart
              </Link>
            )}
          </div>
        </div>
        {heroImage && (
          <div className="relative aspect-square w-full max-w-[420px] justify-self-center overflow-hidden border border-brand/60 bg-[#f4f1e9] lg:justify-self-end">
            <Image
              src={heroImage}
              alt={`Black and gold Slugger Athletics custom ${page.sport.toLowerCase()} uniform`}
              fill
              preload
              sizes="(max-width: 1024px) 100vw, 44vw"
              className="object-contain p-4 sm:p-6"
            />
            <span className="absolute left-3 top-3 bg-brand px-2 py-1 display text-[10px] text-on-brand">
              {isCheer ? "TOP + SKIRT SET" : `${page.sport.toUpperCase()} CUSTOM`}
            </span>
            <span className="absolute bottom-3 right-3 bg-ink/90 px-3 py-1.5 text-xs text-foreground">
              {isCheer ? "Sized separately" : "Designed for your team"}
            </span>
          </div>
        )}
      </header>

      {/* Mockup + real uniforms: proof beats promises. */}
      <section className="mt-14">
        <h2 className="display text-3xl text-foreground">{isCheer ? "Recent Cheer Designs" : "Real Uniforms, Real Teams"}</h2>
        <p className="mt-2 text-muted">
          {isCheer
            ? "Explore sideline and competition looks, then we’ll rebuild your favorite direction in your team’s colors."
            : `Our Slugger-styled ${page.sport.toLowerCase()} mockup - and real gear we have produced.`}
        </p>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="relative aspect-square bg-white border border-brand/60 overflow-hidden">
            <ExpandableImage src={page.mockup} alt={`${page.h1} - Slugger Athletics mockup`} />
            <span className="absolute top-2 left-2 bg-brand text-on-brand display text-[10px] px-2 py-0.5 pointer-events-none">SLUGGER STYLE</span>
          </div>
          {real.map((rp) => (
            <div key={rp.src} className="relative aspect-square bg-white border border-brand/60 overflow-hidden">
              <ExpandableImage src={rp.src} alt={rp.alt} />
              <span className="absolute top-2 left-2 bg-brand text-on-brand display text-[10px] px-2 py-0.5 pointer-events-none">MADE BY US</span>
            </div>
          ))}
          {photos.map((ph) => (
            <div key={ph.id} className="relative aspect-square bg-steel border border-line overflow-hidden">
              <ExpandableImage src={ph.file} alt={`${ph.alt} - custom ${page.sport.toLowerCase()} gear by Slugger Athletics`} unoptimized />
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">
          <Link href="/gallery" className="text-brand hover:underline">See the full gallery →</Link>
        </p>
      </section>

      {/* Deep dive */}
      <section className="mt-14 max-w-3xl space-y-4">
        {page.deepDive.map((para, i) => (
          <p key={i} className="text-foreground/85 leading-relaxed">{para}</p>
        ))}
      </section>

      {/* Offerings */}
      <section className="mt-14">
        <h2 className="display text-3xl text-foreground">{page.sport} Gear We Make</h2>
        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          {page.offerings.map((o) => (
            <div key={o.t} className="bg-steel border border-line p-5">
              <h3 className="display text-lg text-foreground">{o.t}</h3>
              <p className="mt-1.5 text-sm text-muted">{o.d}</p>
            </div>
          ))}
        </div>
      </section>

      {hasBasketballChart && (
        <section id="basketball-size-chart" className="mt-14 scroll-mt-32">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="display text-3xl text-foreground">Youth &amp; Adult Basketball Size Chart</h2>
              <p className="mt-2 max-w-2xl text-muted">Measure a well-fitting jersey across the chest 1&quot; below the armhole, then from the highest shoulder point to the bottom hem.</p>
            </div>
            <Link href="/size-guide#basketball" className="text-sm text-brand hover:underline">View measurements as tables →</Link>
          </div>
          <a href="/size-charts/basketball-size-chart.webp" target="_blank" rel="noopener noreferrer" className="mt-5 block max-w-3xl border border-line bg-white p-2 hover:border-brand/60">
            <Image
              src="/size-charts/basketball-size-chart.webp"
              alt="Youth and adult basketball uniform size chart with width and length measurements"
              width={1122}
              height={1402}
              sizes="(max-width: 768px) 100vw, 768px"
              className="h-auto w-full"
            />
          </a>
        </section>
      )}

      {/* Pricing strip */}
      <section className="mt-14 bg-steel border border-line p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="display text-2xl text-foreground">Straightforward 2026 Pricing</h2>
          <Link href="/pricing" className="text-sm text-brand hover:underline">Full price list →</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {(page.pricing ?? [
            { label: "Jerseys from", cents: 2800 },
            { label: "Practice shirts", cents: 2000 },
            { label: "Hats from", cents: 2500 },
            { label: "Bundles from", cents: BUNDLES[0].priceCents },
          ]).map((x) => (
            <div key={x.label} className="bg-ink border border-line px-3 py-4">
              <p className="display text-2xl text-brand">{formatDollars(x.cents)}</p>
              <p className="text-xs text-muted mt-1">{x.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {page.priceNote ?? "Design included · names & numbers included · same price youth to 5XL · 6-piece minimum per design (hats included)"}
        </p>
      </section>

      {/* FAQs */}
      <section className="mt-14 max-w-3xl">
        <h2 className="display text-3xl text-foreground">{page.sport} Uniform FAQs</h2>
        <div className="mt-5 space-y-5">
          {page.faqs.map((f) => (
            <div key={f.q}>
              <h3 className="display text-lg text-foreground">{f.q}</h3>
              <p className="mt-1 text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Keyword-anchor interlinks: every sport page links its siblings,
          the city pages, and the core product pages. */}
      <section className="mt-14">
        <h2 className="display text-2xl text-foreground">More Custom Gear</h2>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {SPORT_PAGES.filter((p) => p.slug !== page.slug).map((p) => (
            <Link key={p.slug} href={`/${p.slug}`} className="text-brand hover:underline">
              {p.h1}
            </Link>
          ))}
          <Link href="/custom-sublimated-jerseys" className="text-brand hover:underline">Custom Sublimated Jerseys</Link>
          <Link href="/custom-practice-jerseys" className="text-brand hover:underline">Custom Practice Jerseys ($20)</Link>
          <Link href="/custom-hats" className="text-brand hover:underline">Custom Embroidered Hats</Link>
          <Link href="/hype-chains" className="text-brand hover:underline">Custom Hype Chains</Link>
        </div>
        <p className="mt-4 text-sm text-muted">
          Serving{" "}
          {SERVICE_AREAS.map((a, i) => (
            <span key={a.slug}>
              <Link href={`/custom-uniforms/${a.slug}`} className="text-brand hover:underline">
                custom uniforms in {a.city}
              </Link>
              {i < SERVICE_AREAS.length - 1 ? ", " : ""}
            </span>
          ))}{" "}
          - and teams nationwide.
        </p>
      </section>

      {/* Local + CTA */}
      <section className="mt-14 max-w-3xl">
        <h2 className="display text-3xl text-foreground">{page.sport} Teams, Local and Nationwide</h2>
        <p className="mt-3 text-muted">{page.localBody}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/design" className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-6 py-3 transition-colors">
            Get Your Free {page.sport} Design
          </Link>
          <a href="sms:+13524147270" className="border border-line text-foreground hover:border-brand/50 display px-6 py-3 transition-colors">
            💬 Text (352) 414-7270
          </a>
        </div>
      </section>
    </div>
  );
}
