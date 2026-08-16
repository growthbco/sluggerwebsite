import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoPage } from "@/components/info-page";
import { SERVICE_AREAS, getServiceArea } from "@/lib/service-areas";
import { SPORT_PAGES } from "@/lib/sport-pages";
import Link from "next/link";

// Local service-area landing pages: /custom-uniforms/the-villages etc.
// Each city gets distinct copy from src/lib/service-areas.ts.

export function generateStaticParams() {
  return SERVICE_AREAS.map((a) => ({ city: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const area = getServiceArea(city);
  if (!area) return {};
  return {
    title: area.metaTitle ?? `Custom Team Uniforms for ${area.city}, FL - Jerseys, Hats & More`,
    description:
      area.metaDescription ??
      `Custom team uniforms, jerseys, and embroidered hats for ${area.city} teams - free design, transparent 2026 pricing, made ${area.proximity}. Travel ball, league, school, and business orders welcome.`,
    alternates: { canonical: `/custom-uniforms/${area.slug}` },
  };
}

export default async function ServiceAreaPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const area = getServiceArea(city);
  if (!area) notFound();

  return (
    <>
    <InfoPage
      eyebrow={`Serving ${area.city}, Florida`}
      h1={area.h1 ?? `Custom Team Uniforms for ${area.city}`}
      intro={
        area.intro ? (
          <>{area.intro}</>
        ) : (
          <>
            Slugger Athletics designs and produces{" "}
            <strong className="text-foreground">custom team uniforms for {area.city}</strong> teams -
            fully sublimated jerseys, in-house embroidered hats, and complete uniform sets, made{" "}
            {area.proximity}. Free design mockups, per-player roster entry, and honest 2026 pricing.
          </>
        )
      }
      offeringsTitle={`What ${area.city} Teams Order`}
      offeringsBlurb="Travel ball, rec leagues, schools, businesses - if it needs a uniform, we make it."
      offerings={[
        { t: "Custom Jerseys", d: "Fully sublimated crew, two-button, full-button, and quarter-zip styles from $28 - names, numbers, and unlimited colors included." },
        { t: "Embroidered Hats", d: "Fitted and snapback caps embroidered in our Ocala shop - 6-hat minimum per design, often ready in days." },
        { t: "Full Uniform Bundles", d: "Game Day, Home & Away, and Total Package bundles - one per-player price for the whole set." },
        { t: "Free Team Stores", d: "We set up a free online store for your team so every player and parent orders their own gear - no collecting money or sizes." },
      ]}
      exampleCategory={area.realPhotos ? undefined : "uniforms"}
      manualExamples={area.realPhotos}
      exampleFit={area.realPhotos ? "cover" : undefined}
      exampleTitle="Recent Custom Work"
      exampleAltSuffix={` - custom team uniforms ${area.city} FL`}
      localTitle={`Why ${area.city} Teams Choose Slugger`}
      localBody={<>{area.blurb}</>}
      jsonLd={[
        {
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Custom Team Uniforms",
          provider: { "@id": "https://sluggerathletics.com/#business" },
          areaServed: { "@type": "City", name: `${area.city}, Florida` },
          description: `Custom team uniforms, jerseys, and embroidered hats for ${area.city}, Florida teams.`,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://sluggerathletics.com/" },
            { "@type": "ListItem", position: 2, name: "Custom Uniforms", item: "https://sluggerathletics.com/custom-uniforms" },
            { "@type": "ListItem", position: 3, name: area.city, item: `https://sluggerathletics.com/custom-uniforms/${area.slug}` },
          ],
        },
        ...(area.faqs && area.faqs.length
          ? [
              {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: area.faqs.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              },
            ]
          : []),
      ]}
    />

    {/* Metro pages (Orlando etc.) get deep-dive copy, an ordering-process
        block, a delivery note, and an FAQ. Nearby-town pages skip all of this. */}
    {area.deepDive && area.deepDive.length > 0 && (
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 space-y-5">
        {area.deepDive.map((p, i) => (
          <p key={i} className="text-muted leading-relaxed">{p}</p>
        ))}
      </section>
    )}

    {area.process && area.process.length > 0 && (
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        <h2 className="display text-2xl text-foreground">How Ordering Works for {area.city} Teams</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {area.process.map((s) => (
            <div key={s.t} className="bg-steel border border-line clip-slant p-5">
              <div className="display text-brand text-sm">{s.t}</div>
              <p className="mt-2 text-sm text-muted leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
    )}

    {area.delivery && (
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-16">
        <div className="bg-steel border border-line clip-slant p-6">
          <h2 className="display text-xl text-foreground">Getting Your Uniforms in {area.city}</h2>
          <p className="mt-3 text-muted leading-relaxed">{area.delivery}</p>
        </div>
      </section>
    )}
    {/* Sport interlinks with keyword anchors */}
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
      <h2 className="display text-2xl text-foreground">Every Sport for {area.city} Teams</h2>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {SPORT_PAGES.map((p) => (
          <Link key={p.slug} href={`/${p.slug}`} className="text-brand hover:underline">
            {p.h1}
          </Link>
        ))}
        <Link href="/custom-hats" className="text-brand hover:underline">Custom Embroidered Hats</Link>
        <Link href="/pricing" className="text-brand hover:underline">2026 Pricing &amp; Bundles</Link>
      </div>
    </section>

    {area.faqs && area.faqs.length > 0 && (
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pb-20">
        <h2 className="display text-2xl text-foreground">{area.city} Custom Uniform FAQs</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {area.faqs.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="display text-base text-foreground cursor-pointer list-none flex justify-between gap-4">
                {f.q}
                <span className="text-brand transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-muted leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    )}
    </>
  );
}
