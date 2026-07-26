import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { SPORT_PAGES } from "@/lib/sport-pages";

const page = SPORT_PAGES.find((p) => p.slug === "custom-baseball-uniforms")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: `/${page.slug}` },
};

export default function SportUniformPage() {
  return (
    <InfoPage
      eyebrow={`Custom ${page.sport} Uniforms · Ocala, FL`}
      h1={page.h1}
      intro={<>{page.intro}</>}
      offeringsTitle={`${page.sport} Gear We Make`}
      offeringsBlurb="Fully custom sublimated - free design mockup before production, 6-piece minimum per design."
      offerings={page.offerings}
      manualExamples={[{ src: page.mockup, alt: `${page.h1} - Slugger Athletics Ocala FL` }]}
      exampleTitle="Slugger-Style Mockup"
      exampleAltSuffix={` - ${page.h1.toLowerCase()} Ocala FL`}
      localTitle={`${page.sport} Teams, Local and Nationwide`}
      localBody={<>{page.localBody}</>}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: page.h1,
        provider: {
          "@type": "LocalBusiness",
          name: "Slugger Athletics",
          email: "apparel@sluggerathletics.com",
          telephone: "+1-352-660-1232",
          address: { "@type": "PostalAddress", addressLocality: "Ocala", addressRegion: "FL", addressCountry: "US" },
        },
        areaServed: [{ "@type": "City", name: "Ocala, Florida" }, { "@type": "Country", name: "United States" }],
        description: page.metaDescription,
      }}
    />
  );
}
